import { cn } from '@/utils/cn';

interface SliderProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
  label?: string;
  showValue?: boolean;
  className?: string;
  formatValue?: (v: number) => string;
}

export function Slider({
  value,
  min = 0,
  max = 1,
  step = 0.01,
  onChange,
  label,
  showValue = true,
  className,
  formatValue = (v) => `${Math.round(v * 100)}%`,
}: SliderProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {(label || showValue) && (
        <div className="flex items-center justify-between text-xs">
          {label && <span className="text-muted">{label}</span>}
          {showValue && <span className="text-accent font-mono">{formatValue(value)}</span>}
        </div>
      )}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full"
        aria-label={label}
      />
    </div>
  );
}
