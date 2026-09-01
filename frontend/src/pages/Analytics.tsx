import { useEffect, useMemo, useState } from 'react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { MetricCard } from '@/components/ui/MetricCard';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState, ErrorState, InlineNotice, Skeleton } from '@/components/ui/Feedback';
import { AreaChart } from '@/components/charts/AreaChart';
import { DonutChart, DonutLegend } from '@/components/charts/DonutChart';
import { ConnectGate } from '@/components/wallet/ConnectGate';
import { useCredit } from '@/contexts/CreditContext';
import { api } from '@/services/api';
import { formatDate, formatPercent } from '@/lib/format';

interface AnalyticsSummary {
  loans?: {
    total: number;
    active: number;
    repaid: number;
    overdue: number;
    defaulted: number;
    repaymentRate: number | null;
  };
  assessments?: { total: number; credit: number; ai: number; verified: number };
  borrowers?: { indexed: number };
  limitations?: { loanDefaultedUnsupported?: boolean };
}

export default function Analytics() {
  const { history } = useCredit();
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api
      .analytics()
      .then((payload) => {
        if (!cancelled) setSummary(payload as AnalyticsSummary);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Analytics unavailable');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const trend = useMemo(
    () => history.map((point) => ({ label: formatDate(point.timestamp), value: point.score })),
    [history],
  );

  const slices = useMemo(() => {
    const loans = summary?.loans;
    if (!loans || loans.total === 0) return [];
    return [
      { label: 'Active', value: loans.active, color: '#0D8298' },
      { label: 'Repaid', value: loans.repaid, color: '#16A2B4' },
      { label: 'Overdue', value: loans.overdue, color: '#C2410C' },
    ].filter((slice) => slice.value > 0);
  }, [summary]);

  return (
    <ConnectGate title="Analytics" description="Indexed Credora facts only. No simulated trends.">
      <div className="space-y-8">
        <PageHeader
          title="Analytics"
          description="Counts from the indexer. Charts are omitted when there is not enough real data."
        />

        {loading ? (
          <Skeleton className="h-40 w-full" />
        ) : error ? (
          <ErrorState description={error} />
        ) : (
          <>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="Indexed loans" value={String(summary?.loans?.total ?? 0)} />
              <MetricCard label="Active" value={String(summary?.loans?.active ?? 0)} />
              <MetricCard label="Repaid" value={String(summary?.loans?.repaid ?? 0)} />
              <MetricCard label="Overdue" value={String(summary?.loans?.overdue ?? 0)} />
            </section>

            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="Assessments" value={String(summary?.assessments?.total ?? 0)} />
              <MetricCard label="Verified assessments" value={String(summary?.assessments?.verified ?? 0)} />
              <MetricCard label="Indexed borrowers" value={String(summary?.borrowers?.indexed ?? 0)} />
              <MetricCard
                label="Repayment rate"
                value={
                  summary?.loans?.repaymentRate === null || summary?.loans?.repaymentRate === undefined
                    ? '—'
                    : formatPercent(summary.loans.repaymentRate, 0)
                }
                caption={
                  summary?.loans?.repaymentRate === null ? 'Insufficient settled loans' : undefined
                }
              />
            </section>

            {summary?.limitations?.loanDefaultedUnsupported ? (
              <InlineNotice tone="info" title="Defaulted is unsupported">
                Loan.sol does not emit LoanDefaulted. Overdue is derived from dueTime while a loan
                remains active.
              </InlineNotice>
            ) : null}

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader title="Your score history" description="Deterministic assessments only." />
                <CardBody>
                  {trend.length >= 2 ? (
                    <AreaChart data={trend} min={0} max={1000} />
                  ) : (
                    <EmptyState title="Insufficient data" description="Need at least two real score snapshots." />
                  )}
                </CardBody>
              </Card>
              <Card>
                <CardHeader title="Loan mix" description="Indexed loan status counts." />
                <CardBody>
                  {slices.length > 0 ? (
                    <>
                      <div className="flex justify-center">
                        <DonutChart slices={slices} centerValue={String(summary?.loans?.total ?? 0)} centerLabel="Loans" />
                      </div>
                      <div className="mt-6">
                        <DonutLegend slices={slices} />
                      </div>
                    </>
                  ) : (
                    <EmptyState title="Insufficient data" description="No indexed loans to chart." />
                  )}
                </CardBody>
              </Card>
            </div>
          </>
        )}
      </div>
    </ConnectGate>
  );
}
