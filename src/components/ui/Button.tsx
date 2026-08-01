import { cn } from '@/utils/cn';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'accent' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export function Button({
  className,
  variant = 'default',
  size = 'md',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed',
        variant === 'default' && 'hardware-btn text-text',
        variant === 'accent' &&
          'bg-accent/15 text-accent border border-accent/30 hover:bg-accent/25 shadow-[0_0_12px_rgba(0,229,255,0.15)]',
        variant === 'danger' &&
          'bg-danger/15 text-danger border border-danger/30 hover:bg-danger/25',
        variant === 'ghost' && 'bg-transparent text-muted hover:text-text hover:bg-white/5',
        size === 'sm' && 'px-2.5 py-1.5 text-xs',
        size === 'md' && 'px-3.5 py-2 text-sm',
        size === 'lg' && 'px-5 py-2.5 text-base',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
