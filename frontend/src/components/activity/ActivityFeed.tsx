import {
  ArrowDownLeft,
  ArrowUpRight,
  BadgeCheck,
  Gauge,
  Radio,
  Wallet,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatEthCompact, formatTimeAgo } from '@/lib/format';
import { VerifiedBadge } from '@/components/ui/Badge';
import type { ActivityItem, ActivityType } from '@/contexts/ActivityContext';
import type { Tone } from '@/lib/credit';

const ICONS: Record<ActivityType, LucideIcon> = {
  wallet_connected: Wallet,
  credit_score_updated: Gauge,
  loan_requested: ArrowUpRight,
  loan_approved: BadgeCheck,
  loan_declined: XCircle,
  loan_repaid: ArrowDownLeft,
  real_time_update: Radio,
  transaction: ArrowUpRight,
};

const TONE_CLASSES: Record<Tone, string> = {
  positive: 'bg-positive-50 text-positive-600',
  caution: 'bg-caution-50 text-caution-600',
  critical: 'bg-critical-50 text-critical-600',
  brand: 'bg-brand-50 text-brand-700',
  neutral: 'bg-surface-inset text-ink-soft',
};

export function ActivityRow({
  item,
  showConnector,
}: {
  item: ActivityItem;
  showConnector?: boolean;
}) {
  const Icon = ICONS[item.type] ?? Radio;
  const tone = item.tone ?? 'neutral';

  return (
    <li className="relative flex gap-4 pb-6 last:pb-0">
      {showConnector ? (
        <span
          className="absolute left-[19px] top-10 bottom-0 w-px bg-hairline"
          aria-hidden
        />
      ) : null}

      <span
        className={cn(
          'relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-4 ring-surface',
          TONE_CLASSES[tone],
        )}
      >
        <Icon className="h-4 w-4" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p className="text-sm font-semibold">{item.title}</p>
          <time className="shrink-0 text-xs text-ink-soft" dateTime={item.timestamp}>
            {formatTimeAgo(item.timestamp)}
          </time>
        </div>

        <p className="mt-0.5 text-sm leading-relaxed text-ink-muted">{item.description}</p>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          {typeof item.amount === 'number' ? (
            <span className="rounded-md bg-surface-inset px-2 py-0.5 text-xs font-semibold tabular text-ink">
              {formatEthCompact(item.amount)} 0G
            </span>
          ) : null}
          {item.verified ? <VerifiedBadge label="Verified record" /> : null}
        </div>
      </div>
    </li>
  );
}

export function ActivityFeed({
  items,
  className,
}: {
  items: ActivityItem[];
  className?: string;
}) {
  return (
    <ul className={cn('relative', className)}>
      {items.map((item, index) => (
        <ActivityRow key={item.id} item={item} showConnector={index < items.length - 1} />
      ))}
    </ul>
  );
}
