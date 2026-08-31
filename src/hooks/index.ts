import { useEffect, useCallback } from 'react';
import { audioEngine } from '@/services/audioEngine';
import { useProjectStore } from '@/stores/projectStore';
import { getActiveBank } from '@/utils';

export function useKeyboardTriggers() {
  const project = useProjectStore((s) => s.project);
  const triggerPad = useProjectStore((s) => s.triggerPad);
  const selectedPadId = useProjectStore((s) => s.selectedPadId);
  const selectPad = useProjectStore((s) => s.selectPad);
  const stopAll = useProjectStore((s) => s.stopAll);
  const setActiveBank = useProjectStore((s) => s.setActiveBank);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      // Escape key: stop all sounds
      if (e.key === 'Escape') {
        e.preventDefault();
        stopAll();
        return;
      }

      // Bank switching with 1-4 when Alt is pressed
      if (e.altKey && ['1', '2', '3', '4'].includes(e.key)) {
        e.preventDefault();
        const bankMap: Record<string, 'A' | 'B' | 'C' | 'D'> = { '1': 'A', '2': 'B', '3': 'C', '4': 'D' };
        setActiveBank(bankMap[e.key]);
        return;
      }

      const bank = getActiveBank(project);

      // Arrow navigation for 4x4 pad grid
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(e.key)) {
        e.preventDefault();
        const currentIndex = selectedPadId
          ? bank.pads.findIndex((p) => p.id === selectedPadId)
          : -1;
        
        let newIndex = currentIndex;
        if (e.key === 'ArrowUp') newIndex = currentIndex >= 4 ? currentIndex - 4 : (currentIndex === -1 ? 0 : currentIndex);
        else if (e.key === 'ArrowDown') newIndex = currentIndex < 12 && currentIndex !== -1 ? currentIndex + 4 : (currentIndex === -1 ? 0 : currentIndex);
        else if (e.key === 'ArrowLeft') newIndex = currentIndex % 4 > 0 ? currentIndex - 1 : (currentIndex === -1 ? 0 : currentIndex);
        else if (e.key === 'ArrowRight') newIndex = currentIndex % 4 < 3 && currentIndex !== -1 ? currentIndex + 1 : (currentIndex === -1 ? 0 : currentIndex);
        else if (e.key === 'Enter') {
          if (selectedPadId) void triggerPad(selectedPadId);
          return;
        }

        if (newIndex >= 0 && newIndex < bank.pads.length) {
          selectPad(bank.pads[newIndex].id);
        }
        return;
      }

      // Match pad shortcut: check letter or Space
      const isSpace = e.code === 'Space' || e.key === ' ';
      const key = isSpace ? ' ' : (e.key.length === 1 ? e.key.toUpperCase() : e.key);

      const pad = bank.pads.find((p) => {
        const sc = p.shortcut.toUpperCase();
        if (isSpace && (sc === ' ' || sc === 'SPACE' || sc === '')) return true;
        return sc === key;
      });

      if (pad) {
        e.preventDefault();
        selectPad(pad.id);
        void triggerPad(pad.id);
      }
    },
    [project, selectedPadId, selectPad, triggerPad, stopAll, setActiveBank],
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
