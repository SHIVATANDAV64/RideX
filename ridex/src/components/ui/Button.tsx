// src/components/ui/Button.tsx
import { type ButtonHTMLAttributes, type ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type Size = 'sm' | 'md' | 'lg';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  fullWidth?: boolean;
}

const variants: Record<Variant, string> = {
  primary: 'bg-brand text-white shadow-lg shadow-brand/30 hover:bg-blue-600 active:scale-[0.98]',
  secondary: 'bg-surface-card text-white border border-white/10 hover:bg-slate-600/60',
  ghost: 'text-slate-300 hover:bg-white/5',
  danger: 'bg-danger text-white shadow-lg shadow-danger/30 hover:bg-red-700',
  success: 'bg-success text-white shadow-lg shadow-success/30 hover:bg-green-700',
};

const sizes: Record<Size, string> = {
  sm: 'h-9 px-4 text-sm gap-1.5',
  md: 'h-11 px-5 text-sm gap-2',
  lg: 'h-14 px-6 text-base gap-2.5',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  fullWidth = false,
  children,
  className = '',
  disabled,
  ...props
}: Props) {
  return (
    <button
      className={[
        'inline-flex items-center justify-center rounded-xl font-semibold',
        'transition-all duration-150 select-none cursor-pointer active:scale-[0.97]',
        'disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none',
        variants[variant],
        sizes[size],
        fullWidth ? 'w-full' : '',
        className,
      ].join(' ')}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="flex gap-1">
          <span className="dot-1 w-1.5 h-1.5 rounded-full bg-current" />
          <span className="dot-2 w-1.5 h-1.5 rounded-full bg-current" />
          <span className="dot-3 w-1.5 h-1.5 rounded-full bg-current" />
        </span>
      ) : (
        <>
          {icon && <span className="shrink-0">{icon}</span>}
          {children}
        </>
      )}
    </button>
  );
}
