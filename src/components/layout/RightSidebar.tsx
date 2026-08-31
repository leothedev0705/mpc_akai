import { useMemo, useRef } from 'react';
import { Trash2, Repeat, Volume2, Upload, Scissors, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useProjectStore } from '@/stores/projectStore';
import { useUIStore } from '@/stores/uiStore';
import { getActiveBank } from '@/utils';
import { PAD_COLORS, type PadColor } from '@/types';
import { Slider } from '@/components/ui/Slider';
import { Toggle } from '@/components/ui/Toggle';
import { Button } from '@/components/ui/Button';
import { cn } from '@/utils/cn';

export function RightSidebar() {
  const project = useProjectStore((s) => s.project);
  const assets = useProjectStore((s) => s.assets);
  const selectedPadId = useProjectStore((s) => s.selectedPadId);
  const updatePad = useProjectStore((s) => s.updatePad);
  const clearPad = useProjectStore((s) => s.clearPad);
  const uploadFiles = useProjectStore((s) => s.uploadFiles);
  const assignAssetToPad = useProjectStore((s) => s.assignAssetToPad);
  const chopToPads = useProjectStore((s) => s.chopToPads);
  const setWaveformPadId = useUIStore((s) => s.setWaveformPadId);
  const rightSidebarOpen = useUIStore((s) => s.rightSidebarOpen);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const bank = getActiveBank(project);
  const pad = useMemo(
    () => bank.pads.find((p) => p.id === selectedPadId),
    [bank.pads, selectedPadId],
  );
  const asset = useMemo(
    () => (pad?.assetId ? assets.find((a) => a.id === pad.assetId) : undefined),
    [pad, assets],
  );

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0 || !pad) return;
    try {
      const uploaded = await uploadFiles(files);
      if (uploaded.length > 0) {
        assignAssetToPad(pad.id, uploaded[0].id);
        toast.success(`Assigned "${uploaded[0].name}" to Pad ${String(bank.pads.findIndex(p => p.id === pad.id) + 1).padStart(2, '0')}`);
      }
    } catch (err) {
      console.error('Failed to load audio file:', err);
      toast.error('Failed to load audio file');
    }
  };

  const handleChop = async () => {
    if (!pad?.assetId) return;
    try {
      const realAssetId = pad.assetId.split(':chop:')[0];
      await chopToPads(realAssetId);
      toast.success('Chopped sample across all 16 pads!');
    } catch (err) {
      console.error('Chop failed:', err);
      toast.error('Chop failed');
    }
  };

  if (!rightSidebarOpen) return null;

  return (
    <aside className="glass w-72 shrink-0 flex flex-col border-l border-white/6 overflow-hidden">
      <div className="px-4 py-3 border-b border-white/6">
        <h3 className="text-xs font-semibold text-muted uppercase tracking-wider">Pad Details</h3>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {!pad ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-2">
            <div className="w-12 h-12 rounded-xl bg-surface-2 flex items-center justify-center">
              <Volume2 size={20} className="text-muted" />
            </div>
            <p className="text-sm text-muted">Select a pad to edit</p>
            <p className="text-[10px] text-muted/60">Click any pad in the grid</p>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Custom Beat / Audio Load Section */}
            <div className="p-3 rounded-xl bg-accent/5 border border-accent/20 space-y-2">
              <span className="text-[10px] font-mono text-accent font-bold uppercase tracking-wider block">
                Assign Custom Audio / Beat
              </span>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-2 px-3 rounded-lg bg-accent/20 hover:bg-accent/30 text-accent font-bold text-xs flex items-center justify-center gap-2 border border-accent/40 transition-all cursor-pointer touch-manipulation"
              >
                <Upload size={14} />
                <span>LOAD AUDIO / BEAT FILE</span>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*,.wav,.mp3,.ogg,.flac,.aac,.m4a,.webm"
                className="hidden"
                onChange={(e) => void handleFileUpload(e.target.files)}
              />

              <p className="text-[9px] text-muted text-center">
                Supports WAV, MP3, M4A, OGG, FLAC & WebM
              </p>

              {pad.assetId && (
                <div className="flex gap-1.5 pt-1">
                  <button
                    onClick={handleChop}
                    className="flex-1 py-1 px-2 rounded bg-cyan-950/60 hover:bg-cyan-900/80 text-[#00E5FF] text-[10px] font-bold border border-[#00E5FF]/30 flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Scissors size={12} />
                    CHOP 16
                  </button>
                  <button
                    onClick={() => clearPad(pad.id)}
                    className="py-1 px-2 rounded bg-white/5 hover:bg-white/10 text-muted hover:text-white text-[10px] font-bold border border-white/10 flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw size={11} />
                    RESET
                  </button>
                </div>
              )}
            </div>

            {/* Name */}
            <div>
              <label className="text-xs text-muted block mb-1.5">Pad Display Name</label>
              <input
                type="text"
                value={pad.name || `PAD ${String(bank.pads.findIndex(p => p.id === pad.id) + 1).padStart(2, '0')}`}
                onChange={(e) => updatePad(pad.id, { name: e.target.value })}
                className="w-full bg-surface-2 border border-white/8 rounded-lg px-3 py-2 text-sm outline-none focus:border-accent/40 transition-colors font-mono"
              />
            </div>

            {/* Asset info */}
            {asset && (
              <div className="p-3 rounded-lg bg-surface-2 border border-white/6">
                <p className="text-xs text-muted mb-1">Assigned Audio File</p>
                <p className="text-sm font-medium truncate">{asset.name}</p>
                <p className="text-[10px] text-muted mt-1 capitalize">{asset.type}</p>
              </div>
            )}

            {/* Volume */}
            <Slider
              label={`Volume (${Math.round(pad.volume * 100)}%)`}
              value={pad.volume}
              onChange={(v) => updatePad(pad.id, { volume: v })}
            />

            {/* Stereo Pan */}
            <div>
              <div className="flex justify-between items-center text-xs text-muted mb-1.5">
                <span>Stereo Pan</span>
                <span className="font-mono text-[11px] text-neutral-300">
                  {(pad.pan ?? 0) === 0 ? 'Center' : (pad.pan ?? 0) < 0 ? `L ${Math.round(Math.abs(pad.pan ?? 0) * 100)}%` : `R ${Math.round((pad.pan ?? 0) * 100)}%`}
                </span>
              </div>
              <input
                type="range"
                min="-1"
                max="1"
                step="0.05"
                value={pad.pan ?? 0}
                onChange={(e) => updatePad(pad.id, { pan: parseFloat(e.target.value) })}
                className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-[#ff4500]"
              />
              <div className="flex justify-between text-[8px] font-mono text-neutral-500 mt-1">
                <span>L</span>
                <button
                  onClick={() => updatePad(pad.id, { pan: 0 })}
                  className="hover:text-neutral-300 cursor-pointer underline text-[8px]"
                >
                  CENTER
                </button>
                <span>R</span>
              </div>
            </div>

            {/* Pitch Tuning / Semitones */}
            <div>
              <div className="flex justify-between items-center text-xs text-muted mb-1.5">
                <span>Pitch / Tune</span>
                <span className="font-mono text-[11px] text-neutral-300">
                  {(pad.tune ?? 0) > 0 ? `+${pad.tune} st` : `${pad.tune ?? 0} st`}
                </span>
              </div>
              <input
                type="range"
                min="-12"
                max="12"
                step="1"
                value={pad.tune ?? 0}
                onChange={(e) => updatePad(pad.id, { tune: parseInt(e.target.value, 10) })}
                className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-[#ff4500]"
              />
              <div className="flex justify-between text-[8px] font-mono text-neutral-500 mt-1">
                <span>-12 st</span>
                <button
                  onClick={() => updatePad(pad.id, { tune: 0 })}
                  className="hover:text-neutral-300 cursor-pointer underline text-[8px]"
                >
                  0 st
                </button>
                <span>+12 st</span>
              </div>
            </div>

            {/* Lowpass Filter Cutoff */}
            <div>
              <div className="flex justify-between items-center text-xs text-muted mb-1.5">
                <span>Lowpass Filter</span>
                <span className="font-mono text-[11px] text-neutral-300">
                  {(pad.cutoff ?? 20000) >= 19500 ? 'Bypass (Open)' : `${Math.round(pad.cutoff ?? 20000)} Hz`}
                </span>
              </div>
              <input
                type="range"
                min="200"
                max="20000"
                step="200"
                value={pad.cutoff ?? 20000}
                onChange={(e) => updatePad(pad.id, { cutoff: parseFloat(e.target.value) })}
                className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-[#ff4500]"
              />
            </div>

            {/* Shortcut */}
            <div>
              <label className="text-xs text-muted block mb-1.5">Keyboard Shortcut</label>
              <input
                type="text"
                value={pad.shortcut === ' ' ? 'SPACE' : pad.shortcut}
                maxLength={5}
                onChange={(e) => {
                  const val = e.target.value.toUpperCase();
                  updatePad(pad.id, { shortcut: val === 'SPACE' ? ' ' : val.slice(0, 1) });
                }}
                className="w-20 bg-surface-2 border border-white/8 rounded-lg px-3 py-2 text-sm font-mono text-center outline-none focus:border-accent/40"
              />
            </div>

            {/* Color */}
            <div>
              <label className="text-xs text-muted block mb-2">Pad Color Theme</label>
              <div className="flex flex-wrap gap-2">
                {PAD_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => updatePad(pad.id, { color: color as PadColor })}
                    className={cn(
                      'w-7 h-7 rounded-lg transition-transform hover:scale-110 cursor-pointer',
                      pad.color === color && 'ring-2 ring-white/40 ring-offset-2 ring-offset-background',
                    )}
                    style={{ backgroundColor: color }}
                    aria-label={`Set color ${color}`}
                  />
                ))}
              </div>
            </div>

            {/* Toggles */}
            <div className="space-y-3 pt-2 border-t border-white/6">
              <Toggle
                label="Loop Mode"
                checked={pad.loop}
                onChange={(v) => updatePad(pad.id, { loop: v })}
              />
              <Toggle
                label="Exclusive Cut Group"
                checked={pad.exclusive}
                onChange={(v) => updatePad(pad.id, { exclusive: v })}
              />
              <Toggle
                label="Mute"
                checked={pad.muted}
                onChange={(v) => updatePad(pad.id, { muted: v })}
              />
              <Toggle
                label="Solo"
                checked={pad.solo}
                onChange={(v) => updatePad(pad.id, { solo: v })}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button
                variant="accent"
                size="sm"
                className="flex-1 cursor-pointer bg-red-600 hover:bg-red-500 font-bold"
                onClick={() => void useProjectStore.getState().triggerPad(pad.id)}
              >
                <Volume2 size={14} className="mr-1" />
                Audition Pad
              </Button>
              {asset && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="border border-white/10 hover:text-white cursor-pointer"
                  onClick={() => setWaveformPadId(pad.id)}
                >
                  <Repeat size={14} />
                </Button>
              )}
              <Button variant="danger" size="sm" onClick={() => clearPad(pad.id)} className="cursor-pointer">
                <Trash2 size={14} />
              </Button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
