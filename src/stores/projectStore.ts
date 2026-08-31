import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { AudioAsset, BankId, PadColor, PadConfig, Project, QuantizeValue } from '@/types';
import {
  createDefaultProject,
  debounce,
  getActiveBank,
  updatePadInProject,
} from '@/utils';
import { dbService } from '@/services/storageService';
import { audioEngine } from '@/services/audioEngine';
import { useUIStore } from '@/stores/uiStore';

interface ProjectState {
  project: Project;
  assets: AudioAsset[];
  selectedPadId: string | null;
  isLoading: boolean;
  isSaving: boolean;
  playingPadIds: Set<string>;
  vuLevels: Record<string, number>;
  masterLevel: number;
  isPaused: boolean;

  // Authentic MPC 2000XL Hardware Modes & Sequencer
  mpcMode: 'MAIN' | 'PAD_EDIT' | 'MIXER' | 'STEP_EDIT' | 'SAMPLER' | '16_LEVELS' | 'CHOP';
  sliderTarget: 'VOLUME' | 'TUNE' | 'FILTER' | 'REVERB';
  is16Levels: boolean;
  currentStep: number;
  isPlayingSequencer: boolean;

  // Overdub recording
  isRecording: boolean; // overdub armed + playing

  // Chop mode
  chopSourceAssetId: string | null;
  chopSliceCount: number;

  init: () => Promise<void>;
  newProject: (name?: string) => void;
  loadProject: (id: string) => Promise<boolean>;
  saveProject: () => Promise<void>;
  setProjectName: (name: string) => void;
  setActiveBank: (bankId: BankId) => void;
  selectPad: (padId: string | null) => void;
  updatePad: (padId: string, updates: Partial<PadConfig>) => void;
  assignAssetToPad: (padId: string, assetId: string) => void;
  clearPad: (padId: string) => void;
  setMasterVolume: (volume: number) => void;
  setBpm: (bpm: number) => void;
  setSwing: (swing: number) => void;
  setMpcMode: (mode: 'MAIN' | 'PAD_EDIT' | 'MIXER' | 'STEP_EDIT' | 'SAMPLER' | '16_LEVELS' | 'CHOP') => void;
  setSliderTarget: (target: 'VOLUME' | 'TUNE' | 'FILTER' | 'REVERB') => void;
  toggle16Levels: () => void;
  toggleStep: (padId: string, stepIndex: number) => void;
  startSequencer: () => void;
  stopSequencer: () => void;
  // Overdub / live recording into sequencer
  startOverdubRecord: () => void;
  stopOverdubRecord: () => void;
  stampPadHitToSequencer: (padId: string) => void; // call on each pad hit during overdub
  // Metronome
  toggleMetronome: () => void;
  setQuantize: (q: QuantizeValue) => void;
  // Chop workflow
  chopToPads: (assetId: string, bankId?: BankId) => Promise<void>;
  uploadFiles: (files: FileList | File[]) => Promise<AudioAsset[]>;
  deleteAsset: (assetId: string) => Promise<void>;
  preloadAssets: () => Promise<void>;
  triggerPad: (padId: string, pitchShift?: number) => Promise<void>;
  stopPad: (padId: string) => void;
  stopAll: () => void;
  pauseAll: () => void;
  resumeAll: () => void;
  setPlayingPad: (padId: string, playing: boolean) => void;
  setVuLevel: (padId: string, level: number) => void;
  setMasterLevel: (level: number) => void;
}

let seqTimerId: ReturnType<typeof setTimeout> | null = null;

const debouncedSave = debounce(async (get: () => ProjectState) => {
  const { project, saveProject } = get();
  if (project) await saveProject();
}, 1500);

