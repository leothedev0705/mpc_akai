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

  const bank = getActiveBank(project);
  const assetMap = new Map(assets.map((a) => [a.id, a]));

  const handleTrigger = useCallback(
    (padId: string) => {
      void triggerPad(padId);
    },
    [triggerPad],
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
    <div className="flex items-center justify-center h-full p-4">
      <div
        className="grid gap-3 w-full max-w-[520px]"
        style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}
        role="grid"
        aria-label={`Pad grid - Bank ${bank.id}`}
      >
        {bank.pads.map((pad, index) => {
          const asset = pad.assetId ? assetMap.get(pad.assetId) : undefined;
          return (
            <Pad
              key={pad.id}
              pad={pad}
              index={index}
              isPlaying={playingPadIds.has(pad.id)}
              isSelected={selectedPadId === pad.id}
              vuLevel={vuLevels[pad.id] ?? 0}
              assetName={asset?.name}
              onTrigger={handleTrigger}
              onSelect={handleSelect}
              onAssignAsset={handleAssign}
            />
          );
        })}
      </div>
    </div>
  );
});
