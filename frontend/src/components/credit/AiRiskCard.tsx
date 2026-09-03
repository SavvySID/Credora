import { Cpu, Shield } from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Field, Select } from '@/components/ui/Field';
import { InlineNotice, Skeleton } from '@/components/ui/Feedback';
import { VerificationStatusBadge } from '@/components/credit/VerificationStatusBadge';
import type { Tone } from '@/lib/credit';
import { aiRiskTone } from '@/lib/credit';
import { formatDateTime, formatPercent } from '@/lib/format';
import { ANALYSIS_OPTIONS, analysisLabel, type AnalysisType } from '@/lib/analysis';
import { isPendingAi } from '@/lib/aiAssessment';
import type { CreditProfileDto } from '@/services/api';

export type AiRiskView = Pick<
  CreditProfileDto['ai'],
  'available' | 'riskLevel' | 'riskScore' | 'summary' | 'blockedReason' | 'model'
> & {
  cached?: boolean;
} & Partial<
    Pick<
      CreditProfileDto['ai'],
      'factors' | 'timestamp' | 'latencyMs' | 'confidence' | 'verification' | 'analysisType' | 'analysisLabel' | 'riskOutlook'
    >
  >;

function AnalysisControls({
  analysisType,
  onAnalysisTypeChange,
  onRun,
  running,
  disabled,
}: {
  analysisType: AnalysisType;
  onAnalysisTypeChange: (type: AnalysisType) => void;
  onRun?: () => void;
  running: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-3">
      <Field
        label="Ask 0G Compute to analyze"
        htmlFor="credora-ai-analysis"
        labelClassName="text-base font-semibold"
      >
        <Select
          id="credora-ai-analysis"
          value={analysisType}
          disabled={running}
          highlighted
          onChange={(event) => onAnalysisTypeChange(event.target.value as AnalysisType)}
        >
          {ANALYSIS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </Field>
      {onRun ? (
        <Button
          variant="primary"
          size="sm"
          onClick={onRun}
          loading={running}
          disabled={disabled || running}
          iconLeft={<Cpu className="h-4 w-4" />}
        >
          Run 0G Compute assessment
        </Button>
      ) : null}
    </div>
  );
}

export function AiRiskCard({
  ai,
  compact = false,
  loading = false,
  onRetry,
  analysisType,
  onAnalysisTypeChange,
  onRun,
}: {
  ai: AiRiskView | null | undefined;
  compact?: boolean;
  loading?: boolean;
  onRetry?: () => void;
  analysisType?: AnalysisType;
  onAnalysisTypeChange?: (type: AnalysisType) => void;
  onRun?: () => void;
}) {
  const selected = analysisType ?? ai?.analysisType ?? 'general';
  const selectedLabel = analysisLabel(selected);
  const showControls = Boolean(onAnalysisTypeChange);

  if (loading) {
    return (
      <Card>
        <CardHeader
          title="0G Compute assessment"
          description="Calling 0G Compute with the current on-chain facts. The Credora score above is unchanged."
          icon={<Cpu className="h-4 w-4" />}
          action={
            <Badge tone="neutral" size="sm">
              Processing
            </Badge>
          }
        />
        <CardBody className="space-y-3">
          {showControls && onAnalysisTypeChange ? (
            <AnalysisControls
              analysisType={selected}
              onAnalysisTypeChange={onAnalysisTypeChange}
              running
              disabled
            />
          ) : null}
          <InlineNotice tone="info" title="0G Compute is running">
            Analyzing {selectedLabel.toLowerCase()} from structured on-chain facts. This is not the
            Credora credit score.
          </InlineNotice>
          <Skeleton className="h-16 w-full" />
          {!compact ? <Skeleton className="h-24 w-full" /> : null}
        </CardBody>
      </Card>
    );
  }

  if (!ai || !ai.available) {
    const pending = isPendingAi(ai);
    const noticeTitle = pending ? 'Ready for 0G Compute' : 'Could not complete assessment';
    const noticeBody = pending
      ? `Click Run 0G Compute assessment to generate a ${selectedLabel.toLowerCase()} from your on-chain facts. The Credora score stays deterministic.`
      : (ai?.blockedReason ?? '0G Compute did not return a result. Try again.');

    return (
      <Card>
        <CardHeader
          title="0G Compute assessment"
          description="0G Compute structured risk assessment. Independent of the Credora score."
          icon={<Shield className="h-4 w-4" />}
        />
        <CardBody className="space-y-4">
          {showControls && onAnalysisTypeChange ? (
            <AnalysisControls
              analysisType={selected}
              onAnalysisTypeChange={onAnalysisTypeChange}
              onRun={onRun ?? onRetry}
              running={false}
            />
          ) : null}
          <InlineNotice tone={pending ? 'info' : 'caution'} title={noticeTitle}>
            {noticeBody}
          </InlineNotice>
          {!showControls && onRetry ? (
            <Button variant="secondary" size="sm" onClick={onRetry} iconLeft={<Cpu className="h-4 w-4" />}>
              Run 0G Compute assessment
            </Button>
          ) : null}
        </CardBody>
      </Card>
    );
  }

  const tone: Tone = aiRiskTone(ai.riskLevel);
  const riskFactors = ai.factors?.keyRiskFactors ?? [];
  const positiveFactors = ai.factors?.positiveFactors ?? [];
  const label = ai.analysisLabel ?? selectedLabel;

  return (
    <Card>
      <CardHeader
        title="0G Compute assessment"
        description="Produced by 0G Compute from structured on-chain facts. Independent of the Credora credit score."
        icon={<Shield className="h-4 w-4" />}
        action={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Badge tone="brand" size="sm">
              0G Compute
            </Badge>
            <Badge tone="neutral" size="sm">
              {label}
            </Badge>
            {ai.verification && ai.verification.status !== 'unverified' ? (
              <VerificationStatusBadge status={ai.verification.status} />
            ) : null}
          </div>
        }
      />
      <CardBody className="space-y-4">
        {showControls && onAnalysisTypeChange ? (
          <AnalysisControls
            analysisType={selected}
            onAnalysisTypeChange={onAnalysisTypeChange}
            onRun={onRun ?? onRetry}
            running={false}
          />
        ) : null}
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <p className="text-2xs uppercase tracking-wider text-ink-muted">Compute risk score</p>
            <p className="font-display text-3xl font-semibold tabular">{ai.riskScore ?? '—'}</p>
            <p className="mt-0.5 text-2xs text-ink-faint">0–1000 · higher means more risk · not the Credora score</p>
          </div>
          {ai.riskLevel ? <Badge tone={tone}>{ai.riskLevel} risk</Badge> : null}
          {ai.riskOutlook ? (
            <Badge tone="neutral" size="sm">
              Outlook {ai.riskOutlook}
            </Badge>
          ) : null}
          {ai.cached ? (
            <Badge tone="neutral" size="sm">
              Cached
            </Badge>
          ) : null}
        </div>
        {!compact && ai.summary ? (
          <p className="text-sm leading-relaxed text-ink-muted">{ai.summary}</p>
        ) : null}
        {!compact && (riskFactors.length > 0 || positiveFactors.length > 0) ? (
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <p className="text-2xs uppercase tracking-wider text-ink-muted">Key risk factors</p>
              {riskFactors.length > 0 ? (
                <ul className="mt-2 list-disc space-y-1 pl-4 text-sm">
                  {riskFactors.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-ink-faint">None returned</p>
              )}
            </div>
            <div>
              <p className="text-2xs uppercase tracking-wider text-ink-muted">Positive factors</p>
              {positiveFactors.length > 0 ? (
                <ul className="mt-2 list-disc space-y-1 pl-4 text-sm">
                  {positiveFactors.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-ink-faint">None returned</p>
              )}
            </div>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-2xs text-ink-faint">
          {ai.model ? <span>Model {ai.model}</span> : null}
          {ai.timestamp ? <span>Generated {formatDateTime(ai.timestamp)}</span> : null}
          {typeof ai.latencyMs === 'number' ? <span>{ai.latencyMs} ms</span> : null}
          {typeof ai.confidence === 'number' && ai.confidence > 0 ? (
            <span>Confidence {formatPercent(ai.confidence, 0)}</span>
          ) : null}
        </div>
      </CardBody>
    </Card>
  );
}
