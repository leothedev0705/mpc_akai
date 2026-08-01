import { create } from 'zustand';

type SidebarPanel = 'banks' | 'library' | 'projects';
type ModalType = 'settings' | 'load' | 'save' | null;

interface UIState {
  leftPanel: SidebarPanel;
  rightSidebarOpen: boolean;
  settingsOpen: boolean;
  loadModalOpen: boolean;
  activeModal: ModalType;
  waveformPadId: string | null;

  setLeftPanel: (panel: SidebarPanel) => void;
  setRightSidebarOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setLoadModalOpen: (open: boolean) => void;
  setActiveModal: (modal: ModalType) => void;
  setWaveformPadId: (padId: string | null) => void;
}

export const useUIStore = create<UIState>((set) => ({
  leftPanel: 'banks',
  rightSidebarOpen: true,
  settingsOpen: false,
  loadModalOpen: false,
  activeModal: null,
  waveformPadId: null,

  setLeftPanel: (panel) => set({ leftPanel: panel }),
  setRightSidebarOpen: (open) => set({ rightSidebarOpen: open }),
  setSettingsOpen: (open) => set({ settingsOpen: open, activeModal: open ? 'settings' : null }),
  setLoadModalOpen: (open) => set({ loadModalOpen: open, activeModal: open ? 'load' : null }),
  setActiveModal: (modal) => set({ activeModal: modal }),
  setWaveformPadId: (padId) => set({ waveformPadId: padId }),
}));
