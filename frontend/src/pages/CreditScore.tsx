import { useCallback, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ChevronDown,
  Coins,
  Cpu,
  Gauge,
  History,
  Layers,
  RefreshCw,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button, buttonStyles } from '@/components/ui/Button';
import { EmptyState, ErrorState, InlineNotice, Skeleton } from '@/components/ui/Feedback';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatRow } from '@/components/ui/MetricCard';
import { ScoreGauge } from '@/components/charts/ScoreGauge';
import { AreaChart } from '@/components/charts/AreaChart';
import { DonutChart, DonutLegend, type DonutSlice } from '@/components/charts/DonutChart';
import { FactorList, type CreditFactorLike } from '@/components/credit/FactorList';
import { AiRiskCard } from '@/components/credit/AiRiskCard';
import { ReputationRow } from '@/components/credit/ReputationRow';
import { ScoreSourceLegend } from '@/components/credit/ScoreSourceLegend';
import { VerificationStatusBadge } from '@/components/credit/VerificationStatusBadge';
import { ConnectGate } from '@/components/wallet/ConnectGate';
import { useCredit } from '@/contexts/CreditContext';
import { useLoans } from '@/contexts/LoansContext';
import { useWallet } from '@/hooks/useWallet';
import {
  SCORE_BANDS,
  bandForScore,
  factorLabel,
  ratingLabel,
  ratingSummary,
  toneForLevel,
} from '@/lib/credit';
import {
  formatDateTime,
  formatEth,
  formatNumber,
  formatPercent,
  formatTimeAgo,
} from '@/lib/format';

const FACTOR_COLORS = ['#0D8298', '#16A2B4', '#3FC0CE', '#7BD9E2'];