export const useProjectStore = create<ProjectState>()(
  subscribeWithSelector((set, get) => ({
    project: createDefaultProject(),
    assets: [],
    selectedPadId: null,
    isLoading: false,
    isSaving: false,
    playingPadIds: new Set(),
    vuLevels: {},
    masterLevel: 0,
    isPaused: false,

    mpcMode: 'MAIN',
    sliderTarget: 'VOLUME',
    is16Levels: false,
    currentStep: 0,
    isPlayingSequencer: false,
    isRecording: false,
    chopSourceAssetId: null,
    chopSliceCount: 16,

    setBpm: (bpm) => {
      set((s) => ({ project: { ...s.project, bpm: Math.max(40, Math.min(240, bpm)), updatedAt: Date.now() } }));
      debouncedSave(get);
    },

    setSwing: (swing) => {
      set((s) => ({ project: { ...s.project, swing: Math.max(50, Math.min(75, swing)), updatedAt: Date.now() } }));
      debouncedSave(get);
    },

    setMpcMode: (mode) => set({ mpcMode: mode }),

    setSliderTarget: (target) => set({ sliderTarget: target }),

    toggle16Levels: () => {
      set((s) => {
        const next = !s.is16Levels;
        return { is16Levels: next, mpcMode: next ? '16_LEVELS' : 'MAIN' };
      });
    },

    toggleStep: (padId, stepIndex) => {
      set((s) => {
        const sequences = [...(s.project.sequences || [])];
        let seq = sequences.find((sq) => sq.padId === padId);
        if (!seq) {
          seq = { padId, steps: new Array(16).fill(false) };
          sequences.push(seq);
        }
        const updatedSteps = [...seq.steps];
        updatedSteps[stepIndex] = !updatedSteps[stepIndex];
        seq.steps = updatedSteps;

        return {
          project: {
            ...s.project,
            sequences,
            updatedAt: Date.now(),
          },
        };
      });
      debouncedSave(get);
    },

    startSequencer: () => {
      if (get().isPlayingSequencer) return;
      set({ isPlayingSequencer: true, currentStep: 0 });

      const scheduleStep = () => {
        if (!get().isPlayingSequencer) return;

        const { project, currentStep, triggerPad } = get();
        const bpm = project.bpm || 130;
        const swing = project.swing || 54;
        const sixteenthTime = (60 / bpm) / 4; // seconds

        // MPC Swing delay calculation for odd steps (1, 3, 5...)
        const isOdd = currentStep % 2 === 1;
        const swingOffset = isOdd ? ((swing - 50) / 100) * sixteenthTime : 0;
        const stepDurationMs = (sixteenthTime + (isOdd ? swingOffset : -swingOffset)) * 1000;

        // Metronome click on beats (every 4 steps = quarter note)
        if (project.metronomeOn) {
          const isDownbeat = currentStep === 0;
          const isBeat = currentStep % 4 === 0;
          if (isBeat) {
            audioEngine.playMetronomeTick(isDownbeat);
          }
        }

        // Trigger any pads active on this step
        if (project.sequences) {
          for (const seq of project.sequences) {
            if (seq.steps[currentStep]) {
              void triggerPad(seq.padId);
            }
          }
        }

        // Advance to next step (0 to 15)
        set((s) => ({ currentStep: (s.currentStep + 1) % 16 }));

        seqTimerId = setTimeout(scheduleStep, Math.max(10, stepDurationMs));
      };

      scheduleStep();
    },

    stopSequencer: () => {
      if (seqTimerId) {
        clearTimeout(seqTimerId);
        seqTimerId = null;
      }
      set({ isPlayingSequencer: false, currentStep: 0, isRecording: false });
    },

    startOverdubRecord: () => {
      // Start sequencer if not running, arm recording
      if (!get().isPlayingSequencer) {
        get().startSequencer();
      }
      set({ isRecording: true });
    },

    stopOverdubRecord: () => {
      set({ isRecording: false });
    },

    stampPadHitToSequencer: (padId: string) => {
      const { currentStep, project } = get();
      const quantize = project.quantize ?? '1/16';
      if (quantize === 'OFF') return;

      // Stamp the pad hit into the nearest step
      set((s) => {
        const sequences = [...(s.project.sequences || [])];
        let seq = sequences.find((sq) => sq.padId === padId);
        if (!seq) {
          seq = { padId, steps: new Array(16).fill(false) };
          sequences.push(seq);
        }
        const updatedSteps = [...seq.steps];
        const snapStep = Math.min(15, Math.max(0, currentStep));
        updatedSteps[snapStep] = true;
        seq.steps = updatedSteps;
        return { project: { ...s.project, sequences, updatedAt: Date.now() } };
      });
    },

    toggleMetronome: () => {
      set((s) => ({
        project: {
          ...s.project,
          metronomeOn: !s.project.metronomeOn,
          updatedAt: Date.now(),
        },
      }));
    },

    setQuantize: (q) => {
      set((s) => ({
        project: { ...s.project, quantize: q, updatedAt: Date.now() },
      }));
    },

    chopToPads: async (assetId: string, bankId?: BankId) => {
      await audioEngine.ensureContext();
      const slices = await audioEngine.chopToSlices(assetId, 16);
      if (!slices.length) return;

      const targetBankId = bankId ?? get().project.activeBankId;
      const asset = get().assets.find((a) => a.id === assetId);
      const chopGroupId = `chop-${assetId}`;

      // Cache each slice with a stable ID
      for (let i = 0; i < slices.length; i++) {
        const chopId = `${assetId}:chop:${i}`;
        if (!audioEngine.hasBuffer(chopId)) {
          // Copy slice to ArrayBuffer and decode into cache
          const slice = slices[i];
          const offline = new OfflineAudioContext(slice.numberOfChannels, slice.length, slice.sampleRate);
          const src = offline.createBufferSource();
          src.buffer = slice;
          src.connect(offline.destination);
          src.start();
          const rendered = await offline.startRendering();
          // Convert to ArrayBuffer via channel data
          const totalLength = rendered.length * rendered.numberOfChannels * 2;
          const ab = new ArrayBuffer(totalLength);
          const view = new DataView(ab);
          let offset = 0;
          for (let ch = 0; ch < rendered.numberOfChannels; ch++) {
            const data = rendered.getChannelData(ch);
            for (let s = 0; s < data.length; s++) {
              view.setInt16(offset, Math.max(-32768, Math.min(32767, data[s] * 32768)), true);
              offset += 2;
            }
          }
          // Directly store the AudioBuffer in the engine cache
          await audioEngine.decodeAndCache(chopId, slice.getChannelData(0).buffer.slice(0)).catch(() => {
            // If decodeAudioData fails on raw channel data, just store the rendered buffer directly
            // We'll set it via the internal cache workaround
          });
          // Direct buffer injection
          audioEngine['bufferCache']?.set(chopId, slice);
        }
      }

      set((s) => ({
        project: {
          ...s.project,
          banks: s.project.banks.map((bank) => {
            if (bank.id !== targetBankId) return bank;
            return {
              ...bank,
              pads: bank.pads.map((pad, idx) => {
                const sliceName = asset ? `${asset.name} [${idx + 1}]` : `CHOP ${String(idx + 1).padStart(2, '0')}`;
                return {
                  ...pad,
                  assetId: `${assetId}:chop:${idx}`,
                  name: sliceName,
                  exclusive: true,
                  chopGroupId,
                };
              }),
            };
          }),
          updatedAt: Date.now(),
        },
      }));
    },

    init: async () => {
      try {
        await dbService.init();
        const assets = await dbService.getAllAssets().catch(() => []);
        set({ assets });

        audioEngine.setLevelCallback((padId, level) => {
          get().setVuLevel(padId, level);
          get().setMasterLevel(audioEngine.getMasterLevel());
        });

        audioEngine.setPlaybackEndCallback((_instanceId, padId) => {
          if (!audioEngine.isPadPlaying(padId)) {
            get().setPlayingPad(padId, false);
          }
        });

        await get().preloadAssets().catch(() => {});

        audioEngine.setMasterVolume(get().project.masterVolume);

        const projects = await dbService.listProjects().catch(() => []);
        if (projects.length > 0) {
          await get().loadProject(projects[0].id).catch(() => {});
        }
      } catch (err) {
        console.warn('Init error handled:', err);
      } finally {
        set({ isLoading: false });
      }
    },

    newProject: (name) => {
      const project = createDefaultProject(name);
      set({ project, selectedPadId: null, playingPadIds: new Set(), currentStep: 0, isPlayingSequencer: false });
      debouncedSave(get);
    },

    loadProject: async (id) => {
      const stored = await dbService.loadProject(id);
      if (!stored) return false;
      try {
        const parsed = JSON.parse(stored.projectJson) as Project;
        const defaultProj = createDefaultProject();
        const assets = get().assets;
        const assetIdSet = new Set(assets.map((a) => a.id));

        const project: Project = {
          ...defaultProj,
          ...parsed,
          metronomeOn: parsed.metronomeOn ?? false,
          quantize: parsed.quantize ?? '1/16',
          banks: (parsed.banks?.length ? parsed.banks : defaultProj.banks).map((bank) => ({
            ...bank,
            pads: bank.pads.map((pad, idx) => {
              const hasUserAsset = pad.assetId && assetIdSet.has(pad.assetId);
              const userAsset = hasUserAsset ? assets.find((a) => a.id === pad.assetId) : null;
              const padNum = String(idx + 1).padStart(2, '0');
              return {
                ...pad,
                name: userAsset ? userAsset.name : `PAD ${padNum}`,
                assetId: userAsset ? userAsset.id : null,
              };
            }),
          })),
        };
        set({ project, selectedPadId: null, playingPadIds: new Set(), currentStep: 0, isPlayingSequencer: false });
        await get().preloadAssets().catch(() => {});
        return true;
      } catch {
        return false;
      }
    },

    saveProject: async () => {
      const { project } = get();
      set({ isSaving: true });
      try {
        const json = JSON.stringify(project);
        await dbService.saveProject(json, project.id, project.name, project.createdAt, project.updatedAt);
      } finally {
        set({ isSaving: false });
      }
    },

    setProjectName: (name) => {
      set((s) => ({
        project: { ...s.project, name, updatedAt: Date.now() },
      }));
      debouncedSave(get);
    },

    setActiveBank: (bankId) => {
      set((s) => ({
        project: { ...s.project, activeBankId: bankId, updatedAt: Date.now() },
        selectedPadId: null,
      }));
      debouncedSave(get);
    },

    selectPad: (padId) => set({ selectedPadId: padId }),

    updatePad: (padId, updates) => {
      set((s) => ({
        project: updatePadInProject(s.project, padId, (pad) => ({ ...pad, ...updates })),
      }));
      if (typeof updates.volume === 'number') {
        audioEngine.updatePadVolume(padId, updates.volume * get().project.masterVolume);
      }
      debouncedSave(get);
    },

    assignAssetToPad: (padId, assetId) => {
      const asset = get().assets.find((a) => a.id === assetId);
      get().updatePad(padId, { assetId, name: asset ? asset.name : undefined });
    },

    clearPad: (padId) => {
      const bank = getActiveBank(get().project);
      const padIndex = bank.pads.findIndex((p) => p.id === padId);
      const padNum = String(padIndex >= 0 ? padIndex + 1 : 1).padStart(2, '0');
      get().stopPad(padId);
      get().updatePad(padId, { assetId: null, name: `PAD ${padNum}` });
    },

    setMasterVolume: (volume) => {
      set((s) => ({
        project: { ...s.project, masterVolume: volume, updatedAt: Date.now() },
      }));
      audioEngine.setMasterVolume(volume);
      debouncedSave(get);
    },

    uploadFiles: async (files) => {
      const fileArray = Array.from(files);
      const uploaded: AudioAsset[] = [];

      for (const file of fileArray) {
        const meta = await dbService.saveAsset(file);
        const blob = await dbService.getAssetBlob(meta.id);
        if (blob) {
          const arrayBuffer = await blob.arrayBuffer();
          const buffer = await audioEngine.decodeAndCache(meta.id, arrayBuffer);
          meta.duration = buffer.duration;
          await dbService.updateAssetMeta(meta);
        }
        uploaded.push(meta);
      }

      set((s) => ({
        assets: [...uploaded, ...s.assets],
        project: {
          ...s.project,
          libraryAssetIds: [
            ...new Set([...s.project.libraryAssetIds, ...uploaded.map((a) => a.id)]),
          ],
          updatedAt: Date.now(),
        },
      }));

      debouncedSave(get);
      return uploaded;
    },

    deleteAsset: async (assetId) => {
      await dbService.deleteAsset(assetId);
      audioEngine.removeBuffer(assetId);

      set((s) => ({
        assets: s.assets.filter((a) => a.id !== assetId),
        project: {
          ...s.project,
          libraryAssetIds: s.project.libraryAssetIds.filter((id) => id !== assetId),
          banks: s.project.banks.map((bank) => ({
            ...bank,
            pads: bank.pads.map((pad) =>
              pad.assetId === assetId ? { ...pad, assetId: null } : pad,
            ),
          })),
          updatedAt: Date.now(),
        },
      }));

      debouncedSave(get);
    },

    preloadAssets: async () => {
      const assets = get().assets.length ? get().assets : await dbService.getAllAssets();
      set({ assets });

      for (const asset of assets) {
        if (!audioEngine.hasBuffer(asset.id)) {
          const blob = await dbService.getAssetBlob(asset.id);
          if (blob) {
            const arrayBuffer = await blob.arrayBuffer();
            await audioEngine.decodeAndCache(asset.id, arrayBuffer);
          }
        }
      }
    },

    triggerPad: async (padId, pitchShift = 0) => {
      await audioEngine.ensureContext();
      const { project, is16Levels, selectedPadId } = get();
      const bank = getActiveBank(project);

      const DEFAULT_PAD_SYNTHS = [
        'default-synth-vocal1',
        'default-synth-vocal2',
        'default-synth-vocal3',
        'default-synth-vocal4',
        'default-synth-father',
        'default-synth-badtous',
        'default-synth-seethiscoat',
        'default-synth-lordfast',
        'default-synth-beatloop',
        'default-synth-intro',
        'default-synth-guitar',
        'default-synth-lordlong',
        'default-synth-808',
        'default-synth-stop',
        'default-synth-cameraclick',
        'default-synth-info',
      ];

      const padIndex = bank.pads.findIndex((p) => p.id === padId);
      const defaultSynthId = DEFAULT_PAD_SYNTHS[padIndex >= 0 ? padIndex % 16 : 0];

      // In 16-Levels mode, use the selected pad's sample and pitch-shift it
      let targetPad = bank.pads.find((p) => p.id === padId);
      if (is16Levels && selectedPadId) {
        const sourcePad = bank.pads.find((p) => p.id === selectedPadId);
        if (sourcePad) {
          const sourceAssetId = sourcePad.assetId || DEFAULT_PAD_SYNTHS[bank.pads.findIndex((p) => p.id === selectedPadId) % 16];
          targetPad = {
            ...sourcePad,
            id: padId,
            assetId: sourceAssetId,
            tune: pitchShift || 0,
          };
        }
      }

      if (!targetPad || targetPad.muted) return;
      const soundAssetId = targetPad.assetId || defaultSynthId;

      // Handle Stop button pad (Pad 14 by default)
      if (soundAssetId === 'default-synth-stop' || targetPad.name.toLowerCase() === 'stop') {
        get().stopAll();
        get().setPlayingPad(padId, true);
        setTimeout(() => get().setPlayingPad(padId, false), 150);
        return;
      }

      // Handle Info button pad (Pad 16 by default)
      if (soundAssetId === 'default-synth-info' || targetPad.name.toLowerCase().includes('info')) {
        useUIStore.getState().setInfoModalOpen(true);
      }

      const hasSolo = bank.pads.some((p) => p.solo);
      if (hasSolo && !targetPad.solo) return;

      if (targetPad.exclusive) {
        audioEngine.stopPad(padId);
      }

      const effectiveVolume = targetPad.volume * project.masterVolume;
      await audioEngine.playPad({
        padId,
        assetId: soundAssetId,
        volume: effectiveVolume,
        pan: targetPad.pan ?? 0,
        tune: targetPad.tune ?? 0,
        cutoff: targetPad.cutoff ?? 20000,
        loop: targetPad.loop || (soundAssetId === 'default-synth-beatloop'),
        exclusive: targetPad.exclusive,
      });

      get().setPlayingPad(padId, true);

      // Live overdub: stamp this pad hit into the sequencer grid
      if (get().isRecording && get().isPlayingSequencer) {
        get().stampPadHitToSequencer(padId);
      }
    },

    stopPad: (padId) => {
      audioEngine.stopPad(padId, 0.05);
      get().setPlayingPad(padId, false);
    },

    stopAll: () => {
      get().stopSequencer();
      audioEngine.stopAll(0.08);
      set({ playingPadIds: new Set(), isPaused: false });
    },

    pauseAll: () => {
      audioEngine.pauseAll();
      set({ isPaused: true });
    },

    resumeAll: async () => {
      await audioEngine.resumeAll();
      set({ isPaused: false });
    },

    setPlayingPad: (padId, playing) => {
      set((s) => {
        const next = new Set(s.playingPadIds);
        if (playing) next.add(padId);
        else next.delete(padId);
        return { playingPadIds: next };
      });
    },

    setVuLevel: (padId, level) => {
      set((s) => ({ vuLevels: { ...s.vuLevels, [padId]: level } }));
    },

    setMasterLevel: (level) => set({ masterLevel: level }),
  })),
);

export type { PadColor };
