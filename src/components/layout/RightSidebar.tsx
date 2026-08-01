import { useMemo } from 'react';
import { Trash2, Repeat, Volume2 } from 'lucide-react';
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
  const setWaveformPadId = useUIStore((s) => s.setWaveformPadId);
  const rightSidebarOpen = useUIStore((s) => s.rightSidebarOpen);

  const bank = getActiveBank(project);
  const pad = useMemo(
    () => bank.pads.find((p) => p.id === selectedPadId),
    [bank.pads, selectedPadId],
  );
  const asset = useMemo(
    () => (pad?.assetId ? assets.find((a) => a.id === pad.assetId) : undefined),
    [pad, assets],
  );

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
            {/* Name */}
            <div>
              <label className="text-xs text-muted block mb-1.5">Name</label>
              <input
                type="text"
                value={pad.name}
                onChange={(e) => updatePad(pad.id, { name: e.target.value })}
                className="w-full bg-surface-2 border border-white/8 rounded-lg px-3 py-2 text-sm outline-none focus:border-accent/40 transition-colors"
              />
            </div>

            {/* Asset info */}
            {asset && (
              <div className="p-3 rounded-lg bg-surface-2 border border-white/6">
                <p className="text-xs text-muted mb-1">Assigned Audio</p>
                <p className="text-sm font-medium truncate">{asset.name}</p>
                <p className="text-[10px] text-muted mt-1 capitalize">{asset.type}</p>
              </div>
            )}

            {/* Volume */}
            <Slider
              label="Volume"
              value={pad.volume}
              onChange={(v) => updatePad(pad.id, { volume: v })}
            />

            {/* Shortcut */}
            <div>
              <label className="text-xs text-muted block mb-1.5">Keyboard Shortcut</label>
              <input
                type="text"
                value={pad.shortcut}
                maxLength={1}
                onChange={(e) => updatePad(pad.id, { shortcut: e.target.value.toUpperCase() })}
                className="w-16 bg-surface-2 border border-white/8 rounded-lg px-3 py-2 text-sm font-mono text-center outline-none focus:border-accent/40"
              />
            </div>

            {/* Color */}
            <div>
              <label className="text-xs text-muted block mb-2">Color</label>
              <div className="flex flex-wrap gap-2">
                {PAD_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => updatePad(pad.id, { color: color as PadColor })}
                    className={cn(
                      'w-7 h-7 rounded-lg transition-transform hover:scale-110',
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
                label="Loop"
                checked={pad.loop}
                onChange={(v) => updatePad(pad.id, { loop: v })}
              />
              <Toggle
                label="Exclusive Mode"
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
              {asset && (
                <Button
                  variant="accent"
                  size="sm"
                  className="flex-1"
                  onClick={() => setWaveformPadId(pad.id)}
                >
                  <Repeat size={14} />
                  Waveform
                </Button>
              )}
              <Button variant="danger" size="sm" onClick={() => clearPad(pad.id)}>
                <Trash2 size={14} />
              </Button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
