import type { ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './Button';

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn('relative overflow-hidden rounded-lg bg-surface-inset', className)}>
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/70 to-transparent dark:via-white/[0.07]" />
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-14 text-center', className)}>
      {icon ? (
        <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-inset text-ink-soft">
          {icon}
        </span>
      ) : null}
      <h4 className="text-base font-semibold">{title}</h4>
      {description ? (
        <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-ink-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title = 'Something went wrong',
  description,
  onRetry,
  className,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-14 text-center', className)}>
      <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-critical-50 text-critical-500">
        <AlertTriangle className="h-5 w-5" aria-hidden />
      </span>
      <h4 className="text-base font-semibold">{title}</h4>
      {description ? (
        <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-ink-muted">{description}</p>
      ) : null}
      {onRetry ? (
        <Button
          variant="secondary"
          size="sm"
          className="mt-5"
          onClick={onRetry}
          iconLeft={<RefreshCw className="h-4 w-4" />}
        >
          Try again
        </Button>
      ) : null}
    </div>
  );
}

export function InlineNotice({
  tone = 'info',
  title,
  children,
  icon,
  className,
}: {
  tone?: 'info' | 'caution' | 'positive' | 'critical';
  title?: string;
  children: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  const tones = {
    info: 'bg-info-50 text-info-700 ring-info-100',
    caution: 'bg-caution-50 text-caution-700 ring-caution-100',
    positive: 'bg-positive-50 text-positive-700 ring-positive-100',
    critical: 'bg-critical-50 text-critical-700 ring-critical-100',
  };

  return (
    <div className={cn('rounded-xl px-4 py-3 ring-1 ring-inset', tones[tone], className)}>
      <div className="flex gap-3">
        {icon ? <span className="mt-0.5 shrink-0">{icon}</span> : null}
        <div className="min-w-0 text-sm">
          {title ? <p className="font-semibold">{title}</p> : null}
          <div className={cn('leading-relaxed', title && 'mt-0.5 opacity-90')}>{children}</div>
        </div>
      </div>
    </div>
  );
}
