import { useCallback, useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { useProjectStore } from '@/stores/projectStore';
import { useUIStore } from '@/stores/uiStore';
import { getActiveBank } from '@/utils';
import { dbService } from '@/services/storageService';
import { cn } from '@/utils/cn';

interface RegionData {
  startRatio: number; // 0–1
  endRatio: number;   // 0–1
}

export function WaveformDisplay() {
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isChopping, setIsChopping] = useState(false);
  const [chopDone, setChopDone] = useState(false);

  // Trim state (normalized 0–1)
  const [region, setRegion] = useState<RegionData>({ startRatio: 0, endRatio: 1 });
  const draggingRef = useRef<'start' | 'end' | null>(null);

  const project = useProjectStore((s) => s.project);
  const assets = useProjectStore((s) => s.assets);
  const chopToPads = useProjectStore((s) => s.chopToPads);
  const updatePad = useProjectStore((s) => s.updatePad);
  const waveformPadId = useUIStore((s) => s.waveformPadId);
  const selectedPadId = useProjectStore((s) => s.selectedPadId);

  const activePadId = waveformPadId ?? selectedPadId;
  const bank = getActiveBank(project);
  const pad = bank.pads.find((p) => p.id === activePadId);
  const asset = pad?.assetId ? assets.find((a) => a.id === pad.assetId) : undefined;

  // Restore trim state from pad config
  useEffect(() => {
    if (pad) {
      setRegion({
        startRatio: pad.startOffset ?? 0,
        endRatio: pad.endOffset ?? 1,
      });
    }
    setChopDone(false);
  }, [pad?.id, pad?.startOffset, pad?.endOffset]);

  useEffect(() => {
    if (!containerRef.current) return;

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: '#1a1a1a',
      progressColor: '#00E5FF',
      cursorColor: '#00E5FF',
      cursorWidth: 2,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      height: 72,
      normalize: true,
      interact: true,
    });

    wavesurferRef.current = ws;
    ws.on('ready', () => setIsReady(true));

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

    return () => { cancelled = true; };
  }, [asset?.id]);

  // --- Trim marker drag handlers ---
  const handleRegionMouseDown = useCallback(
    (handle: 'start' | 'end') => (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      draggingRef.current = handle;

      const onMouseMove = (mv: MouseEvent) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (mv.clientX - rect.left) / rect.width));
        setRegion((prev) => {
          if (draggingRef.current === 'start') {
            return { ...prev, startRatio: Math.min(ratio, prev.endRatio - 0.02) };
          } else {
            return { ...prev, endRatio: Math.max(ratio, prev.startRatio + 0.02) };
          }
        });
      };

      const onMouseUp = () => {
        draggingRef.current = null;
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        // Save trim to pad
        if (activePadId) {
          setRegion((r) => {
            updatePad(activePadId, { startOffset: r.startRatio, endOffset: r.endRatio });
            return r;
          });
        }
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    },
    [activePadId, updatePad],
  );

  const handleChop = useCallback(async () => {
    if (!asset?.id) return;
    setIsChopping(true);
    try {
      await chopToPads(asset.id);
      setChopDone(true);
    } finally {
      setIsChopping(false);
    }
  }, [asset?.id, chopToPads]);

  const handlePlay = useCallback(() => {
    const ws = wavesurferRef.current;
    if (!ws || !isReady) return;
    const duration = ws.getDuration();
    if (duration > 0) {
      ws.setTime(region.startRatio * duration);
    }
    ws.play();
  }, [isReady, region.startRatio]);

  const handleStop = useCallback(() => {
    wavesurferRef.current?.pause();
  }, []);

  // Determine if the pad has a real user asset (not a chop slice ID)
  const isChopSlice = pad?.assetId?.includes(':chop:');
  const canChop = asset && !isChopSlice;

  return (
    <div className="px-3 py-2 border-t border-white/6 space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted uppercase tracking-wider">
          Waveform
          {asset && <span className="text-text ml-2 normal-case">{asset.name}</span>}
        </span>
        <div className="flex items-center gap-1">
          {isReady && (
            <>
              <button
                onClick={handlePlay}
                className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 text-text transition-colors touch-manipulation"
              >
                ▶ PLAY
              </button>
              <button
                onClick={handleStop}
                className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 text-text transition-colors touch-manipulation"
              >
                ■ STOP
              </button>
            </>
          )}
          {canChop && (
            <button
              onClick={handleChop}
              disabled={isChopping}
              className={cn(
                'text-[10px] px-2 py-0.5 rounded font-bold transition-all touch-manipulation',
                chopDone
                  ? 'bg-[#2EEB8B]/20 text-[#2EEB8B] border border-[#2EEB8B]/40'
                  : 'bg-[#00E5FF]/10 hover:bg-[#00E5FF]/20 text-[#00E5FF] border border-[#00E5FF]/30',
                isChopping && 'opacity-50 cursor-not-allowed',
              )}
            >
              {isChopping ? 'CHOPPING…' : chopDone ? '✓ CHOPPED' : '✂ CHOP TO 16 PADS'}
            </button>
          )}
        </div>
      </div>

      {/* Waveform canvas with trim handles */}
      <div className="relative">
        <div
          ref={containerRef}
          className={cn(
            'rounded-lg overflow-hidden bg-[#0a0a0a] min-h-[72px]',
            !asset && 'flex items-center justify-center',
          )}
        >
          {!asset && (
            <span className="text-xs text-muted/40">
              Drag an audio file here or assign one to a pad
            </span>
          )}
        </div>

        {/* Trim region overlay */}
        {isReady && asset && (
          <>
            {/* Dark overlay for trimmed-off regions */}
            <div
              className="absolute top-0 bottom-0 bg-black/50 pointer-events-none rounded-l-lg"
              style={{ left: 0, width: `${region.startRatio * 100}%` }}
            />
            <div
              className="absolute top-0 bottom-0 bg-black/50 pointer-events-none rounded-r-lg"
              style={{ left: `${region.endRatio * 100}%`, right: 0 }}
            />

            {/* START handle */}
            <div
              className="absolute top-0 bottom-0 w-1 bg-[#2EEB8B] cursor-ew-resize z-10 group"
              style={{ left: `${region.startRatio * 100}%` }}
              onMouseDown={handleRegionMouseDown('start')}
            >
              <div className="absolute top-1 left-0 -translate-x-1/2 text-[8px] text-[#2EEB8B] font-bold select-none whitespace-nowrap bg-black/70 px-1 rounded group-hover:opacity-100 opacity-80">
                IN
              </div>
            </div>

            {/* END handle */}
            <div
              className="absolute top-0 bottom-0 w-1 bg-[#FF5555] cursor-ew-resize z-10 group"
              style={{ left: `${region.endRatio * 100}%` }}
              onMouseDown={handleRegionMouseDown('end')}
            >
              <div className="absolute top-1 left-0 -translate-x-1/2 text-[8px] text-[#FF5555] font-bold select-none whitespace-nowrap bg-black/70 px-1 rounded group-hover:opacity-100 opacity-80">
                OUT
              </div>
            </div>
          </>
        )}
      </div>

      {/* Trim values */}
      {isReady && asset && (
        <div className="flex justify-between text-[9px] font-mono text-muted/60">
          <span>IN: {(region.startRatio * 100).toFixed(1)}%</span>
          <span className="text-muted/40">drag handles to trim</span>
          <span>OUT: {(region.endRatio * 100).toFixed(1)}%</span>
        </div>
      )}
    </div>
  );
}
