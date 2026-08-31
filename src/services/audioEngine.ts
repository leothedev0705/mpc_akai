import { clamp } from '@/utils';

export interface PlaybackInstance {
  id: string;
  padId: string;
  source: AudioBufferSourceNode;
  gainNode: GainNode;
  startedAt: number;
  offset: number;
  loop: boolean;
  exclusiveGroup: string | null;
}

type LevelCallback = (padId: string, level: number) => void;
type PlaybackEndCallback = (instanceId: string, padId: string) => void;

class AudioEngine {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private reverbGain: GainNode | null = null;
  private convolver: ConvolverNode | null = null;
  private bufferCache = new Map<string, AudioBuffer>();
  private chopSliceCache = new Map<string, AudioBuffer[]>(); // assetId -> 16 slice buffers
  private activePlaybacks = new Map<string, PlaybackInstance>();
  private levelCallback: LevelCallback | null = null;
  private playbackEndCallback: PlaybackEndCallback | null = null;
  private rafId: number | null = null;
  private masterVolume = 0.85;
  private padLevels = new Map<string, number>();
  private rollTimerId: ReturnType<typeof setInterval> | null = null;

  async ensureContext(): Promise<AudioContext> {
    if (!this.context) {
      this.context = new AudioContext({ latencyHint: 'interactive' });
      this.masterGain = this.context.createGain();
      this.analyser = this.context.createAnalyser();
      this.analyser.fftSize = 256;

      // Reverb send chain
      this.reverbGain = this.context.createGain();
      this.reverbGain.gain.value = 0;
      this.convolver = this.context.createConvolver();
      this.convolver.buffer = this.createReverbImpulse(this.context, 1.5);
      this.reverbGain.connect(this.convolver);
      this.convolver.connect(this.masterGain!);

      this.masterGain.connect(this.analyser);
      this.analyser.connect(this.context.destination);
      this.masterGain.gain.value = this.masterVolume;
      this.startLevelMonitoring();
    }

    if (this.context.state === 'suspended') {
      await this.context.resume();
    }

    return this.context;
  }

