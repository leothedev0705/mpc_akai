import { cn } from '@/utils/cn';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  className?: string;
}

export function Toggle({ checked, onChange, label, className }: ToggleProps) {
  return (
    <label className={cn('flex items-center justify-between gap-3 cursor-pointer', className)}>
      {label && <span className="text-sm text-muted">{label}</span>}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative w-10 h-5 rounded-full transition-colors duration-200',
          checked ? 'bg-accent/30' : 'bg-surface-2',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 left-0.5 w-4 h-4 rounded-full transition-transform duration-200',
            checked ? 'translate-x-5 bg-accent shadow-[0_0_8px_rgba(0,229,255,0.5)]' : 'bg-muted',
          )}
        />
      </button>
    </label>
  );
}
