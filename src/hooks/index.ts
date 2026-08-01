import { useEffect, useCallback } from 'react';
import { audioEngine } from '@/services/audioEngine';
import { useProjectStore } from '@/stores/projectStore';
import { getActiveBank } from '@/utils';

export function useKeyboardTriggers() {
  const project = useProjectStore((s) => s.project);
  const triggerPad = useProjectStore((s) => s.triggerPad);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      const key = e.key.length === 1 ? e.key.toUpperCase() : e.key;
      const bank = getActiveBank(project);
      const pad = bank.pads.find((p) => p.shortcut.toUpperCase() === key);
      if (pad) {
        e.preventDefault();
        void triggerPad(pad.id);
      }
    },
    [project, triggerPad],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

export function useAudioUnlock() {
  useEffect(() => {
    const unlock = () => void audioEngine.ensureContext();
    window.addEventListener('click', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('click', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);
}

export function useAutoSave() {
  const project = useProjectStore((s) => s.project);
  const saveProject = useProjectStore((s) => s.saveProject);

  useEffect(() => {
    const interval = setInterval(() => {
      void saveProject();
    }, 30000);
    return () => clearInterval(interval);
  }, [project.id, saveProject]);
}
