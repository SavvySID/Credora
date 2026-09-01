import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { factorLabel, impactTone } from '@/lib/credit';
import { ProgressBar } from '@/components/ui/Progress';

export interface CreditFactorLike {
  factor: string;
  impact: string;
  weight: number;
  description?: string;
}

const ICONS = {
  positive: TrendingUp,
  negative: TrendingDown,
  neutral: Minus,
} as const;

export function FactorList({
  factors,
  className,
}: {
  factors: CreditFactorLike[];
  className?: string;
}) {
  return (
    <ul className={cn('space-y-5', className)}>
      {factors.map((factor) => {
        const tone = impactTone(factor.impact);
        const impactKey =
          factor.impact === 'positive' || factor.impact === 'negative' ? factor.impact : 'neutral';
        const Icon = ICONS[impactKey];

        return (
          <li key={factor.factor}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-3">
                <span
                  className={cn(
                    'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                    tone === 'positive' && 'bg-positive-50 text-positive-600',
                    tone === 'critical' && 'bg-critical-50 text-critical-600',
                    tone === 'neutral' && 'bg-surface-inset text-ink-soft',
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{factorLabel(factor.factor)}</p>
                  {factor.description ? (
                    <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">
                      {factor.description}
                    </p>
                  ) : null}
                </div>
              </div>

              <span className="shrink-0 text-sm font-semibold tabular text-ink-muted">
                {Math.round(factor.weight * 100)}%
              </span>
            </div>

            <ProgressBar
              value={factor.weight}
              tone={tone === 'neutral' ? 'neutral' : tone}
              size="sm"
              className="ml-11 mt-2.5 w-[calc(100%-2.75rem)]"
              label={`${factorLabel(factor.factor)} weighting`}
            />
          </li>
        );
      })}
    </ul>
  );
}
