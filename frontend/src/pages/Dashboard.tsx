import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity as ActivityIcon,
  ArrowRight,
  ArrowUpRight,
  BadgeDollarSign,
  CalendarClock,
  Gauge,
  Layers,
  Plus,
  Wallet,
} from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { MetricCard, StatRow } from '@/components/ui/MetricCard';
import { Badge } from '@/components/ui/Badge';
import { Button, buttonStyles } from '@/components/ui/Button';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';
import { PageHeader, SectionHeading } from '@/components/ui/PageHeader';
import { ProgressBar } from '@/components/ui/Progress';
import { ScoreGauge } from '@/components/charts/ScoreGauge';
import { AreaChart } from '@/components/charts/AreaChart';
import { Sparkline } from '@/components/charts/BarChart';
import { ActivityFeed } from '@/components/activity/ActivityFeed';
import { AiRiskCard } from '@/components/credit/AiRiskCard';
import { ReputationRow } from '@/components/credit/ReputationRow';
import { VerificationStatusBadge } from '@/components/credit/VerificationStatusBadge';
import { LoanStatusBadge } from '@/components/loans/LoanCard';
import { ConnectGate } from '@/components/wallet/ConnectGate';
import { AddressChip } from '@/components/wallet/WalletChip';
import { useWallet } from '@/hooks/useWallet';
import { useCredit } from '@/contexts/CreditContext';
import { useLoans } from '@/contexts/LoansContext';
import { useActivity } from '@/contexts/ActivityContext';
import { formatDate, formatEth, formatEthCompact, formatNumber, formatPercent } from '@/lib/format';
import { bandForScore, ratingLabel, ratingSummary, toneForLevel } from '@/lib/credit';

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function Dashboard() {
  const { account, balance, balanceSymbol, transactionCount, chainName, isLoading: walletLoading } =
    useWallet();
  const { profile, history, isLoading, isRunningAi, error, refresh, isRealTimeConnected } =
    useCredit();
  const { loans, activeLoans } = useLoans();
  const { activities } = useActivity();

  const tone = toneForLevel(profile?.riskLevel);
  const band = profile ? bandForScore(profile.creditScore) : null;

  const outstanding = useMemo(
    () => activeLoans.reduce((sum, loan) => sum + loan.totalRepayment, 0),
    [activeLoans],
  );

  const nextDue = useMemo(
    () =>
      [...activeLoans].sort(
        (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
      )[0] ?? null,
    [activeLoans],
  );

  const borrowingPower = balance ? parseFloat(balance) * 2 : 0;

  const trend = useMemo(
    () =>
      history.map((point) => ({
        label: formatDate(point.timestamp),
        value: point.score,
      })),
    [history],
  );

  const scoreDelta = useMemo(() => {
    if (history.length < 2) return null;
    const diff = history[history.length - 1].score - history[history.length - 2].score;
    if (diff === 0) return { value: 'No change', direction: 'flat' as const };
    return {
      value: `${diff > 0 ? '+' : ''}${diff}`,
      direction: diff > 0 ? ('up' as const) : ('down' as const),
    };
  }, [history]);

  return (
    <ConnectGate
      title="Your financial dashboard"
      description="Connect a wallet to generate your credit assessment, review borrowing capacity and manage active loans."
    >
      <div className="space-y-8">
        <PageHeader
          eyebrow={
            <>
              <span className="text-sm text-ink-muted">{greeting()}</span>
              {account ? <AddressChip address={account} /> : null}
            </>
          }
          title="Dashboard"
          description="A live view of your credit standing, borrowing capacity and repayment obligations."
          actions={
            <>
              <Link to="/borrow" className={buttonStyles('primary', 'md')}>
                <Plus className="h-4 w-4" />
                Request a loan
              </Link>
              <Link to="/credit-score" className={buttonStyles('secondary', 'md')}>
                View assessment
              </Link>
            </>
          }
        />

        {/* Key figures */}
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Wallet balance"
            value={balance ? formatEth(balance) : '—'}
            unit={balanceSymbol}
            caption={chainName ?? undefined}
            icon={<Wallet className="h-4 w-4" />}
            loading={walletLoading && !balance}
          />
          <MetricCard
            label="Credit score"
            value={profile ? profile.creditScore : '—'}
            unit="/ 1000"
            delta={scoreDelta}
            caption={profile ? ratingLabel(profile.riskLevel) : undefined}
            icon={<Gauge className="h-4 w-4" />}
            loading={isLoading && !profile}
            accent
            footer={
              history.length >= 2 ? (
                <Sparkline
                  values={history.map((point) => point.score)}
                  width={180}
                  height={32}
                  tone="#7BD9E2"
                  className="w-full"
                />
              ) : null
            }
          />
          <MetricCard
            label="Outstanding"
            value={formatEthCompact(outstanding)}
            unit="0G"
            caption={`${activeLoans.length} active ${activeLoans.length === 1 ? 'loan' : 'loans'}`}
            icon={<BadgeDollarSign className="h-4 w-4" />}
          />
          <MetricCard
            label="Borrowing power"
            value={formatEthCompact(borrowingPower)}
            unit="0G"
            caption="2× wallet balance"
            icon={<Layers className="h-4 w-4" />}
            loading={walletLoading && !balance}
          />
        </section>

        {/* Credit standing + trend */}
        <section className="grid gap-4 lg:grid-cols-[minmax(0,380px)_1fr]">
          <Card className="flex flex-col">
            <CardHeader
              title="Credit standing"
              description="Generated from your live on-chain activity."
              action={<VerificationStatusBadge status={profile?.verification?.status} />}
            />
            <CardBody className="flex flex-1 flex-col items-center justify-center pt-2">
              {isLoading && !profile ? (
                <div className="flex flex-col items-center gap-4 py-6">
                  <Skeleton className="h-[220px] w-[220px] rounded-full" />
                  <Skeleton className="h-4 w-40" />
                </div>
              ) : error ? (
                <ErrorState description={error} onRetry={() => void refresh()} />
              ) : profile ? (
                <>
                  <ScoreGauge
                    score={profile.creditScore}
                    tone={tone}
                    size={220}
                    label={ratingLabel(profile.riskLevel)}
                    caption={band ? `${band.from}–${band.to} band` : undefined}
                  />
                  <p className="mt-5 max-w-xs text-center text-sm leading-relaxed text-ink-muted">
                    {ratingSummary(profile.riskLevel)}
                  </p>
                  <div className="mt-5 flex w-full items-center justify-between rounded-xl bg-surface-inset px-4 py-3">
                    <span className="text-xs text-ink-muted">Model confidence</span>
                    <span className="text-sm font-semibold tabular">
                      {formatPercent(profile.confidence, 0)}
                    </span>
                  </div>
                </>
              ) : (
                <EmptyState
                  icon={<Gauge className="h-5 w-5" />}
                  title="No assessment yet"
                  description="Your score is generated once wallet data is available."
                  action={
                    <Button variant="secondary" size="sm" onClick={() => void refresh()}>
                      Generate assessment
                    </Button>
                  }
                />
              )}
            </CardBody>
          </Card>

          <div className="grid gap-4">
            <Card>
              <CardHeader
                title="Score trend"
                description="Every assessment recorded for this wallet."
                action={
                  <Badge tone={isRealTimeConnected ? 'positive' : 'neutral'} dot pulse={isRealTimeConnected}>
                    {isRealTimeConnected ? 'Streaming' : 'Offline'}
                  </Badge>
                }
              />
              <CardBody className="pt-4">
                {trend.length >= 2 ? (
                  <AreaChart data={trend} height={200} min={0} max={1000} />
                ) : (
                  <EmptyState
                    icon={<ActivityIcon className="h-5 w-5" />}
                    title="Building your history"
                    description="Credora records each assessment as it happens. Your trend line appears once a second reading is captured."
                    className="py-10"
                  />
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Assessment inputs" compact />
              <div className="grid gap-x-8 px-5 pb-5 pt-2 sm:grid-cols-2">
                <StatRow
                  label="Wallet balance"
                  value={balance ? `${formatEth(balance)} ${balanceSymbol}` : '—'}
                />
                <StatRow label="Transactions" value={formatNumber(transactionCount)} />
                <StatRow label="Network" value={chainName ?? '—'} />
                <StatRow
                  label="Model"
                  value={profile?.modelVersion ? `v${profile.modelVersion}` : '—'}
                />
              </div>
            </Card>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <AiRiskCard compact loading={isRunningAi} ai={profile?.ai} />
          <Card>
            <CardHeader title="Reputation" description="Earned from real on-chain and 0G-verified conditions." />
            <CardBody>
              <ReputationRow badges={profile?.reputation ?? []} />
            </CardBody>
          </Card>
        </section>

        {/* Loans */}
        <section>
          <SectionHeading
            title="Active loans"
            description="Outstanding obligations and their repayment windows."
            action={
              <Link
                to="/loans"
                className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:text-brand-900"
              >
                All loans
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            }
          />

          {activeLoans.length > 0 ? (
            <div className="grid gap-4 lg:grid-cols-[1fr_minmax(0,340px)]">
              <Card>
                <div className="divide-y divide-hairline-soft">
                  {activeLoans.slice(0, 3).map((loan) => (
                    <div key={loan.loanId} className="p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2.5">
                            <span className="font-display text-2xl font-semibold tabular tracking-tight">
                              {formatEthCompact(loan.amount)} 0G
                            </span>
                            <LoanStatusBadge loan={loan} />
                          </div>
                          <p className="mt-1 font-mono text-xs text-ink-soft">{loan.loanId}</p>
                        </div>

                        <div className="text-right">
                          <p className="text-2xs uppercase tracking-wider text-ink-faint">
                            Repayment
                          </p>
                          <p className="mt-0.5 text-sm font-semibold tabular">
                            {formatEthCompact(loan.totalRepayment)} 0G
                          </p>
                        </div>
                      </div>

                      <div className="mt-4">
                        <div className="mb-2 flex items-center justify-between text-xs text-ink-muted">
                          <span>Term elapsed</span>
                          <span className="font-semibold tabular text-ink">
                            {Math.round(loan.progress * 100)}%
                          </span>
                        </div>
                        <ProgressBar
                          value={loan.progress}
                          tone={loan.overdue ? 'critical' : 'brand'}
                          label="Term progress"
                        />
                      </div>

                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                        <span className="inline-flex items-center gap-1.5 text-xs text-ink-muted">
                          <CalendarClock className="h-3.5 w-3.5" />
                          {loan.overdue
                            ? `Overdue since ${formatDate(loan.dueDate)}`
                            : `Due ${formatDate(loan.dueDate)} · ${loan.daysRemaining}d left`}
                        </span>
                        <Link
                          to={`/loans/${loan.loanId}`}
                          className={buttonStyles('secondary', 'sm')}
                        >
                          Manage
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card surface="brand" className="flex flex-col justify-between p-6">
                <div>
                  <p className="text-2xs font-semibold uppercase tracking-wider text-brand-200">
                    Next payment due
                  </p>
                  {nextDue ? (
                    <>
                      <p className="mt-3 font-display text-4xl font-semibold tabular tracking-tight text-white">
                        {formatEthCompact(nextDue.totalRepayment)}
                        <span className="ml-1.5 text-base font-semibold text-brand-200">0G</span>
                      </p>
                      <p className="mt-2 text-sm text-brand-100">
                        {formatDate(nextDue.dueDate)} ·{' '}
                        {nextDue.overdue ? 'Overdue' : `in ${nextDue.daysRemaining} days`}
                      </p>
                    </>
                  ) : null}
                </div>

                {nextDue ? (
                  <Link
                    to={`/loans/${nextDue.loanId}`}
                    className={buttonStyles('inverse', 'md', 'mt-8 w-full')}
                  >
                    Repay loan
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                ) : null}
              </Card>
            </div>
          ) : (
            <Card>
              <EmptyState
                icon={<BadgeDollarSign className="h-5 w-5" />}
                title="No active loans"
                description={
                  loans.length > 0
                    ? 'All your loans are settled. Your repayment history strengthens future assessments.'
                    : 'Once approved, your loans and repayment schedule appear here.'
                }
                action={
                  <Link to="/borrow" className={buttonStyles('primary', 'md')}>
                    Request a loan
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                }
              />
            </Card>
          )}
        </section>

        {/* Activity */}
        <section>
          <SectionHeading
            title="Recent activity"
            description="Assessments, loan events and wallet sessions."
            action={
              <Link
                to="/activity"
                className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:text-brand-900"
              >
                View all
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            }
          />

          <Card>
            {activities.length > 0 ? (
              <CardBody>
                <ActivityFeed items={activities.slice(0, 5)} />
              </CardBody>
            ) : (
              <EmptyState
                icon={<ActivityIcon className="h-5 w-5" />}
                title="Nothing recorded yet"
                description="Your assessments, loan requests and repayments will appear here as they happen."
              />
            )}
          </Card>
        </section>
      </div>
    </ConnectGate>
  );
}
