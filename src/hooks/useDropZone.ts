import { useCallback, useState } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import type { AudioAsset } from '@/types';

interface DropZoneOptions {
  /** Optional: auto-assign the first dropped file to this pad ID */
  padId?: string;
  onDrop?: (assets: AudioAsset[]) => void;
}

/**
 * A reusable drag-and-drop hook for audio files.
 * Returns { isDragOver, bindProps } — spread `bindProps` onto any element to make it a drop zone.
 */
export function useDropZone({ padId, onDrop }: DropZoneOptions = {}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const uploadFiles = useProjectStore((s) => s.uploadFiles);
  const assignAssetToPad = useProjectStore((s) => s.assignAssetToPad);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const files = e.dataTransfer.files;
      if (!files || files.length === 0) return;

      try {
        const uploaded = await uploadFiles(files);
        if (uploaded.length > 0) {
          if (padId) {
            assignAssetToPad(padId, uploaded[0].id);
          }
          onDrop?.(uploaded);
        }
      } catch (err) {
        console.error('[DropZone] Upload failed:', err);
      }
    },
    [uploadFiles, assignAssetToPad, padId, onDrop],
  );

  const bindProps = {
    onDragOver: handleDragOver,
    onDragLeave: handleDragLeave,
    onDrop: handleDrop,
  };

  return { isDragOver, bindProps };
}
