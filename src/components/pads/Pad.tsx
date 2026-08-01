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

  // Dynamic box shadow and scaling based on real-time VU level of the pad
  const scaleValue = isPlaying ? 0.98 - (vuLevel * 0.04) : 1.0;
  const glowShadow = isPlaying
    ? `0 0 ${15 + vuLevel * 25}px rgba(255, 50, 20, ${0.6 + vuLevel * 0.4}), inset 0 0 ${10 + vuLevel * 15}px rgba(255, 50, 20, ${0.4 + vuLevel * 0.6})`
    : isSelected
      ? '0 0 14px rgba(255, 50, 20, 0.5), inset 0 0 8px rgba(255, 50, 20, 0.3)'
      : '0 4px 6px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.05)';

  const padBackground = isPlaying
    ? `radial-gradient(circle, #332222 0%, #1c1414 70%, #140d0d 100%)`
    : `linear-gradient(135deg, #2c2c2e 0%, #1e1e20 40%, #151516 100%)`;

  return (
    <motion.button
      type="button"
      className={cn(
        'relative aspect-square rounded-lg overflow-hidden cursor-pointer select-none border-2 transition-all duration-75',
        (isPlaying || isSelected) ? 'border-red-600' : 'border-neutral-950',
        pad.muted && 'opacity-30',
      )}
      style={{
        background: padBackground,
        boxShadow: glowShadow,
        scale: scaleValue,
      }}
      onPointerDown={handlePointerDown}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      aria-label={`${pad.name}${assetName ? `: ${assetName}` : ''}`}
      aria-pressed={isPlaying}
    >
      {/* Keyboard Shortcut Letter (Center-Top, like physical MPC label) */}
      <span className="absolute top-2 left-0 right-0 text-center text-xs font-mono font-bold text-neutral-400 select-none pointer-events-none">
        {pad.shortcut === ' ' ? 'G' : pad.shortcut}
      </span>

      {/* Sample Label (Center-Bottom, matching layout style) */}
      <div className="absolute inset-x-0 bottom-3 flex flex-col items-center justify-center px-1.5 select-none pointer-events-none">
        <span className="text-[10px] font-bold text-neutral-200 text-center tracking-wide leading-tight line-clamp-2 w-full drop-shadow-md">
          {pad.name === `Pad ${index + 1}` && assetName ? assetName : pad.name}
        </span>
      </div>

      {/* Visual VU Meter Overlay (highly subtle inner gradient pulsing to sound) */}
      {isPlaying && (
        <div 
          className="absolute inset-0 bg-red-500/10 pointer-events-none transition-opacity duration-75"
          style={{ opacity: 0.15 + vuLevel * 0.35 }}
        />
      )}

      {/* Pad index number in top left */}
      <span className="absolute top-1 left-2 text-[8px] font-mono text-neutral-600 font-bold select-none">
        {String(index + 1).padStart(2, '0')}
      </span>
    </motion.button>
  );
});
