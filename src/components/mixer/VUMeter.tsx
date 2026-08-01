import { cn } from '@/utils/cn';

interface VUMeterProps {
  level: number;
  label?: string;
  className?: string;
  vertical?: boolean;
}

export function VUMeter({ level, label, className, vertical = true }: VUMeterProps) {
  const segments = 12;
  const activeSegments = Math.round(level * segments);

  return (
    <div className={cn('flex flex-col items-center gap-1', className)}>
      {label && (
        <span className="text-[9px] text-muted font-mono uppercase">{label}</span>
      )}
      <div
        className={cn(
          'flex gap-0.5',
          vertical ? 'flex-col-reverse' : 'flex-row',
        )}
        role="meter"
        aria-valuenow={Math.round(level * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ? `${label} level meter` : 'Level meter'}
      >
        {Array.from({ length: segments }, (_, i) => {
          const isActive = i < activeSegments;
          const isHot = i >= segments * 0.75;
          return (
            <div
              key={i}
              className={cn(
                'rounded-sm transition-all duration-75',
                vertical ? 'w-full h-1.5' : 'h-full w-1.5',
                isActive
                  ? isHot
                    ? 'bg-danger shadow-[0_0_4px_rgba(255,85,85,0.5)]'
                    : i >= segments * 0.5
                      ? 'bg-warning'
                      : 'bg-success shadow-[0_0_4px_rgba(46,235,139,0.3)]'
                  : 'bg-surface-2',
              )}
            />
          );
        })}
      </div>
    </div>
  );
}
