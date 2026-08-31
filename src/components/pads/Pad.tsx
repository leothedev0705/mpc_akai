import { memo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/utils/cn';
import type { PadConfig } from '@/types';

interface PadProps {
  pad: PadConfig;
  index: number;
  isPlaying: boolean;
  isSelected: boolean;
  vuLevel: number;
  assetName?: string;
  pitchOffset?: number;
  onTrigger: (padId: string) => void;
  onSelect: (padId: string) => void;
  onAssignAsset?: (padId: string, assetId: string) => void;
}

export const Pad = memo(function Pad({
  pad,
  index,
  isPlaying,
  isSelected,
  vuLevel,
  assetName,
  pitchOffset,
  onTrigger,
  onSelect,
  onAssignAsset,
}: PadProps) {
  const handlePointerDown = useCallback(() => {
    onSelect(pad.id);
    onTrigger(pad.id);
  }, [pad.id, onSelect, onTrigger]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const assetId = e.dataTransfer.getData('application/x-mpc-asset');
      if (assetId && onAssignAsset) {
        onAssignAsset(pad.id, assetId);
      }
    },
    [pad.id, onAssignAsset],
  );

  const padDefaultName = `PAD ${String(index + 1).padStart(2, '0')}`;
  const displayName = pad.assetId && assetName ? assetName : (pad.name || padDefaultName);
  const shortcutDisplay = pad.shortcut === ' ' ? 'SPACE' : (pad.shortcut || '');

  // Authentic MPC pad 3D shadows and glowing states
  const glowShadow = isPlaying
    ? `0 0 24px rgba(255, 60, 20, 0.85), inset 0 0 16px rgba(255, 80, 30, 0.7), inset 0 2px 2px rgba(255, 255, 255, 0.2)`
    : isSelected
      ? '0 0 16px rgba(255, 80, 20, 0.6), inset 0 0 10px rgba(255, 80, 20, 0.35), inset 0 2px 2px rgba(255, 255, 255, 0.15)'
      : '0 4px 10px rgba(0, 0, 0, 0.75), inset 0 2px 3px rgba(255, 255, 255, 0.08), inset 0 -2px 4px rgba(0, 0, 0, 0.6)';

  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.96, y: 2 }}
      className={cn(
        'group relative w-full aspect-square rounded-xl overflow-hidden cursor-pointer select-none transition-all duration-75 flex flex-col justify-between p-1.5 sm:p-2.5 touch-manipulation',
        'border-2 bg-gradient-to-b from-[#343438] via-[#242427] to-[#18181a]',
        isPlaying
          ? 'border-[#ff4500] from-[#452220] via-[#2d1817] to-[#201010]'
          : isSelected
            ? 'border-[#ff6622] ring-2 ring-[#ff6622]/40'
            : 'border-[#121214] hover:border-neutral-700/60 hover:from-[#3a3a3e]',
        pad.muted && 'opacity-40 grayscale',
      )}
      style={{
        boxShadow: glowShadow,
      }}
      onPointerDown={handlePointerDown}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      aria-label={`${displayName} (Shortcut: ${shortcutDisplay})`}
      aria-pressed={isPlaying}
    >
      {/* Top Bar: Pad Number & Keyboard Shortcut Badge */}
      <div className="flex items-center justify-between w-full pointer-events-none z-10">
        <span className={cn(
          "text-[9px] sm:text-[10px] font-mono font-bold tracking-tight transition-colors",
          isPlaying || isSelected ? "text-orange-400 font-extrabold" : "text-neutral-500"
        )}>
          {String(index + 1).padStart(2, '0')}
        </span>

        {pitchOffset !== undefined ? (
          <span className="text-[9px] font-mono font-extrabold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-[0_0_6px_rgba(245,158,11,0.5)]">
            {pitchOffset > 0 ? `+${pitchOffset}st` : `${pitchOffset}st`}
          </span>
        ) : (
          shortcutDisplay && (
            <span className={cn(
              "text-[9px] sm:text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border transition-all",
              isPlaying
                ? "bg-[#ff4500] text-white border-red-500 shadow-[0_0_8px_rgba(255,69,0,0.8)]"
                : isSelected
                  ? "bg-orange-500/20 text-orange-300 border-orange-500/40"
                  : "bg-black/40 text-neutral-400 border-white/5 group-hover:text-neutral-200"
            )}>
              {shortcutDisplay}
            </span>
          )
        )}
      </div>

      {/* Center Section: Chunky, Bold Sample Label */}
      <div className="flex-1 flex items-center justify-center text-center px-1 pointer-events-none my-0.5 z-10">
        <span className={cn(
          "font-bold uppercase tracking-tight line-clamp-2 drop-shadow-md transition-colors leading-tight",
          displayName.length > 12 ? "text-[9px] sm:text-[10px]" : "text-[11px] sm:text-[12px]",
          isPlaying
            ? "text-white font-extrabold drop-shadow-[0_0_8px_rgba(255,100,50,0.8)]"
            : isSelected
              ? "text-orange-200"
              : "text-neutral-200"
        )}>
          {displayName}
        </span>
      </div>

      {/* Bottom Section: Mixer Indicators (Loop, Mute, Solo, Vol/Pan) */}
      <div className="flex items-center justify-between w-full pointer-events-none z-10 text-[7px] sm:text-[8px] font-mono pt-1 border-t border-white/5">
        {/* Status badges */}
        <div className="flex items-center gap-1">
          {pad.loop && (
            <span className="px-1 py-0.2 rounded bg-cyan-950/80 text-cyan-400 border border-cyan-800/40 font-bold">
              LOOP
            </span>
          )}
          {pad.solo && (
            <span className="px-1 py-0.2 rounded bg-amber-950/80 text-amber-400 border border-amber-800/40 font-bold">
              S
            </span>
          )}
          {pad.exclusive && (
            <span className="px-1 py-0.2 rounded bg-purple-950/80 text-purple-400 border border-purple-800/40 font-bold">
              EX
            </span>
          )}
        </div>

        {/* Volume % / Pan indicator */}
        <span className="text-neutral-500 font-semibold tracking-tighter">
          {pad.pan && pad.pan !== 0 ? (pad.pan < 0 ? `L${Math.round(Math.abs(pad.pan)*100)}` : `R${Math.round(pad.pan*100)}`) : `${Math.round(pad.volume * 100)}%`}
        </span>
      </div>

      {/* Dynamic Sound-Reactive Backlight Pulse Overlay */}
      {isPlaying && (
        <div 
          className="absolute inset-0 bg-gradient-to-t from-red-600/30 via-orange-500/20 to-transparent pointer-events-none transition-opacity duration-75"
          style={{ opacity: 0.4 + vuLevel * 0.6 }}
        />
      )}
    </motion.button>
  );
});
