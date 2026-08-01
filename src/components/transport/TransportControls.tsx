import { Square, Pause, Play, StopCircle } from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import { Button } from '@/components/ui/Button';
import { Slider } from '@/components/ui/Slider';
import { VUMeter } from '@/components/mixer/VUMeter';

export function TransportControls() {
  const masterVolume = useProjectStore((s) => s.project.masterVolume);
  const masterLevel = useProjectStore((s) => s.masterLevel);
  const isPaused = useProjectStore((s) => s.isPaused);
  const setMasterVolume = useProjectStore((s) => s.setMasterVolume);
  const stopAll = useProjectStore((s) => s.stopAll);
  const pauseAll = useProjectStore((s) => s.pauseAll);
  const resumeAll = useProjectStore((s) => s.resumeAll);

  return (
    <div className="flex items-center gap-4 px-4 py-2">
      <div className="flex items-center gap-1.5">
        <Button
          variant="default"
          size="sm"
          onClick={stopAll}
          aria-label="Stop all"
          title="Stop All"
        >
          <Square size={14} fill="currentColor" />
        </Button>
        <Button
          variant="default"
          size="sm"
          onClick={() => (isPaused ? void resumeAll() : pauseAll())}
          aria-label={isPaused ? 'Resume' : 'Pause'}
          title={isPaused ? 'Resume' : 'Pause'}
        >
          {isPaused ? <Play size={14} /> : <Pause size={14} />}
        </Button>
        <Button
          variant="danger"
          size="sm"
          onClick={() => stopAll()}
          aria-label="Emergency stop"
          title="Stop All (Fade)"
        >
          <StopCircle size={14} />
        </Button>
      </div>

      <div className="h-6 w-px bg-white/10" />

      <div className="flex items-center gap-3 flex-1 max-w-xs">
        <span className="text-[10px] text-muted uppercase tracking-wider shrink-0">Master</span>
        <Slider
          value={masterVolume}
          onChange={setMasterVolume}
          showValue={false}
          className="flex-1"
        />
        <span className="text-[10px] font-mono text-accent w-8 text-right">
          {Math.round(masterVolume * 100)}
        </span>
      </div>

      <VUMeter level={masterLevel} label="OUT" className="w-16" />
    </div>
  );
}
