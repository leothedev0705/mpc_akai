import { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { useProjectStore } from '@/stores/projectStore';
import { useUIStore } from '@/stores/uiStore';
import { getActiveBank } from '@/utils';
import { dbService } from '@/services/storageService';
import { cn } from '@/utils/cn';

export function WaveformDisplay() {
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const [isReady, setIsReady] = useState(false);

  const project = useProjectStore((s) => s.project);
  const assets = useProjectStore((s) => s.assets);
  const waveformPadId = useUIStore((s) => s.waveformPadId);
  const selectedPadId = useProjectStore((s) => s.selectedPadId);

  const activePadId = waveformPadId ?? selectedPadId;
  const bank = getActiveBank(project);
  const pad = bank.pads.find((p) => p.id === activePadId);
  const asset = pad?.assetId ? assets.find((a) => a.id === pad.assetId) : undefined;

  useEffect(() => {
    if (!containerRef.current) return;

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: '#333',
      progressColor: '#00E5FF',
      cursorColor: '#00E5FF',
      cursorWidth: 2,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      height: 64,
      normalize: true,
      interact: true,
    });

    wavesurferRef.current = ws;

    ws.on('ready', () => setIsReady(true));
    ws.on('interaction', () => {
      /* click seek enabled via interact: true */
    });

    return () => {
      ws.destroy();
      wavesurferRef.current = null;
      setIsReady(false);
    };
  }, []);

  useEffect(() => {
    const ws = wavesurferRef.current;
    if (!ws || !asset) {
      ws?.empty();
      setIsReady(false);
      return;
    }

    let cancelled = false;

    async function load() {
      const blob = await dbService.getAssetBlob(asset!.id);
      if (!blob || cancelled) return;
      const url = URL.createObjectURL(blob);
      await ws!.load(url);
      URL.revokeObjectURL(url);
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [asset?.id]);

  return (
    <div className="px-4 py-2 border-t border-white/6">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] text-muted uppercase tracking-wider">
          Waveform
          {asset && <span className="text-text ml-2 normal-case">{asset.name}</span>}
        </span>
        {isReady && asset && (
          <span className="text-[10px] font-mono text-muted">
            Click to seek
          </span>
        )}
      </div>
      <div
        ref={containerRef}
        className={cn(
          'rounded-lg overflow-hidden bg-surface-2/50 min-h-[64px]',
          !asset && 'flex items-center justify-center',
        )}
      >
        {!asset && (
          <span className="text-xs text-muted/50 absolute">Assign audio to a pad to view waveform</span>
        )}
      </div>
    </div>
  );
}
