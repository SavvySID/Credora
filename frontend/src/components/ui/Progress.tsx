import { cn } from '@/lib/utils';
import type { Tone } from '@/lib/credit';

const fills: Record<Tone, string> = {
  positive: 'bg-positive-500',
  caution: 'bg-caution-500',
  critical: 'bg-critical-500',
  brand: 'bg-gradient-to-r from-viz-1 to-viz-3',
  neutral: 'bg-ink-faint',
};

export function ProgressBar({
  value,
  tone = 'brand',
  size = 'md',
  className,
  label,
}: {
  value: number;
  tone?: Tone;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  label?: string;
}) {
  const pct = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0)) * 100;
  const heights = { sm: 'h-1.5', md: 'h-2', lg: 'h-2.5' };

  return (
    <div
      className={cn('w-full overflow-hidden rounded-full bg-surface-inset', heights[size], className)}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div
        className={cn('h-full rounded-full transition-[width] duration-700 ease-smooth', fills[tone])}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
