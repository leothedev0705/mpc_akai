import { memo, useCallback } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { getActiveBank } from '@/utils';
import { Pad } from './Pad';

export const PadGrid = memo(function PadGrid() {
  const project = useProjectStore((s) => s.project);
  const assets = useProjectStore((s) => s.assets);
  const playingPadIds = useProjectStore((s) => s.playingPadIds);
  const vuLevels = useProjectStore((s) => s.vuLevels);
  const selectedPadId = useProjectStore((s) => s.selectedPadId);
  const triggerPad = useProjectStore((s) => s.triggerPad);
  const selectPad = useProjectStore((s) => s.selectPad);
  const assignAssetToPad = useProjectStore((s) => s.assignAssetToPad);
  const is16Levels = useProjectStore((s) => s.is16Levels);

  const bank = getActiveBank(project);
  const assetMap = new Map(assets.map((a) => [a.id, a]));

  // 16-Levels semitone mapping (-12 to +12 st)
  const PITCH_MAP = [-12, -10, -8, -7, -5, -4, -2, 0, 1, 2, 4, 5, 7, 8, 10, 12];

  const handleTrigger = useCallback(
    (padId: string, index: number) => {
      const pitchShift = is16Levels ? (PITCH_MAP[index] ?? 0) : 0;
      void triggerPad(padId, pitchShift);
    },
    [triggerPad, is16Levels],
  );

  const handleSelect = useCallback(
    (padId: string) => {
      selectPad(padId);
    },
    [selectPad],
  );

  const handleAssign = useCallback(
    (padId: string, assetId: string) => {
      assignAssetToPad(padId, assetId);
    },
    [assignAssetToPad],
  );

  return (
    <div className="w-full h-full flex items-center justify-center p-2">
      <div
        className="grid grid-cols-4 gap-2.5 sm:gap-3.5 w-full max-w-[460px] aspect-square"
        role="grid"
        aria-label={`Pad grid - Bank ${bank.id}`}
      >
        {bank.pads.map((pad, index) => {
          const asset = pad.assetId ? assetMap.get(pad.assetId) : undefined;
          const pitchOffset = is16Levels ? PITCH_MAP[index] : undefined;
          return (
            <Pad
              key={pad.id}
              pad={pad}
              index={index}
              isPlaying={playingPadIds.has(pad.id)}
              isSelected={selectedPadId === pad.id}
              vuLevel={vuLevels[pad.id] ?? 0}
              assetName={asset?.name}
              pitchOffset={pitchOffset}
              onTrigger={(id) => handleTrigger(id, index)}
              onSelect={handleSelect}
              onAssignAsset={handleAssign}
            />
          );
        })}
      </div>
    </div>
  );
});
