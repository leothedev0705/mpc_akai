import { useCallback, useRef, useState } from 'react';
import { Upload, Music, Trash2, GripVertical } from 'lucide-react';
import { toast } from 'sonner';
import { useProjectStore } from '@/stores/projectStore';
import { formatDuration, formatFileSize, isSupportedAudioFile } from '@/utils';
import { cn } from '@/utils/cn';
import type { AudioAsset } from '@/types';

export function AudioLibrary() {
  const assets = useProjectStore((s) => s.assets);
  const uploadFiles = useProjectStore((s) => s.uploadFiles);
  const deleteAsset = useProjectStore((s) => s.deleteAsset);
  const assignAssetToPad = useProjectStore((s) => s.assignAssetToPad);
  const selectedPadId = useProjectStore((s) => s.selectedPadId);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const valid = Array.from(files).filter((f) => isSupportedAudioFile(f.name));
      if (valid.length === 0) {
        toast.error('No supported audio files. Use WAV, MP3, OGG, or FLAC.');
        return;
      }
      toast.promise(uploadFiles(valid), {
        loading: `Uploading ${valid.length} file(s)...`,
        success: (uploaded) => `Loaded ${uploaded.length} audio file(s)`,
        error: 'Upload failed',
      });
    },
    [uploadFiles],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      void handleFiles(e.dataTransfer.files);
    },
    [handleFiles],
  );

  const handleAssign = (asset: AudioAsset) => {
    if (!selectedPadId) {
      toast.info('Select a pad first, then click an asset to assign');
      return;
    }
    assignAssetToPad(selectedPadId, asset.id);
    toast.success(`Assigned "${asset.name}" to pad`);
  };

  return (
    <div className="space-y-3">
      <div
        className={cn(
          'border-2 border-dashed rounded-xl p-4 text-center transition-colors cursor-pointer',
          isDragging ? 'border-accent bg-accent/5' : 'border-white/10 hover:border-white/20',
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
      >
        <Upload size={20} className="mx-auto text-muted mb-2" />
        <p className="text-xs text-muted">Drop audio files here</p>
        <p className="text-[10px] text-muted/50 mt-1">WAV, MP3, OGG, FLAC</p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".wav,.mp3,.ogg,.flac,audio/*"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && void handleFiles(e.target.files)}
        />
      </div>

      {assets.length === 0 ? (
        <p className="text-xs text-muted text-center py-4">No audio files yet</p>
      ) : (
        <ul className="space-y-1">
          {assets.map((asset) => (
            <li
              key={asset.id}
              className="group flex items-center gap-2 p-2 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
              onClick={() => handleAssign(asset)}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('application/x-mpc-asset', asset.id);
                e.dataTransfer.effectAllowed = 'copy';
              }}
            >
              <GripVertical size={12} className="text-muted/40 shrink-0" />
              <div className="w-7 h-7 rounded bg-surface-2 flex items-center justify-center shrink-0">
                <Music size={12} className="text-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{asset.name}</p>
                <p className="text-[10px] text-muted">
                  {formatDuration(asset.duration)} · {formatFileSize(asset.size)}
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  void deleteAsset(asset.id);
                  toast.success('Asset deleted');
                }}
                className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-danger/20 text-muted hover:text-danger transition-all"
                aria-label={`Delete ${asset.name}`}
              >
                <Trash2 size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
