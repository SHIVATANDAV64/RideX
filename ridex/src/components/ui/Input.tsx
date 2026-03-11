// src/components/ui/Input.tsx
import { forwardRef, type InputHTMLAttributes } from 'react';

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
  suffix?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, Props>(
  ({ label, error, icon, suffix, className = '', ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {icon && (
            <span className="absolute left-3 text-slate-400 pointer-events-none">
              {icon}
            </span>
          )}
          <input
            ref={ref}
            className={[
              'w-full h-12 bg-white/5 border border-white/10 rounded-xl',
              'text-white text-sm placeholder:text-slate-500',
              'focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand/40',
              'transition-colors duration-150',
              icon ? 'pl-10' : 'pl-4',
              suffix ? 'pr-10' : 'pr-4',
              error ? 'border-danger/60 focus:border-danger focus:ring-danger/30' : '',
              className,
            ].join(' ')}
            {...props}
          />
          {suffix && (
            <span className="absolute right-3 text-slate-400">
              {suffix}
            </span>
          )}
        </div>
        {error && (
          <p className="text-xs text-danger mt-0.5">{error}</p>
        )}
      </div>
    );
  }
);
Input.displayName = 'Input';