  private createReverbImpulse(ctx: AudioContext, duration: number): AudioBuffer {
    const length = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2);
      }
    }
    return buffer;
  }

  setReverbLevel(level: number): void {
    if (this.reverbGain) {
      this.reverbGain.gain.value = clamp(level, 0, 1);
    }
  }

  /** Slice an audio buffer into N equal parts and cache them under `${assetId}:chop` */
  async chopToSlices(assetId: string, numSlices = 16): Promise<AudioBuffer[]> {
    const buffer = this.bufferCache.get(assetId);
    if (!buffer) return [];

    const sliceLen = Math.floor(buffer.length / numSlices);
    const slices: AudioBuffer[] = [];
    const ctx = await this.ensureContext();

    for (let i = 0; i < numSlices; i++) {
      const start = i * sliceLen;
      const end = i === numSlices - 1 ? buffer.length : start + sliceLen;
      const sliceBuf = ctx.createBuffer(buffer.numberOfChannels, end - start, buffer.sampleRate);
      for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
        const srcData = buffer.getChannelData(ch).subarray(start, end);
        sliceBuf.getChannelData(ch).set(srcData);
      }
      slices.push(sliceBuf);
    }

    this.chopSliceCache.set(assetId, slices);
    return slices;
  }

  getChopSlice(assetId: string, sliceIndex: number): AudioBuffer | undefined {
    return this.chopSliceCache.get(assetId)?.[sliceIndex];
  }

  hasChopSlices(assetId: string): boolean {
    return this.chopSliceCache.has(assetId);
  }

  /** Play a single chop slice for a pad */
  async playChopSlice(padId: string, assetId: string, sliceIndex: number, volume: number, chopGroupId?: string | null): Promise<void> {
    const slice = this.getChopSlice(assetId, sliceIndex);
    if (!slice) return;
    const ctx = await this.ensureContext();

    // Choke group: stop all pads in same chopGroup
    if (chopGroupId) {
      for (const instance of [...this.activePlaybacks.values()]) {
        if ((instance as any).chopGroupId === chopGroupId) {
          this.stopInstance(instance.id, 0.02);
        }
      }
    }

    const source = ctx.createBufferSource();
    source.buffer = slice;
    const gainNode = ctx.createGain();
    gainNode.gain.value = volume;
    source.connect(gainNode);
    gainNode.connect(this.masterGain!);

    const instanceId = crypto.randomUUID();
    const instance: PlaybackInstance & { chopGroupId?: string | null } = {
      id: instanceId,
      padId,
      source,
      gainNode,
      startedAt: ctx.currentTime,
      offset: 0,
      loop: false,
      exclusiveGroup: chopGroupId ?? null,
      chopGroupId: chopGroupId,
    };

    source.onended = () => {
      this.activePlaybacks.delete(instanceId);
      this.padLevels.set(padId, 0);
      this.playbackEndCallback?.(instanceId, padId);
    };

    this.activePlaybacks.set(instanceId, instance);
    source.start();
  }

  /** Play metronome tick — high tick on beat 1, low on 2-4 */
  playMetronomeTick(isDownbeat: boolean): void {
    if (!this.context || !this.masterGain) return;
    const ctx = this.context;
    const freq = isDownbeat ? 1000 : 800;
    const duration = 0.03;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    env.gain.setValueAtTime(0.4, ctx.currentTime);
    env.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(env);
    env.connect(this.masterGain);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  }

  /** Start beat roll — repeatedly triggers a pad at subdivisions */
  startRoll(
    triggerFn: () => void,
    bpm: number,
    subdivision: '1/8' | '1/16' | '1/32' = '1/16'
  ): void {
    this.stopRoll();
    const divisor = subdivision === '1/8' ? 2 : subdivision === '1/16' ? 4 : 8;
    const intervalMs = (60 / bpm / divisor) * 1000;
    triggerFn(); // trigger immediately
    this.rollTimerId = setInterval(triggerFn, intervalMs);
  }

  stopRoll(): void {
    if (this.rollTimerId !== null) {
      clearInterval(this.rollTimerId);
      this.rollTimerId = null;
    }
  }

  isRolling(): boolean {
    return this.rollTimerId !== null;
  }


  getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  setLevelCallback(cb: LevelCallback | null): void {
    this.levelCallback = cb;
  }

  setPlaybackEndCallback(cb: PlaybackEndCallback | null): void {
    this.playbackEndCallback = cb;
  }

  setMasterVolume(volume: number): void {
    this.masterVolume = clamp(volume, 0, 1);
    if (this.masterGain && this.context) {
      if (this.context.state === 'suspended') {
        void this.context.resume();
      }
      this.masterGain.gain.setValueAtTime(this.masterVolume, this.context.currentTime);
    }
  }

  /** Update gain of active playbacks for a pad in real time when volume changes */
  updatePadVolume(padId: string, volume: number): void {
    if (!this.context) return;
    const clamped = clamp(volume, 0, 1);
    for (const instance of this.activePlaybacks.values()) {
      if (instance.padId === padId && instance.gainNode) {
        instance.gainNode.gain.setValueAtTime(clamped, this.context.currentTime);
      }
    }
  }

  getMasterLevel(): number {
    if (!this.analyser) return 0;
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(data);
    const sum = data.reduce((acc, v) => acc + v, 0);
    return sum / (data.length * 255);
  }

  getPadLevel(padId: string): number {
    return this.padLevels.get(padId) ?? 0;
  }

  hasBuffer(assetId: string): boolean {
    return this.bufferCache.has(assetId);
  }

  async decodeAndCache(assetId: string, arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
    const ctx = await this.ensureContext();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
    this.bufferCache.set(assetId, audioBuffer);
    return audioBuffer;
  }

  getBuffer(assetId: string): AudioBuffer | undefined {
    return this.bufferCache.get(assetId);
  }

  removeBuffer(assetId: string): void {
    this.bufferCache.delete(assetId);
  }

  private synthesizeDefaultSound(assetId: string): AudioBuffer | undefined {
    if (!this.context) return undefined;
    const sampleRate = this.context.sampleRate;
    const lowerId = assetId.toLowerCase();

    if (lowerId.includes('vocal')) {
      const duration = 0.85;
      const buffer = this.context.createBuffer(1, Math.floor(sampleRate * duration), sampleRate);
      const data = buffer.getChannelData(0);
      
      // Determine vocal pitch based on vocal number
      let baseFreq = 164.81; // Vocal 1: E3
      if (lowerId.includes('2')) baseFreq = 220.00; // Vocal 2: A3
      if (lowerId.includes('3')) baseFreq = 246.94; // Vocal 3: B3
      if (lowerId.includes('4')) baseFreq = 329.63; // Vocal 4: E4

      // Formants for vowel synthesis ("Ah" / "Oh" / "Ee")
      const formant1 = baseFreq > 240 ? 800 : 650;
      const formant2 = baseFreq > 240 ? 1200 : 1050;

      for (let i = 0; i < data.length; i++) {
        const t = i / sampleRate;
        // Pitch envelope: slight initial glide like human vocal bend
        const pitchBend = 1.0 + 0.04 * Math.exp(-t * 15);
        const f = baseFreq * pitchBend;
        
        // Amplitude envelope (ADSR)
        const attack = Math.min(1, t / 0.03);
        const decay = Math.exp(-t * 3.5);
        const env = attack * decay;

        // Rich harmonics + formant resonance
        let wave = Math.sin(2 * Math.PI * f * t) +
                   0.6 * Math.sin(2 * Math.PI * f * 2 * t) +
                   0.4 * Math.sin(2 * Math.PI * f * 3 * t) +
                   0.25 * Math.sin(2 * Math.PI * f * 4 * t);
        
        // Formant filtering effect
        const formantMod = Math.sin(2 * Math.PI * formant1 * t) * 0.35 +
                           Math.sin(2 * Math.PI * formant2 * t) * 0.2;
        
        // Vibrato on tail
        const vibrato = t > 0.2 ? Math.sin(2 * Math.PI * 5.5 * t) * 0.05 : 0;

        data[i] = (wave * (1 + formantMod + vibrato)) * env * 0.32;
      }
      return buffer;
    } else if (lowerId.includes('father')) {
      // FAAAATHER: Full Hammond B3 organ gospel chords (E maj / C# min) + deep sub
      const duration = 2.4;
      const buffer = this.context.createBuffer(1, Math.floor(sampleRate * duration), sampleRate);
      const data = buffer.getChannelData(0);
      const chordFreqs = [164.81, 207.65, 246.94, 329.63, 415.30]; // Emaj chord
      
      for (let i = 0; i < data.length; i++) {
        const t = i / sampleRate;
        const attack = Math.min(1, t / 0.04);
        const env = attack * Math.exp(-t * 1.2);
        
        // Leslie rotor tremolo effect (approx 6.5 Hz)
        const rotor = 1 + 0.18 * Math.sin(2 * Math.PI * 6.5 * t);
        
        let sample = 0;
        for (let fi = 0; fi < chordFreqs.length; fi++) {
          const f = chordFreqs[fi];
          // Hammond drawbar harmonics (fundamental, octave, 3rd harmonic)
          sample += (Math.sin(2 * Math.PI * f * t) * 0.5 +
                     Math.sin(2 * Math.PI * f * 2 * t) * 0.3 +
                     Math.sin(2 * Math.PI * f * 3 * t) * 0.15);
        }
        
        // Warm sub bass foundation
        const sub = Math.sin(2 * Math.PI * 82.41 * t) * Math.exp(-t * 1.8) * 0.5;
        data[i] = (sample / chordFreqs.length * rotor * 0.6 + sub) * env * 0.45;
      }
      return buffer;
    } else if (lowerId.includes('badtous')) {
      // Bad To Us: Soulful gospel chop with warm chorus
      const duration = 2.0;
      const buffer = this.context.createBuffer(1, Math.floor(sampleRate * duration), sampleRate);
      const data = buffer.getChannelData(0);
      const chord = [130.81, 155.56, 196.00, 233.08]; // C minor 7th
      
      for (let i = 0; i < data.length; i++) {
        const t = i / sampleRate;
        const env = Math.min(1, t / 0.02) * Math.exp(-t * 1.6);
        let sample = 0;
        for (const f of chord) {
          sample += Math.sin(2 * Math.PI * f * t) + 0.4 * Math.sin(2 * Math.PI * f * 2 * t);
        }
        data[i] = (sample / chord.length) * env * 0.4;
      }
      return buffer;
    } else if (lowerId.includes('seethiscoat')) {
      // See This Coat: Crisp vocal stab with tape saturation
      const duration = 0.65;
      const buffer = this.context.createBuffer(1, Math.floor(sampleRate * duration), sampleRate);
      const data = buffer.getChannelData(0);
      const baseFreq = 261.63; // C4
      
      for (let i = 0; i < data.length; i++) {
        const t = i / sampleRate;
        const env = Math.min(1, t / 0.015) * Math.exp(-t * 6);
        const wave = Math.sin(2 * Math.PI * baseFreq * t) + 
                     0.5 * Math.sin(2 * Math.PI * baseFreq * 1.5 * t) +
                     0.3 * Math.sin(2 * Math.PI * 880 * t);
        data[i] = Math.tanh(wave * 1.8) * env * 0.35;
      }
      return buffer;
    } else if (lowerId.includes('lordfast')) {
      // Lord Fast: Upbeat rapid gospel arpeggios
      const duration = 1.846;
      const buffer = this.context.createBuffer(1, Math.floor(sampleRate * duration), sampleRate);
      const data = buffer.getChannelData(0);
      const scale = [220, 261.63, 293.66, 329.63, 392, 440];
      
      for (let i = 0; i < data.length; i++) {
        const t = i / sampleRate;
        const step = Math.floor(t * 8) % scale.length;
        const noteFreq = scale[step];
        const stepTime = t % 0.125;
        const env = Math.exp(-stepTime * 22);
        const wave = Math.sin(2 * Math.PI * noteFreq * t) + 0.3 * Math.sin(2 * Math.PI * noteFreq * 2 * t);
        data[i] = wave * env * 0.35;
      }
      return buffer;
    } else if (lowerId.includes('beatloop')) {
      // Beat Loop: 130 BPM Punchy Hip-Hop / Trap Drum Groove (4 beats = 1.84615s)
      const duration = 1.84615;
      const buffer = this.context.createBuffer(1, Math.floor(sampleRate * duration), sampleRate);
      const data = buffer.getChannelData(0);
      const beatLen = 60 / 130; // ~0.4615s
      const sixteenth = beatLen / 4;
      
      for (let i = 0; i < data.length; i++) {
        const t = i / sampleRate;
        let mix = 0;

        // 1. Kick on Beat 1, Beat 2.5, Beat 3.75
        const kickHits = [0, beatLen * 1.5, beatLen * 2.75];
        for (const hit of kickHits) {
          const tKick = t - hit;
          if (tKick >= 0 && tKick < 0.35) {
            const kickPitch = 130 * Math.exp(-tKick * 38) + 42;
            const kickEnv = Math.exp(-tKick * 12);
            mix += Math.sin(2 * Math.PI * kickPitch * tKick) * kickEnv * 0.75;
          }
        }

        // 2. Snare / Clap on Beat 2 and Beat 4
        const snareHits = [beatLen * 1, beatLen * 3];
        for (const hit of snareHits) {
          const tSnare = t - hit;
          if (tSnare >= 0 && tSnare < 0.28) {
            const snareEnv = Math.exp(-tSnare * 16);
            const noise = (Math.random() * 2 - 1) * snareEnv * 0.45;
            const body = Math.sin(2 * Math.PI * 185 * tSnare) * Math.exp(-tSnare * 30) * 0.3;
            mix += noise + body;
          }
        }

        // 3. Rolling Hi-Hats (16th notes with accent and sizzle)
        const hatIndex = Math.floor(t / sixteenth);
        const tHat = t - hatIndex * sixteenth;
        if (tHat >= 0 && tHat < 0.08) {
          const isAccent = hatIndex % 4 === 2;
          const hatEnv = Math.exp(-tHat * (isAccent ? 50 : 75));
          const hatNoise = (Math.random() * 2 - 1) * hatEnv * (isAccent ? 0.22 : 0.14);
          mix += hatNoise;
        }

        // Master soft-clip for analog punch
        data[i] = Math.tanh(mix * 1.2) * 0.55;
      }
      return buffer;
    } else if (lowerId.includes('intro')) {
      // Intro: Mike Dean style soaring analog synth lead
      const duration = 2.8;
      const buffer = this.context.createBuffer(1, Math.floor(sampleRate * duration), sampleRate);
      const data = buffer.getChannelData(0);
      const baseFreq = 110; // A2
      
      for (let i = 0; i < data.length; i++) {
        const t = i / sampleRate;
        const env = Math.min(1, t / 0.15) * (t < 2.0 ? 1 : Math.max(0, 1 - (t - 2.0) / 0.8));
        const glide = baseFreq * (1 + 0.5 * Math.exp(-t * 2));
        
        // Multi-saw detuned oscillators
        const saw1 = 2 * ((glide * t) % 1) - 1;
        const saw2 = 2 * (((glide * 1.008) * t) % 1) - 1;
        const saw3 = 2 * (((glide * 0.992) * t) % 1) - 1;
        const sub = Math.sin(2 * Math.PI * (glide / 2) * t) * 0.5;

        data[i] = ((saw1 + saw2 + saw3) * 0.25 + sub) * env * 0.35;
      }
      return buffer;
    } else if (lowerId.includes('guitar')) {
      // Guitar: Resonant Karplus-Strong string chord
      const duration = 1.8;
      const buffer = this.context.createBuffer(1, Math.floor(sampleRate * duration), sampleRate);
      const data = buffer.getChannelData(0);
      const chord = [164.81, 220.00, 261.63, 329.63];
      
      for (const freq of chord) {
        const L = Math.round(sampleRate / freq);
        const ring = new Float32Array(L);
        for (let k = 0; k < L; k++) ring[k] = Math.random() * 2 - 1;
        
        let p = 0;
        for (let i = 0; i < data.length; i++) {
          const val = ring[p];
          data[i] += val * (1 / chord.length) * 0.35;
          const next = (p + 1) % L;
          ring[p] = (val + ring[next]) * 0.5 * 0.993;
          p = next;
        }
      }
      return buffer;
    } else if (lowerId.includes('lordlong')) {
      // Lord Long: Sustained soul chords with warm organ vibrato
      const duration = 3.2;
      const buffer = this.context.createBuffer(1, Math.floor(sampleRate * duration), sampleRate);
      const data = buffer.getChannelData(0);
      const chord = [130.81, 164.81, 196.00, 246.94]; // Cmaj7
      
      for (let i = 0; i < data.length; i++) {
        const t = i / sampleRate;
        const env = Math.min(1, t / 0.1) * (t < 2.2 ? 1 : Math.max(0, 1 - (t - 2.2) / 1.0));
        const vibrato = Math.sin(2 * Math.PI * 5.0 * t) * 0.15;
        let sample = 0;
        for (const f of chord) {
          sample += Math.sin(2 * Math.PI * f * t) + 0.35 * Math.sin(2 * Math.PI * f * 2 * t);
        }
        data[i] = (sample / chord.length) * (1 + vibrato) * env * 0.38;
      }
      return buffer;
    } else if (lowerId.includes('cameraclick')) {
      // Camera click: Mechanical shutter click + mirror slap
      const duration = 0.22;
      const buffer = this.context.createBuffer(1, Math.floor(sampleRate * duration), sampleRate);
      const data = buffer.getChannelData(0);
      
      for (let i = 0; i < data.length; i++) {
        const t = i / sampleRate;
        // First click (shutter open) at t = 0
        const click1 = (Math.random() * 2 - 1) * Math.exp(-t * 90);
        // Second click (shutter close) at t = 0.05
        const t2 = t - 0.05;
        const click2 = t2 > 0 ? (Math.random() * 2 - 1) * Math.exp(-t2 * 110) * 1.2 : 0;
        // Mechanical winding hum at t > 0.08
        const t3 = t - 0.08;
        const motor = t3 > 0 ? Math.sin(2 * Math.PI * 340 * t3) * Math.exp(-t3 * 30) * 0.15 : 0;
        
        data[i] = (click1 + click2 + motor) * 0.45;
      }
      return buffer;
    } else if (lowerId.includes('info')) {
      // Info: Crystal chime synth tone
      const duration = 1.0;
      const buffer = this.context.createBuffer(1, Math.floor(sampleRate * duration), sampleRate);
      const data = buffer.getChannelData(0);
      const freqs = [523.25, 659.25, 783.99, 1046.50]; // Cmaj arpeggio chime
      
      for (let i = 0; i < data.length; i++) {
        const t = i / sampleRate;
        let mix = 0;
        for (let idx = 0; idx < freqs.length; idx++) {
          const noteTime = t - idx * 0.05;
          if (noteTime > 0) {
            mix += Math.sin(2 * Math.PI * freqs[idx] * noteTime) * Math.exp(-noteTime * 4.5);
          }
        }
        data[i] = mix * 0.25;
      }
      return buffer;
    } else {
      // Default / 808 Sub Bass Drop
      const duration = 1.2;
      const buffer = this.context.createBuffer(1, Math.floor(sampleRate * duration), sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        const t = i / sampleRate;
        const env = Math.exp(-t * 2.5);
        const pitchGlide = 90 * Math.exp(-t * 6) + 40;
        const wave = Math.sin(2 * Math.PI * pitchGlide * t);
        data[i] = Math.tanh(wave * 1.5) * env * 0.5;
      }
      return buffer;
    }
  }

  async playPad(options: {
    padId: string;
    assetId: string;
    volume: number;
    pan?: number;
    tune?: number;
    cutoff?: number;
    loop: boolean;
    exclusive: boolean;
    fadeIn?: number;
    offset?: number;
  }): Promise<string | null> {
    const { padId, assetId, volume, pan = 0, tune = 0, cutoff = 20000, loop, exclusive, fadeIn = 0, offset = 0 } = options;
    let buffer = this.bufferCache.get(assetId);
    if (!buffer) {
      buffer = this.synthesizeDefaultSound(assetId);
      if (buffer) {
        this.bufferCache.set(assetId, buffer);
      }
    }
    if (!buffer) return null;

    const ctx = await this.ensureContext();

    if (exclusive) {
      this.stopPadExclusive(padId);
    }

    const source = ctx.createBufferSource();
    const gainNode = ctx.createGain();
    source.buffer = buffer;
    source.loop = loop;

    // Apply pitch tuning in semitones (100 cents per semitone)
    if (tune !== 0 && source.detune) {
      source.detune.value = tune * 100;
    }

    gainNode.gain.value = fadeIn > 0 ? 0 : volume;

    // Connect node chain: Source -> Filter (optional) -> Pan (optional) -> Gain -> Master
    let lastNode: AudioNode = source;

    // Lowpass filter if cutoff is modified
    if (cutoff && cutoff < 19500) {
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = Math.max(20, Math.min(20000, cutoff));
      lastNode.connect(filter);
      lastNode = filter;
    }

    // Stereo Panner
    if (pan !== 0 && 'createStereoPanner' in ctx) {
      const panner = ctx.createStereoPanner();
      panner.pan.value = clamp(pan, -1, 1);
      lastNode.connect(panner);
      lastNode = panner;
    }

    lastNode.connect(gainNode);
    gainNode.connect(this.masterGain!);

    const instanceId = crypto.randomUUID();
    const instance: PlaybackInstance = {
      id: instanceId,
      padId,
      source,
      gainNode,
      startedAt: ctx.currentTime,
      offset,
      loop,
      exclusiveGroup: exclusive ? padId : null,
    };

    source.onended = () => {
      if (this.activePlaybacks.has(instanceId)) {
        this.activePlaybacks.delete(instanceId);
        this.padLevels.set(padId, 0);
        this.playbackEndCallback?.(instanceId, padId);
      }
    };

    if (fadeIn > 0) {
      gainNode.gain.setValueAtTime(0, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(volume, ctx.currentTime + fadeIn);
    }

    source.start(0, offset);
    this.activePlaybacks.set(instanceId, instance);
    return instanceId;
  }

  stopInstance(instanceId: string, fadeOut = 0): void {
    const instance = this.activePlaybacks.get(instanceId);
    if (!instance || !this.context) return;

    const { source, gainNode, padId } = instance;

    if (fadeOut > 0) {
      gainNode.gain.setTargetAtTime(0, this.context.currentTime, fadeOut / 3);
      setTimeout(() => {
        try {
          source.stop();
        } catch {
          /* already stopped */
        }
        this.activePlaybacks.delete(instanceId);
        this.padLevels.set(padId, 0);
        this.playbackEndCallback?.(instanceId, padId);
      }, fadeOut * 1000);
    } else {
      try {
        source.stop();
      } catch {
        /* already stopped */
      }
      this.activePlaybacks.delete(instanceId);
      this.padLevels.set(padId, 0);
      this.playbackEndCallback?.(instanceId, padId);
    }
  }

  stopPad(padId: string, fadeOut = 0): void {
    const instances = [...this.activePlaybacks.values()].filter((i) => i.padId === padId);
    instances.forEach((i) => this.stopInstance(i.id, fadeOut));
  }

  private stopPadExclusive(padId: string): void {
    const instances = [...this.activePlaybacks.values()].filter(
      (i) => i.exclusiveGroup === padId || i.padId === padId,
    );
    instances.forEach((i) => this.stopInstance(i.id));
  }

  stopAll(fadeOut = 0): void {
    [...this.activePlaybacks.keys()].forEach((id) => this.stopInstance(id, fadeOut));
  }

  pauseAll(): void {
    if (!this.context) return;
    this.context.suspend();
  }

  async resumeAll(): Promise<void> {
    if (!this.context) return;
    await this.context.resume();
  }

  isPadPlaying(padId: string): boolean {
    return [...this.activePlaybacks.values()].some((i) => i.padId === padId);
  }

  getActiveInstancesForPad(padId: string): PlaybackInstance[] {
    return [...this.activePlaybacks.values()].filter((i) => i.padId === padId);
  }

  isContextSuspended(): boolean {
    return this.context?.state === 'suspended';
  }

  private startLevelMonitoring(): void {
    const tick = () => {
      if (this.analyser && this.levelCallback) {
        const padActivity = new Map<string, number>();

        for (const instance of this.activePlaybacks.values()) {
          const elapsed = (this.context?.currentTime ?? 0) - instance.startedAt;
          const pulse = 0.3 + Math.abs(Math.sin(elapsed * 8)) * 0.5;
          const current = padActivity.get(instance.padId) ?? 0;
          padActivity.set(instance.padId, Math.max(current, pulse * instance.gainNode.gain.value));
        }

        padActivity.forEach((level, padId) => {
          this.padLevels.set(padId, level);
          this.levelCallback?.(padId, level);
        });

        for (const padId of this.padLevels.keys()) {
          if (!padActivity.has(padId)) {
            const current = this.padLevels.get(padId) ?? 0;
            const decayed = current * 0.85;
            if (decayed < 0.01) {
              this.padLevels.delete(padId);
              this.levelCallback?.(padId, 0);
            } else {
              this.padLevels.set(padId, decayed);
              this.levelCallback?.(padId, decayed);
            }
          }
        }
      }

      this.rafId = requestAnimationFrame(tick);
    };

    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = requestAnimationFrame(tick);
  }

  dispose(): void {
    this.stopAll();
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.context?.close();
    this.context = null;
    this.masterGain = null;
    this.analyser = null;
    this.bufferCache.clear();
    this.activePlaybacks.clear();
  }
}

export const audioEngine = new AudioEngine();
