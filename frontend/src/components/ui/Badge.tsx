import type { ReactNode } from 'react';
import { ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Tone } from '@/lib/credit';

const tones: Record<Tone, string> = {
  positive: 'bg-positive-50 text-positive-700 ring-positive-100',
  caution: 'bg-caution-50 text-caution-700 ring-caution-100',
  critical: 'bg-critical-50 text-critical-700 ring-critical-100',
  brand: 'bg-brand-50 text-brand-800 ring-edge-brand',
  neutral: 'bg-surface-inset text-ink-muted ring-hairline',
};

const dots: Record<Tone, string> = {
  positive: 'bg-positive-500',
  caution: 'bg-caution-500',
  critical: 'bg-critical-500',
  brand: 'bg-brand-500',
  neutral: 'bg-ink-faint',
};

interface BadgeProps {
  tone?: Tone;
  children: ReactNode;
  dot?: boolean;
  pulse?: boolean;
  icon?: ReactNode;
  className?: string;
  size?: 'sm' | 'md';
}

export function Badge({
  tone = 'neutral',
  children,
  dot,
  pulse,
  icon,
  className,
  size = 'md',
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium ring-1 ring-inset',
        size === 'sm' ? 'px-2 py-0.5 text-2xs' : 'px-2.5 py-1 text-xs',
        tones[tone],
        className,
      )}
    >
      {dot ? (
        <span className="relative flex h-1.5 w-1.5">
          {pulse ? (
            <span
              className={cn(
                'absolute inline-flex h-full w-full animate-ping rounded-full opacity-70',
                dots[tone],
              )}
            />
          ) : null}
          <span className={cn('relative inline-flex h-1.5 w-1.5 rounded-full', dots[tone])} />
        </span>
      ) : null}
      {icon}
      {children}
    </span>
  );
}

/**
 * Marks records whose provenance is the 0G network or the chain itself.
 * Used sparingly — only where the underlying record is genuinely attested.
 */
export function VerifiedBadge({
  label = '0G Verified',
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-2xs font-semibold uppercase tracking-wide text-brand-800 ring-1 ring-inset ring-edge-brand',
        className,
      )}
      title="This record is attested by the 0G network"
    >
      <ShieldCheck className="h-3 w-3" aria-hidden />
      {label}
    </span>
  );
}
