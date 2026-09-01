import type { ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from './Card';
import { Skeleton } from './Feedback';

interface MetricCardProps {
  label: string;
  value: ReactNode;
  unit?: string;
  caption?: ReactNode;
  icon?: ReactNode;
  delta?: { value: string; direction: 'up' | 'down' | 'flat' } | null;
  loading?: boolean;
  accent?: boolean;
  footer?: ReactNode;
  className?: string;
}

export function MetricCard({
  label,
  value,
  unit,
  caption,
  icon,
  delta,
  loading,
  accent,
  footer,
  className,
}: MetricCardProps) {
  return (
    <Card
      surface={accent ? 'brand' : 'default'}
      className={cn('flex flex-col justify-between p-5', className)}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={cn(
            'text-2xs font-semibold uppercase tracking-wider',
            accent ? 'text-brand-200' : 'text-ink-soft',
          )}
        >
          {label}
        </span>
        {icon ? (
          <span
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-lg',
              accent ? 'bg-white/10 text-brand-200' : 'bg-surface-inset text-brand-700',
            )}
          >
            {icon}
          </span>
        ) : null}
      </div>

      <div className="mt-4">
        {loading ? (
          <Skeleton className="h-9 w-28" />
        ) : (
          <div className="flex items-baseline gap-1.5">
            <span
              className={cn(
                'font-display text-3xl font-semibold tabular tracking-tight',
                accent ? 'text-white' : 'text-ink',
              )}
            >
              {value}
            </span>
            {unit ? (
              <span
                className={cn(
                  'text-sm font-semibold',
                  accent ? 'text-brand-200' : 'text-ink-soft',
                )}
              >
                {unit}
              </span>
            ) : null}
          </div>
        )}

        {(caption || delta) && !loading ? (
          <div className="mt-2 flex items-center gap-2">
            {delta ? (
              <span
                className={cn(
                  'inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-2xs font-semibold',
                  delta.direction === 'up' && 'bg-positive-50 text-positive-700',
                  delta.direction === 'down' && 'bg-critical-50 text-critical-700',
                  delta.direction === 'flat' && 'bg-surface-inset text-ink-muted',
                  accent && 'bg-white/10 text-white',
                )}
              >
                {delta.direction === 'up' ? (
                  <ArrowUpRight className="h-3 w-3" />
                ) : delta.direction === 'down' ? (
                  <ArrowDownRight className="h-3 w-3" />
                ) : null}
                {delta.value}
              </span>
            ) : null}
            {caption ? (
              <span className={cn('text-xs', accent ? 'text-brand-200' : 'text-ink-muted')}>
                {caption}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      {footer ? <div className="mt-4">{footer}</div> : null}
    </Card>
  );
}

export function StatRow({
  label,
  value,
  tone,
  mono,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  tone?: 'default' | 'positive' | 'critical' | 'brand';
  mono?: boolean;
  className?: string;
}) {
  const tones = {
    default: 'text-ink',
    positive: 'text-positive-600',
    critical: 'text-critical-600',
    brand: 'text-brand-700',
  };

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4 border-b border-hairline-soft py-3 last:border-0',
        className,
      )}
    >
      <span className="text-sm text-ink-muted">{label}</span>
      <span
        className={cn(
          'text-sm font-semibold tabular',
          mono && 'font-mono text-xs',
          tones[tone ?? 'default'],
        )}
      >
        {value}
      </span>
    </div>
  );
}
