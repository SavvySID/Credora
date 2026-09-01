import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Elevation = 'flat' | 'raised' | 'floating';
type Surface = 'default' | 'muted' | 'inset' | 'brand';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  elevation?: Elevation;
  surface?: Surface;
  interactive?: boolean;
}

const elevations: Record<Elevation, string> = {
  flat: 'shadow-none',
  raised: 'shadow-card',
  floating: 'shadow-raised',
};

const surfaces: Record<Surface, string> = {
  default: 'bg-surface border-hairline',
  muted: 'bg-surface-muted border-hairline',
  inset: 'bg-surface-inset border-hairline-soft',
  brand: 'bg-brandpanel border-white/10 text-white',
};

export function Card({
  elevation = 'raised',
  surface = 'default',
  interactive,
  className,
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        'rounded-card border transition-all duration-300 ease-smooth',
        elevations[elevation],
        surfaces[surface],
        interactive && 'hover:-translate-y-0.5 hover:shadow-raised',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
  compact?: boolean;
}

export function CardHeader({
  title,
  description,
  action,
  icon,
  className,
  compact,
}: CardHeaderProps) {
  return (
    <div
      className={cn(
        'flex items-start justify-between gap-4',
        compact ? 'px-5 pt-5' : 'px-6 pt-6',
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        {icon ? (
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-inset text-brand-700">
            {icon}
          </span>
        ) : null}
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold tracking-tight">{title}</h3>
          {description ? (
            <p className="mt-1 text-sm leading-relaxed text-ink-muted">{description}</p>
          ) : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function CardBody({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('p-6', className)} {...props}>
      {children}
    </div>
  );
}
