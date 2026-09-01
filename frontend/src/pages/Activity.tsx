import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity as ActivityIcon, ArrowRight, Trash2 } from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button, buttonStyles } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/Feedback';
import { PageHeader } from '@/components/ui/PageHeader';
import { SegmentedControl } from '@/components/ui/Field';
import { MetricCard } from '@/components/ui/MetricCard';
import { BarChart } from '@/components/charts/BarChart';
import { ActivityFeed } from '@/components/activity/ActivityFeed';
import { ConnectGate } from '@/components/wallet/ConnectGate';
import { useActivity, type ActivityItem } from '@/contexts/ActivityContext';
import { formatDate } from '@/lib/format';

type Filter = 'all' | 'credit' | 'loans' | 'wallet';

const FILTER_TYPES: Record<Exclude<Filter, 'all'>, ActivityItem['type'][]> = {
  credit: ['credit_score_updated', 'real_time_update'],
  loans: ['loan_requested', 'loan_approved', 'loan_declined', 'loan_repaid'],
  wallet: ['wallet_connected', 'transaction'],
};

/** Groups a chronological feed into day buckets for easier scanning. */
function groupByDay(items: ActivityItem[]) {
  const groups = new Map<string, ActivityItem[]>();

  items.forEach((item) => {
    const date = new Date(item.timestamp);
    const key = date.toDateString();
    groups.set(key, [...(groups.get(key) ?? []), item]);
  });

  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86_400_000).toDateString();

  return [...groups.entries()].map(([key, value]) => ({
    key,
    label: key === today ? 'Today' : key === yesterday ? 'Yesterday' : formatDate(key),
    items: value,
  }));
}

export default function ActivityPage() {
  const { activities, clear } = useActivity();
  const [filter, setFilter] = useState<Filter>('all');

  const filtered = useMemo(
    () =>
      filter === 'all'
        ? activities
        : activities.filter((item) => FILTER_TYPES[filter].includes(item.type)),
    [activities, filter],
  );

  const groups = useMemo(() => groupByDay(filtered), [filtered]);

  const counts = useMemo(
    () => ({
      credit: activities.filter((i) => FILTER_TYPES.credit.includes(i.type)).length,
      loans: activities.filter((i) => FILTER_TYPES.loans.includes(i.type)).length,
      wallet: activities.filter((i) => FILTER_TYPES.wallet.includes(i.type)).length,
    }),
    [activities],
  );

  const weekly = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 7 }, (_, offset) => {
      const day = new Date(today.getTime() - (6 - offset) * 86_400_000);
      const key = day.toDateString();
      return {
        label: day.toLocaleDateString('en-US', { weekday: 'narrow' }),
        value: activities.filter((item) => new Date(item.timestamp).toDateString() === key).length,
        highlight: offset === 6,
      };
    });
  }, [activities]);

  return (
    <ConnectGate
      title="Activity"
      description="Connect a wallet to see a verified timeline of your assessments, loan events and sessions."
    >
      <div className="space-y-8">
        <PageHeader
          title="Activity"
          description="A chronological record of everything Credora has done on your behalf."
          actions={
            activities.length > 0 ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={clear}
                iconLeft={<Trash2 className="h-4 w-4" />}
              >
                Clear history
              </Button>
            ) : null
          }
        />

        <section className="grid gap-4 lg:grid-cols-[1fr_minmax(0,420px)]">
          <div className="grid gap-4 sm:grid-cols-3">
            <MetricCard
              label="Credit events"
              value={counts.credit}
              caption="Assessments and streams"
            />
            <MetricCard label="Loan events" value={counts.loans} caption="Requests and settlements" />
            <MetricCard
              label="Wallet events"
              value={counts.wallet}
              caption="Sessions and transfers"
            />
          </div>

          <Card>
            <CardHeader title="Last 7 days" description="Events recorded per day." compact />
            <div className="px-5 pb-5 pt-4">
              <BarChart
                data={weekly}
                height={120}
                formatValue={(value) => `${value} ${value === 1 ? 'event' : 'events'}`}
              />
            </div>
          </Card>
        </section>

        <Card>
          <CardHeader
            title="Timeline"
            description="Newest first. Verified entries originate on-chain or from 0G records."
          />

          <div className="px-6 pt-4">
            <SegmentedControl<Filter>
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'all', label: `All (${activities.length})` },
                { value: 'credit', label: 'Credit' },
                { value: 'loans', label: 'Loans' },
                { value: 'wallet', label: 'Wallet' },
              ]}
            />
          </div>

          {groups.length > 0 ? (
            <CardBody className="space-y-8 pt-6">
              {groups.map((group) => (
                <div key={group.key}>
                  <div className="mb-4 flex items-center gap-3">
                    <h3 className="text-2xs font-semibold uppercase tracking-wider text-ink-faint">
                      {group.label}
                    </h3>
                    <span className="h-px flex-1 bg-hairline" />
                    <span className="text-2xs text-ink-faint">
                      {group.items.length} {group.items.length === 1 ? 'event' : 'events'}
                    </span>
                  </div>
                  <ActivityFeed items={group.items} />
                </div>
              ))}
            </CardBody>
          ) : (
            <EmptyState
              icon={<ActivityIcon className="h-5 w-5" />}
              title={activities.length === 0 ? 'No activity yet' : 'Nothing in this view'}
              description={
                activities.length === 0
                  ? 'Assessments, loan requests and repayments are recorded here as they happen.'
                  : 'Try a different filter to see the rest of your timeline.'
              }
              action={
                activities.length === 0 ? (
                  <Link to="/borrow" className={buttonStyles('primary', 'md')}>
                    Request a loan
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                ) : (
                  <Button variant="secondary" size="sm" onClick={() => setFilter('all')}>
                    Show all
                  </Button>
                )
              }
            />
          )}
        </Card>
      </div>
    </ConnectGate>
  );
}
