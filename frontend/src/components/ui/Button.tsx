import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'subtle' | 'danger' | 'inverse';
export type ButtonSize = 'sm' | 'md' | 'lg';

const base =
  'relative inline-flex items-center justify-center gap-2 font-semibold whitespace-nowrap rounded-xl transition-all duration-200 ease-smooth disabled:pointer-events-none disabled:opacity-45 active:translate-y-px';

const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-brandsolid text-brandsolid-fg shadow-card hover:bg-brandsolid-hover hover:shadow-raised',
  secondary:
    'bg-surface text-ink border border-hairline shadow-card hover:border-hairline-strong hover:bg-surface-muted',
  ghost: 'text-ink-muted hover:bg-surface-inset hover:text-ink',
  subtle: 'bg-brand-50 text-brand-800 hover:bg-edge-brand',
  danger: 'bg-critical-500 text-white shadow-card hover:bg-critical-600',
  // Sits on the deep brand panel, which stays dark in both themes.
  inverse: 'bg-white text-brand-950 shadow-card hover:bg-white/90',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'h-9 px-3.5 text-sm',
  md: 'h-11 px-5 text-sm',
  lg: 'h-12 px-7 text-base',
};

export function buttonStyles(
  variant: ButtonVariant = 'primary',
  size: ButtonSize = 'md',
  className?: string,
) {
  return cn(base, variants[variant], sizes[size], className);
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    iconLeft,
    iconRight,
    fullWidth,
    className,
    children,
    disabled,
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={buttonStyles(variant, size, cn(fullWidth && 'w-full', className))}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : iconLeft}
      {children}
      {!loading && iconRight}
    </button>
  );
});
