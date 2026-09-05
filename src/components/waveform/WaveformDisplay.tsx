import { useCallback, useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { toast } from 'sonner';
import { useProjectStore } from '@/stores/projectStore';
import { useUIStore } from '@/stores/uiStore';
import { getActiveBank } from '@/utils';
import { dbService } from '@/services/storageService';
import { audioEngine } from '@/services/audioEngine';
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

  // Trim state (normalized 0–1)
  const [region, setRegion] = useState<RegionData>({ startRatio: 0, endRatio: 1 });
  const draggingRef = useRef<'start' | 'end' | null>(null);

  const project = useProjectStore((s) => s.project);
  const assets = useProjectStore((s) => s.assets);
  const chopToPads = useProjectStore((s) => s.chopToPads);
  const updatePad = useProjectStore((s) => s.updatePad);
  const assignAssetToPad = useProjectStore((s) => s.assignAssetToPad);
  const selectPad = useProjectStore((s) => s.selectPad);
  const waveformPadId = useUIStore((s) => s.waveformPadId);
  const selectedPadId = useProjectStore((s) => s.selectedPadId);

  const bank = getActiveBank(project);
  const activePadId = waveformPadId ?? selectedPadId ?? bank.pads[0]?.id;
  const pad = bank.pads.find((p) => p.id === activePadId);
  const asset = pad?.assetId ? assets.find((a) => a.id === pad.assetId?.split(':chop:')[0]) : undefined;

  // Selected target pad for manual chop assignment
  const [targetPadId, setTargetPadId] = useState<string>(activePadId);

  useEffect(() => {
    if (activePadId) {
      setTargetPadId(activePadId);
    }
  }, [activePadId]);

  // Restore trim state from pad config
  useEffect(() => {
    if (pad) {
      setRegion({
        startRatio: pad.startOffset ?? 0,
        endRatio: pad.endOffset ?? 1,
      });
    }
  }, [pad?.id, pad?.startOffset, pad?.endOffset]);

  useEffect(() => {
    if (!containerRef.current) return;

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: '#262626',
      progressColor: '#00E5FF',
      cursorColor: '#00E5FF',
      cursorWidth: 2,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      height: 76,
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
            return { ...prev, startRatio: Math.min(ratio, prev.endRatio - 0.01) };
          } else {
            return { ...prev, endRatio: Math.max(ratio, prev.startRatio + 0.01) };
          }
        });
      };

      const onMouseUp = () => {
        draggingRef.current = null;
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        // Save trim to currently active pad
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

  const handleAuditionSelection = useCallback(() => {
    if (!asset) return;
    const ws = wavesurferRef.current;
    if (ws && isReady) {
      const duration = ws.getDuration();
      ws.setTime(region.startRatio * duration);
      ws.play();
      // Stop at OUT marker
      const playDurationMs = (region.endRatio - region.startRatio) * duration * 1000;
      setTimeout(() => {
        ws.pause();
      }, Math.max(50, playDurationMs));
    }
  }, [asset, isReady, region.startRatio, region.endRatio]);

  const handleStopAudition = useCallback(() => {
    wavesurferRef.current?.pause();
    audioEngine.stopAll();
  }, []);

  const handleAssignSliceToPad = useCallback(() => {
    if (!asset || !targetPadId) return;

    const targetPadIndex = bank.pads.findIndex((p) => p.id === targetPadId);
    const targetPadNum = String(targetPadIndex + 1).padStart(2, '0');
    const sliceLabel = `${asset.name} [Slice PAD ${targetPadNum}]`;

    assignAssetToPad(targetPadId, asset.id);
    updatePad(targetPadId, {
      name: sliceLabel,
      startOffset: region.startRatio,
      endOffset: region.endRatio,
      exclusive: true,
    });

    toast.success(`Assigned custom slice to PAD ${targetPadNum}!`);

    // Auto-advance target pad to next pad for easy sequential chopping
    const nextIndex = (targetPadIndex + 1) % bank.pads.length;
    const nextPad = bank.pads[nextIndex];
    if (nextPad) {
      setTargetPadId(nextPad.id);
      selectPad(nextPad.id);
    }
  }, [asset, targetPadId, bank.pads, assignAssetToPad, updatePad, region.startRatio, region.endRatio, selectPad]);

  const handleAutoChopAll = useCallback(async () => {
    if (!asset?.id) return;
    setIsChopping(true);
    try {
      await chopToPads(asset.id);
      toast.success(`Auto-chopped "${asset.name}" to all 16 pads!`);
    } finally {
      setIsChopping(false);
    }
  }, [asset?.id, chopToPads]);

  const totalDurationSec = wavesurferRef.current?.getDuration() ?? asset?.duration ?? 0;
  const startSec = (region.startRatio * totalDurationSec).toFixed(2);
  const endSec = (region.endRatio * totalDurationSec).toFixed(2);
  const sliceLenSec = Math.max(0, (region.endRatio - region.startRatio) * totalDurationSec).toFixed(2);

  return (
    <div className="px-3 py-2.5 border-t border-white/6 space-y-2.5 bg-black/30">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span className="text-[10px] text-muted uppercase tracking-wider font-mono font-bold flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#00E5FF] animate-pulse" />
          Sample Editor
          {asset && <span className="text-text ml-1 normal-case text-xs font-sans font-semibold">{asset.name}</span>}
        </span>

        {/* Audition & Action controls */}
        <div className="flex items-center gap-1.5">
          {isReady && asset && (
            <>
              <button
                onClick={handleAuditionSelection}
                className="text-[10px] px-2 py-1 rounded bg-[#00E5FF]/20 hover:bg-[#00E5FF]/30 text-[#00E5FF] font-bold border border-[#00E5FF]/40 transition-colors touch-manipulation cursor-pointer flex items-center gap-1"
              >
                ▶ AUDITION SELECTION
              </button>
              <button
                onClick={handleStopAudition}
                className="text-[10px] px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-text font-bold transition-colors touch-manipulation cursor-pointer"
              >
                ■ STOP
              </button>
            </>
          )}
          {asset && (
            <button
              onClick={handleAutoChopAll}
              disabled={isChopping}
              className={cn(
                'text-[10px] px-2 py-1 rounded font-bold transition-all touch-manipulation cursor-pointer',
                'bg-white/5 hover:bg-white/10 text-neutral-300 border border-white/10',
                isChopping && 'opacity-50 cursor-not-allowed',
              )}
            >
              {isChopping ? 'CHOPPING…' : '⚡ AUTO CHOP 16'}
            </button>
          )}
        </div>
      </div>

      {/* Waveform Canvas with Draggable IN and OUT Handles */}
      <div className="relative select-none">
        <div
          ref={containerRef}
          className={cn(
            'rounded-lg overflow-hidden bg-[#0a0a0d] border border-white/5 min-h-[76px]',
            !asset && 'flex items-center justify-center',
          )}
        >
          {!asset && (
            <span className="text-xs text-muted/40 font-mono py-6">
              Assign or load an audio file to view waveform & create custom chops
            </span>
          )}
        </div>

        {/* Trim region overlay */}
        {isReady && asset && (
          <>
            {/* Dark overlay for trimmed-off regions */}
            <div
              className="absolute top-0 bottom-0 bg-black/60 pointer-events-none rounded-l-lg"
              style={{ left: 0, width: `${region.startRatio * 100}%` }}
            />
            <div
              className="absolute top-0 bottom-0 bg-black/60 pointer-events-none rounded-r-lg"
              style={{ left: `${region.endRatio * 100}%`, right: 0 }}
            />

            {/* Active Selection Highlight */}
            <div
              className="absolute top-0 bottom-0 bg-[#00E5FF]/10 pointer-events-none border-t-2 border-b-2 border-[#00E5FF]/40"
              style={{
                left: `${region.startRatio * 100}%`,
                width: `${(region.endRatio - region.startRatio) * 100}%`,
              }}
            />

            {/* START (IN) Handle */}
            <div
              className="absolute top-0 bottom-0 w-1.5 bg-[#2EEB8B] cursor-ew-resize z-20 group shadow-[0_0_8px_#2EEB8B]"
              style={{ left: `${region.startRatio * 100}%` }}
              onMouseDown={handleRegionMouseDown('start')}
            >
              <div className="absolute top-0 left-0 -translate-x-1/2 text-[9px] text-black font-extrabold select-none whitespace-nowrap bg-[#2EEB8B] px-1 rounded-b shadow-md">
                IN
              </div>
            </div>

            {/* END (OUT) Handle */}
            <div
              className="absolute top-0 bottom-0 w-1.5 bg-[#FF5555] cursor-ew-resize z-20 group shadow-[0_0_8px_#FF5555]"
              style={{ left: `${region.endRatio * 100}%` }}
              onMouseDown={handleRegionMouseDown('end')}
            >
              <div className="absolute top-0 left-0 -translate-x-1/2 text-[9px] text-white font-extrabold select-none whitespace-nowrap bg-[#FF5555] px-1 rounded-b shadow-md">
                OUT
              </div>
            </div>
          </>
        )}
      </div>

      {/* Manual Chop Control Bar */}
      {isReady && asset && (
        <div className="flex items-center justify-between flex-wrap gap-2 pt-1 border-t border-white/5">
          {/* Slice timing readout */}
          <div className="text-[10px] font-mono text-neutral-400 flex items-center gap-3">
            <span>IN: <strong className="text-[#2EEB8B]">{startSec}s</strong></span>
            <span>OUT: <strong className="text-[#FF5555]">{endSec}s</strong></span>
            <span>LEN: <strong className="text-[#00E5FF]">{sliceLenSec}s</strong></span>
          </div>

          {/* Manual Chop Assignment Bar */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-neutral-400">ASSIGN SLICE TO:</span>
            <select
              value={targetPadId}
              onChange={(e) => {
                setTargetPadId(e.target.value);
                selectPad(e.target.value);
              }}
              className="bg-neutral-900 border border-neutral-700 text-xs font-mono text-white rounded px-2 py-1 outline-none focus:border-[#00E5FF]"
            >
              {bank.pads.map((p, i) => (
                <option key={p.id} value={p.id}>
                  Pad {String(i + 1).padStart(2, '0')}: {p.name}
                </option>
              ))}
            </select>

            <button
              onClick={handleAssignSliceToPad}
              className="text-[11px] px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all shadow-md touch-manipulation cursor-pointer flex items-center gap-1"
            >
              📌 ASSIGN SLICE TO PAD
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