export default function CreditScore() {
  const { balance, balanceSymbol, transactionCount, chainName } = useWallet();
  const {
    profile,
    history,
    isLoading,
    isRefreshingScore,
    isRunningAi,
    error,
    refresh,
    requestAiAssessment,
    analysisType,
    setAnalysisType,
    displayedAi,
  } = useCredit();
  const { loans } = useLoans();

  const tone = toneForLevel(profile?.riskLevel);
  const factors = useMemo(
    () => (profile?.factors ?? []) as CreditFactorLike[],
    [profile?.factors],
  );

  const trend = useMemo(
    () =>
      history.map((point) => ({
        label: formatDateTime(point.timestamp),
        value: point.score,
      })),
    [history],
  );

  const slices = useMemo<DonutSlice[]>(
    () =>
      factors.map((factor, index) => ({
        label: factorLabel(factor.factor),
        value: factor.weight,
        color: FACTOR_COLORS[index % FACTOR_COLORS.length],
      })),
    [factors],
  );

  const repaidCount = loans.filter((loan) => loan.status === 'repaid').length;
  const repaymentRate = loans.length > 0 ? repaidCount / loans.length : null;

  const aiSectionRef = useRef<HTMLElement>(null);
  const revealAiAssessment = useCallback(() => {
    aiSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);
  const runAiAssessment = useCallback(() => {
    revealAiAssessment();
    void requestAiAssessment();
  }, [revealAiAssessment, requestAiAssessment]);

  return (
    <ConnectGate
      title="Your credit assessment"
      description="Connect a wallet to generate a transparent, factor-by-factor credit assessment from your on-chain history."
    >
      <div className="space-y-8">
        <PageHeader
          eyebrow={
            <Badge tone="brand" icon={<Sparkles className="h-3 w-3" />}>
              {profile?.poweredBy ?? 'On-chain model'}
            </Badge>
          }
          title="Credit score"
          description="Deterministic Credora score from on-chain facts. 0G Compute assessment is separate and only shown when Compute succeeds."
          actions={
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                onClick={() => void refresh()}
                loading={isRefreshingScore}
                disabled={isRunningAi}
                iconLeft={<RefreshCw className="h-4 w-4" />}
              >
                Refresh score
              </Button>
              <Button
                variant="primary"
                onClick={runAiAssessment}
                loading={isRunningAi}
                disabled={isRefreshingScore}
                iconLeft={<Cpu className="h-4 w-4" />}
                iconRight={<ChevronDown className="h-4 w-4" />}
              >
                Run 0G Compute assessment
              </Button>
            </div>
          }
        />

        <button
          type="button"
          onClick={revealAiAssessment}
          className="inline-flex items-center gap-1.5 text-sm text-ink-muted transition-colors hover:text-ink"
        >
          <ChevronDown className="h-4 w-4" aria-hidden />
          0G Compute assessment is below
        </button>

        {error ? (
          <Card>
            <ErrorState description={error} onRetry={() => void refresh()} />
          </Card>
        ) : null}

        {/* Headline score */}
        <section className="grid gap-4 lg:grid-cols-[minmax(0,420px)_1fr]">
          <Card surface="brand" elevation="floating" className="relative overflow-hidden">
            <div className="absolute inset-0 cd-grid-texture opacity-40" aria-hidden />
            <div className="relative flex flex-col items-center px-6 py-10">
              {isLoading && !profile ? (
                <Skeleton className="h-[240px] w-[240px] rounded-full" />
              ) : profile ? (
                <>
                  <div className="rounded-2xl bg-surface p-4 shadow-pop">
                    <ScoreGauge
                      score={profile.creditScore}
                      tone={tone}
                      size={224}
                      label={ratingLabel(profile.riskLevel)}
                    />
                  </div>

                  <p className="mt-6 max-w-sm text-center text-sm leading-relaxed text-brand-100">
                    {ratingSummary(profile.riskLevel)}
                  </p>

                  <div className="mt-6 flex w-full items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                    <div>
                      <p className="text-2xs uppercase tracking-wider text-brand-200">Confidence</p>
                      <p className="mt-0.5 font-display text-lg font-semibold tabular text-white">
                        {formatPercent(profile.confidence, 0)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xs uppercase tracking-wider text-brand-200">Updated</p>
                      <p className="mt-0.5 font-display text-lg font-semibold text-white">
                        {formatTimeAgo(profile.timestamp)}
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <EmptyState
                  icon={<Gauge className="h-5 w-5" />}
                  title="No assessment yet"
                  className="text-white [&_h4]:text-white [&_p]:text-brand-100"
                />
              )}
            </div>
          </Card>

          <div className="grid gap-4">
            {/* Bands */}
            <Card>
              <CardHeader
                title="Rating bands"
                description="Thresholds applied by the scoring model."
                icon={<Layers className="h-4 w-4" />}
              />
              <CardBody className="space-y-2 pt-4">
                {SCORE_BANDS.map((bandItem) => {
                  const active = profile
                    ? bandForScore(profile.creditScore).label === bandItem.label
                    : false;

                  return (
                    <div
                      key={bandItem.label}
                      className={`flex items-center justify-between rounded-xl border px-4 py-3 transition-all ${
                        active
                          ? 'border-edge-brand bg-brand-50 shadow-card'
                          : 'border-hairline-soft bg-surface'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Badge tone={bandItem.tone} dot={active} pulse={active}>
                          {bandItem.label}
                        </Badge>
                        {active ? (
                          <span className="text-xs font-semibold text-brand-700">You are here</span>
                        ) : null}
                      </div>
                      <span className="text-sm font-semibold tabular text-ink-muted">
                        {bandItem.from}–{bandItem.to}
                      </span>
                    </div>
                  );
                })}
              </CardBody>
            </Card>

            {/* Financial behaviour */}
            <Card>
              <CardHeader
                title="Financial behaviour"
                description="The wallet signals feeding this assessment."
                icon={<Coins className="h-4 w-4" />}
              action={<VerificationStatusBadge status={profile?.verification?.status} />}
              />
              <div className="grid gap-x-8 px-6 pb-6 pt-2 sm:grid-cols-2">
                <StatRow
                  label="Wallet balance"
                  value={balance ? `${formatEth(balance)} ${balanceSymbol}` : '—'}
                />
                <StatRow label="Transaction count" value={formatNumber(transactionCount)} />
                <StatRow label="Network" value={chainName ?? '—'} />
                <StatRow
                  label="Last activity"
                  value={
                    profile?.walletData?.lastActivity
                      ? formatTimeAgo(profile.walletData.lastActivity)
                      : '—'
                  }
                />
                <StatRow label="Loans originated" value={formatNumber(loans.length)} />
                <StatRow
                  label="Repayment rate"
                  value={repaymentRate === null ? 'No history' : formatPercent(repaymentRate, 0)}
                  tone={repaymentRate === 1 ? 'positive' : 'default'}
                />
              </div>
            </Card>
          </div>
        </section>

        {/* Factors */}
        <section className="grid gap-4 lg:grid-cols-[1fr_minmax(0,360px)]">
          <Card>
            <CardHeader
              title="What drives your score"
              description="Weighted factors returned by the credit model, with their direction of impact."
              icon={<TrendingUp className="h-4 w-4" />}
            />
            <CardBody className="pt-4">
              {isRefreshingScore && factors.length === 0 ? (
                <div className="space-y-5">
                  {[0, 1, 2].map((i) => (
                    <Skeleton key={i} className="h-14 w-full" />
                  ))}
                </div>
              ) : factors.length > 0 ? (
                <FactorList factors={factors} />
              ) : (
                <EmptyState
                  icon={<TrendingUp className="h-5 w-5" />}
                  title="No factors available"
                  description="Run an assessment to see the weighted inputs behind your score."
                />
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Factor weighting" description="Relative influence on the result." />
            <CardBody className="pt-4">
              {slices.length > 0 ? (
                <>
                  <div className="flex justify-center">
                    <DonutChart
                      slices={slices}
                      centerValue={profile ? String(profile.creditScore) : '—'}
                      centerLabel="Score"
                    />
                  </div>
                  <div className="mt-6">
                    <DonutLegend slices={slices} />
                  </div>
                </>
              ) : (
                <EmptyState title="Awaiting assessment" className="py-8" />
              )}
            </CardBody>
          </Card>
        </section>

        <section ref={aiSectionRef} id="ai-assessment" className="scroll-mt-24 space-y-4">
          <ScoreSourceLegend />
          <AiRiskCard
            loading={isRunningAi}
            analysisType={analysisType}
            onAnalysisTypeChange={setAnalysisType}
            onRun={runAiAssessment}
            onRetry={runAiAssessment}
            ai={displayedAi}
          />
          <Card>
            <CardHeader title="Reputation" description="Earned badges only." />
            <CardBody>
              <ReputationRow badges={profile?.reputation ?? []} />
            </CardBody>
          </Card>
        </section>

        {/* History */}
        <section>
          <Card>
            <CardHeader
              title="Score history"
              description="Each point is a recorded assessment for this wallet."
              icon={<History className="h-4 w-4" />}
              action={
                history.length > 0 ? (
                  <Badge tone="neutral">{history.length} recorded</Badge>
                ) : null
              }
            />
            <CardBody className="pt-4">
              {trend.length >= 2 ? (
                <AreaChart data={trend} height={260} min={0} max={1000} />
              ) : (
                <EmptyState
                  icon={<History className="h-5 w-5" />}
                  title="History is still building"
                  description="Credora stores every assessment it generates for this wallet. Your trend line appears from the second reading onward — nothing is back-filled or simulated."
                />
              )}
            </CardBody>
          </Card>
        </section>

        {/* Model provenance */}
        <section>
          <Card surface="muted">
            <CardHeader
              title="Model and provenance"
              description="Where this assessment came from."
              icon={<Cpu className="h-4 w-4" />}
              action={<VerificationStatusBadge status={profile?.verification?.status} />}
            />
            <div className="grid gap-x-8 px-6 pb-6 pt-2 sm:grid-cols-2 lg:grid-cols-3">
              <StatRow
                label="Engine"
                value={profile?.poweredBy ?? 'Credora on-chain model'}
              />
              <StatRow label="Model version" value={profile?.modelVersion ?? '—'} />
              <StatRow
                label="Assessed at"
                value={profile ? formatDateTime(profile.timestamp) : '—'}
              />
            </div>
            <CardBody className="pt-0">
              <InlineNotice tone="info">
                The Credora score is a deterministic weighted sum of on-chain features
                {profile?.methodology ? ` (${profile.methodology})` : ''}. It is not produced by Compute.
                A 0G Compute assessment appears only after a real router response passes schema validation.
                Verified means write → retrieve → content-hash check on 0G Storage.
              </InlineNotice>
            </CardBody>
          </Card>
        </section>

        <div className="flex flex-wrap items-center justify-between gap-4 rounded-card border border-hairline bg-surface px-6 py-5">
          <div>
            <p className="text-sm font-semibold">Ready to put your rating to work?</p>
            <p className="mt-0.5 text-sm text-ink-muted">
              Borrow against your assessment on fixed, contract-enforced terms.
            </p>
          </div>
          <Link to="/borrow" className={buttonStyles('primary', 'md')}>
            Request a loan
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </ConnectGate>
  );
}
