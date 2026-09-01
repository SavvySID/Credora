import { useEffect, useMemo, useState } from 'react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { StatRow } from '@/components/ui/MetricCard';
import { InlineNotice } from '@/components/ui/Feedback';
import { AiRiskCard } from '@/components/credit/AiRiskCard';
import { ReputationRow } from '@/components/credit/ReputationRow';
import { ScoreSourceLegend } from '@/components/credit/ScoreSourceLegend';
import { VerificationStatusBadge } from '@/components/credit/VerificationStatusBadge';
import { FactorList } from '@/components/credit/FactorList';
import { api, creditAiFromRiskAssessment, type CreditProfileDto } from '@/services/api';
import { DEFAULT_ANALYSIS_TYPE, type AnalysisType } from '@/lib/analysis';
import { formatEth, formatNumber, formatPercent } from '@/lib/format';
import toast from 'react-hot-toast';

export function BorrowerRiskPanel({ profile }: { profile: CreditProfileDto }) {
  const [analysisType, setAnalysisType] = useState<AnalysisType>(DEFAULT_ANALYSIS_TYPE);
  const [running, setRunning] = useState(false);
  const [aiOverride, setAiOverride] = useState<CreditProfileDto['ai'] | null>(null);

  useEffect(() => {
    setAiOverride(null);
    setAnalysisType(DEFAULT_ANALYSIS_TYPE);
  }, [profile.wallet]);

  const selectedAi = useMemo(() => {
    if (aiOverride && (aiOverride.analysisType ?? analysisType) === analysisType) return aiOverride;
    return profile.aiByAnalysis?.[analysisType] ?? (analysisType === 'general' ? profile.ai : null);
  }, [aiOverride, analysisType, profile]);

  async function runAssessment() {
    setRunning(true);
    try {
      const result = await api.riskAssessment(profile.wallet, 'POST', analysisType);
      const fromPost = creditAiFromRiskAssessment(result);
      setAiOverride(fromPost);
      if (fromPost.available) toast.success('AI risk assessment ready');
      else toast.error(fromPost.blockedReason ?? 'AI assessment unavailable');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to run AI assessment');
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ScoreSourceLegend />
        <VerificationStatusBadge status={profile.verification?.status} />
      </div>

      <InlineNotice tone="info" title="Risk intelligence only">
        This desk does not fund borrowers, approve loans, or provide capital. Loan.sol is
        accounting-only and supports one loan per borrower. Defaulted is unsupported unless a
        LoanDefaulted event is indexed.
      </InlineNotice>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Credora score" description="Deterministic on-chain model. Not AI." />
          <CardBody>
            <p className="font-display text-4xl font-semibold tabular">
              {profile.deterministic.score}
              <span className="ml-2 text-base font-medium text-ink-muted">/1000</span>
            </p>
            <p className="mt-2 text-sm text-ink-muted">{profile.deterministic.creditBand}</p>
            <p className="mt-1 text-xs text-ink-faint">
              Confidence {Math.round(profile.deterministic.confidence * 100)}%
            </p>
          </CardBody>
        </Card>
        <AiRiskCard
          compact
          ai={selectedAi}
          loading={running}
          analysisType={analysisType}
          onAnalysisTypeChange={(type) => {
            setAnalysisType(type);
            setAiOverride(null);
          }}
          onRun={() => void runAssessment()}
        />
      </div>

      <Card>
        <CardHeader title="Reputation" description="Shown only when the rule is satisfied." />
        <CardBody>
          <ReputationRow badges={profile.reputation.earned} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Deterministic factors" />
        <CardBody>
          <FactorList factors={profile.deterministic.factors} />
        </CardBody>
      </Card>

      {selectedAi?.available ? (
        <Card>
          <CardHeader title="AI factors" description="Returned only after a validated 0G Compute response." />
          <CardBody className="grid gap-6 sm:grid-cols-2">
            <div>
              <p className="text-2xs uppercase tracking-wider text-ink-muted">Risk factors</p>
              {selectedAi.factors.keyRiskFactors.length > 0 ? (
                <ul className="mt-2 list-disc space-y-1 pl-4 text-sm">
                  {selectedAi.factors.keyRiskFactors.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-ink-faint">None returned</p>
              )}
            </div>
            <div>
              <p className="text-2xs uppercase tracking-wider text-ink-muted">Positive factors</p>
              {selectedAi.factors.positiveFactors.length > 0 ? (
                <ul className="mt-2 list-disc space-y-1 pl-4 text-sm">
                  {selectedAi.factors.positiveFactors.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-ink-faint">None returned</p>
              )}
            </div>
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader title="Wallet and loans" />
        <div className="grid gap-x-8 px-6 pb-6 pt-2 sm:grid-cols-2">
          <StatRow
            label="Balance"
            value={`${formatEth(profile.walletSummary.balanceFormatted)} 0G`}
          />
          <StatRow label="Nonce" value={formatNumber(profile.walletSummary.transactionCount)} />
          <StatRow label="Active loans" value={formatNumber(profile.loans.stats.active)} />
          <StatRow label="Repaid" value={formatNumber(profile.loans.stats.repaid)} />
          <StatRow
            label="Repayment rate"
            value={
              profile.loans.stats.repaymentRate === null
                ? 'No settled loans'
                : formatPercent(profile.loans.stats.repaymentRate, 0)
            }
          />
          <StatRow label="Overdue" value={profile.walletSummary.overdue ? 'Yes' : 'No'} />
        </div>
      </Card>
    </div>
  );
}
