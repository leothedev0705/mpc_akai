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
  private bufferCache = new Map<string, AudioBuffer>();
  private activePlaybacks = new Map<string, PlaybackInstance>();
  private levelCallback: LevelCallback | null = null;
  private playbackEndCallback: PlaybackEndCallback | null = null;
  private rafId: number | null = null;
  private masterVolume = 0.85;
  private padLevels = new Map<string, number>();

  async ensureContext(): Promise<AudioContext> {
    if (!this.context) {
      this.context = new AudioContext({ latencyHint: 'interactive' });
      this.masterGain = this.context.createGain();
      this.analyser = this.context.createAnalyser();
      this.analyser.fftSize = 256;
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
      this.masterGain.gain.setTargetAtTime(this.masterVolume, this.context.currentTime, 0.01);
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
    
    if (assetId.includes('vocal')) {
      const duration = 0.8;
      const buffer = this.context.createBuffer(1, sampleRate * duration, sampleRate);
      const data = buffer.getChannelData(0);
      const isAlt = assetId.includes('2') || assetId.includes('4');
      const baseFreq = isAlt ? 220 : 165;
      for (let i = 0; i < data.length; i++) {
        const t = i / sampleRate;
        const env = Math.exp(-t * 5);
        const wave = Math.sin(2 * Math.PI * baseFreq * t) + 
                     0.5 * Math.sin(2 * Math.PI * baseFreq * 2 * t) +
                     0.3 * Math.sin(2 * Math.PI * 650 * t) * Math.sin(2 * Math.PI * 50 * t) + 
                     0.2 * Math.sin(2 * Math.PI * 1200 * t);
        data[i] = wave * env * 0.3;
      }
      return buffer;
    } else if (assetId.includes('guitar')) {
      const duration = 1.5;
      const buffer = this.context.createBuffer(1, sampleRate * duration, sampleRate);
      const data = buffer.getChannelData(0);
      const freq = 164.81;
      const L = Math.round(sampleRate / freq);
      const ringBuffer = new Float32Array(L);
      for (let i = 0; i < L; i++) {
        ringBuffer[i] = Math.random() * 2 - 1;
      }
      let pointer = 0;
      for (let i = 0; i < data.length; i++) {
        const val = ringBuffer[pointer];
        data[i] = val;
        const nextPointer = (pointer + 1) % L;
        ringBuffer[pointer] = (val + ringBuffer[nextPointer]) * 0.5 * 0.992;
        pointer = nextPointer;
      }
      return buffer;
    } else if (assetId.includes('father')) {
      const duration = 2.0;
      const buffer = this.context.createBuffer(1, sampleRate * duration, sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        const t = i / sampleRate;
        const env = Math.exp(-t * 1.5);
        const freq = 55 + Math.exp(-t * 6) * 110;
        data[i] = Math.sin(2 * Math.PI * freq * t) * env * 0.6;
      }
      return buffer;
    } else if (assetId.includes('badtous') || assetId.includes('lordlong') || assetId.includes('intro')) {
      const duration = 3.0;
      const buffer = this.context.createBuffer(1, sampleRate * duration, sampleRate);
      const data = buffer.getChannelData(0);
      const baseFreq = assetId.includes('intro') ? 110 : 130.81;
      const freqs = [baseFreq, baseFreq * 1.2, baseFreq * 1.5, baseFreq * 1.8];
      for (let i = 0; i < data.length; i++) {
        const t = i / sampleRate;
        let env = 1;
        if (t < 0.3) env = t / 0.3;
        else env = Math.max(0, 1 - (t - 0.3) / 2.7);
        let sample = 0;
        for (const f of freqs) {
          sample += Math.sin(2 * Math.PI * f * t) * Math.sin(2 * Math.PI * 0.5 * t);
        }
        data[i] = (sample / freqs.length) * env * 0.4;
      }
      return buffer;
    } else if (assetId.includes('seethiscoat')) {
      const duration = 0.5;
      const buffer = this.context.createBuffer(1, sampleRate * duration, sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        const t = i / sampleRate;
        const env = Math.exp(-t * 15);
        let val = Math.random() * 2 - 1;
        if (i > 0) val = val - data[i-1];
        data[i] = val * env * 0.25;
      }
      return buffer;
    } else if (assetId.includes('lordfast')) {
      const duration = 2.0;
      const buffer = this.context.createBuffer(1, sampleRate * duration, sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        const t = i / sampleRate;
        const noteIndex = Math.floor(t * 8);
        const f = 220 * Math.pow(2, ((noteIndex * 3) % 12) / 12);
        const env = Math.exp(-(t % 0.125) * 20);
        data[i] = Math.sin(2 * Math.PI * f * t) * env * 0.4;
      }
      return buffer;
    } else if (assetId.includes('beatloop')) {
      const duration = 1.846;
      const buffer = this.context.createBuffer(1, sampleRate * duration, sampleRate);
      const data = buffer.getChannelData(0);
      const beatLen = 60 / 130;
      for (let i = 0; i < data.length; i++) {
        const t = i / sampleRate;
        let val = 0;
        
        const tKick = t % beatLen;
        const kickEnv = Math.exp(-tKick * 20);
        const kickFreq = 150 * Math.exp(-tKick * 30) + 40;
        val += Math.sin(2 * Math.PI * kickFreq * tKick) * kickEnv * 0.6;
        
        const beatNum = Math.floor(t / beatLen);
        if (beatNum === 1 || beatNum === 3) {
          const tSnare = t % beatLen;
          const snareEnv = Math.exp(-tSnare * 12);
          const snareNoise = (Math.random() * 2 - 1) * snareEnv * 0.3;
          const snareTone = Math.sin(2 * Math.PI * 180 * tSnare) * Math.exp(-tSnare * 30) * 0.2;
          val += snareNoise + snareTone;
        }

        const tHat = (t + beatLen/2) % beatLen;
        const hatEnv = Math.exp(-tHat * 45);
        const hatVal = (Math.random() * 2 - 1) * hatEnv * 0.15;
        val += hatVal;
        
        data[i] = val * 0.5;
      }
      return buffer;
    } else if (assetId.includes('cameraclick')) {
      const duration = 0.15;
      const buffer = this.context.createBuffer(1, sampleRate * duration, sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        const t = i / sampleRate;
        const env = Math.exp(-t * 30) * (t < 0.05 ? 1 : Math.exp(-(t-0.05) * 50));
        data[i] = (Math.random() * 2 - 1) * env * 0.3;
      }
      return buffer;
    } else {
      const duration = 0.2;
      const buffer = this.context.createBuffer(1, sampleRate * duration, sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        const t = i / sampleRate;
        const env = Math.exp(-t * 10);
        data[i] = Math.sin(2 * Math.PI * 880 * t) * env * 0.3;
      }
      return buffer;
    }
  }

  async playPad(options: {
    padId: string;
    assetId: string;
    volume: number;
    loop: boolean;
    exclusive: boolean;
    fadeIn?: number;
    offset?: number;
  }): Promise<string | null> {
    const { padId, assetId, volume, loop, exclusive, fadeIn = 0, offset = 0 } = options;
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
    gainNode.gain.value = fadeIn > 0 ? 0 : volume;
    source.connect(gainNode);
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
