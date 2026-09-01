import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface FieldProps {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
  labelClassName?: string;
  trailing?: ReactNode;
}

export function Field({ label, hint, error, htmlFor, children, className, labelClassName, trailing }: FieldProps) {
  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={htmlFor} className={cn('text-sm font-medium text-ink', labelClassName)}>
          {label}
        </label>
        {trailing}
      </div>
      {children}
      {error ? (
        <p className="text-xs font-medium text-critical-600">{error}</p>
      ) : hint ? (
        <p className="text-xs leading-relaxed text-ink-soft">{hint}</p>
      ) : null}
    </div>
  );
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  suffix?: ReactNode;
  invalid?: boolean;
  sizeVariant?: 'md' | 'lg';
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { suffix, invalid, className, sizeVariant = 'md', ...props },
  ref,
) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-xl border bg-surface px-4 shadow-inset transition-all duration-200',
        sizeVariant === 'lg' ? 'h-16' : 'h-12',
        invalid
          ? 'border-critical-500 ring-2 ring-critical-100'
          : 'border-hairline focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-edge-brand',
        className,
      )}
    >
      <input
        ref={ref}
        className={cn(
          'w-full min-w-0 bg-transparent font-display text-ink outline-none placeholder:font-sans placeholder:text-ink-faint',
          sizeVariant === 'lg' ? 'text-2xl font-semibold tracking-tight' : 'text-sm',
        )}
        {...props}
      />
      {suffix ? (
        <span className="shrink-0 text-sm font-semibold text-ink-soft">{suffix}</span>
      ) : null}
    </div>
  );
});

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
  size = 'md',
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  size?: 'sm' | 'md';
}) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 rounded-xl border border-hairline bg-surface-inset p-1',
        className,
      )}
      role="tablist"
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'rounded-lg font-medium transition-all duration-200 ease-smooth',
              size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-sm',
              active
                ? 'bg-surface text-ink shadow-card'
                : 'text-ink-muted hover:text-ink',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function Select({
  className,
  children,
  highlighted = false,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { highlighted?: boolean }) {
  return (
    <select
      className={cn(
        'h-12 w-full rounded-xl px-4 outline-none transition-all duration-200 disabled:opacity-45',
        highlighted
          ? 'border border-brand-500 bg-brand-50 font-semibold text-ink shadow-card ring-2 ring-edge-brand'
          : 'border border-hairline bg-surface text-sm text-ink shadow-inset focus:border-brand-500 focus:ring-2 focus:ring-edge-brand',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}
