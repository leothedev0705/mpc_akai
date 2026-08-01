import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { AudioAsset, BankId, PadColor, PadConfig, Project } from '@/types';
import {
  createDefaultProject,
  debounce,
  getActiveBank,
  updatePadInProject,
} from '@/utils';
import { dbService } from '@/services/storageService';
import { audioEngine } from '@/services/audioEngine';

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
  uploadFiles: (files: FileList | File[]) => Promise<AudioAsset[]>;
  deleteAsset: (assetId: string) => Promise<void>;
  preloadAssets: () => Promise<void>;
  triggerPad: (padId: string) => Promise<void>;
  stopPad: (padId: string) => void;
  stopAll: () => void;
  pauseAll: () => void;
  resumeAll: () => void;
  setPlayingPad: (padId: string, playing: boolean) => void;
  setVuLevel: (padId: string, level: number) => void;
  setMasterLevel: (level: number) => void;
}

const debouncedSave = debounce(async (get: () => ProjectState) => {
  const { project, saveProject } = get();
  if (project) await saveProject();
}, 1500);

export const useProjectStore = create<ProjectState>()(
  subscribeWithSelector((set, get) => ({
    project: createDefaultProject(),
    assets: [],
    selectedPadId: null,
    isLoading: true,
    isSaving: false,
    playingPadIds: new Set(),
    vuLevels: {},
    masterLevel: 0,
    isPaused: false,

    init: async () => {
      set({ isLoading: true });
      try {
        await dbService.init();
        const assets = await dbService.getAllAssets();
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

        await get().preloadAssets();

        audioEngine.setMasterVolume(get().project.masterVolume);

        const projects = await dbService.listProjects();
        if (projects.length > 0) {
          await get().loadProject(projects[0].id);
        }
      } finally {
        set({ isLoading: false });
      }
    },

    newProject: (name) => {
      const project = createDefaultProject(name);
      set({ project, selectedPadId: null, playingPadIds: new Set() });
      debouncedSave(get);
    },

    loadProject: async (id) => {
      const stored = await dbService.loadProject(id);
      if (!stored) return false;
      try {
        const project = JSON.parse(stored.projectJson) as Project;
        set({ project, selectedPadId: null, playingPadIds: new Set() });
        await get().preloadAssets();
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
      debouncedSave(get);
    },

    assignAssetToPad: (padId, assetId) => {
      get().updatePad(padId, { assetId });
    },

    clearPad: (padId) => {
      get().stopPad(padId);
      get().updatePad(padId, { assetId: null });
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

    triggerPad: async (padId) => {
      await audioEngine.ensureContext();
      const { project } = get();
      const bank = getActiveBank(project);
      const pad = bank.pads.find((p) => p.id === padId);
      if (!pad || !pad.assetId || pad.muted) return;

      const hasSolo = bank.pads.some((p) => p.solo);
      if (hasSolo && !pad.solo) return;

      if (pad.exclusive) {
        audioEngine.stopPad(padId);
      }

      const effectiveVolume = pad.volume * project.masterVolume;
      await audioEngine.playPad({
        padId,
        assetId: pad.assetId,
        volume: effectiveVolume,
        loop: pad.loop,
        exclusive: pad.exclusive,
      });

      get().setPlayingPad(padId, true);
    },

    stopPad: (padId) => {
      audioEngine.stopPad(padId, 0.05);
      get().setPlayingPad(padId, false);
    },

    stopAll: () => {
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
