import type { FeaturesDto, RecordDto } from './indexer';
import { indexerClient } from './indexer';
import { assessBorrowerRisk, computeModelId, computeCapability } from './compute';
import { SCORING_MODEL, describeMethodology, scoreWallet, type ScoreResult } from './scoring';
import type { AiRiskOutput } from './riskSchema';
import {
  ANALYSIS_FOCUS,
  ANALYSIS_TYPES,
  DEFAULT_ANALYSIS_TYPE,
  analysisCacheModelKey,
  analysisLabel,
  isAnalysisType,
  parseRiskOutlook,
  type AnalysisType,
  type RiskOutlook,
} from './analysis';

function modelKey(analysisType: AnalysisType = DEFAULT_ANALYSIS_TYPE): string {
  return analysisCacheModelKey(computeModelId(), analysisType);
}

export interface AiAssessmentView {
  available: boolean;
  riskLevel: AiRiskOutput['riskLevel'] | null;
  riskScore: number | null;
  keyRiskFactors: string[];
  positiveFactors: string[];
  assessmentSummary: string | null;
  confidence: number | null;
  model: string | null;
  latencyMs: number | null;
  blockedReason: string | null;
  cached: boolean;
  sourceDataHash: string | null;
  record: RecordDto | null;
  analysisType: AnalysisType;
  analysisLabel: string;
  riskOutlook: RiskOutlook | null;
}

function recordAnalysisType(record: RecordDto): AnalysisType {
  return isAnalysisType(record.values.analysisType) ? record.values.analysisType : DEFAULT_ANALYSIS_TYPE;
}

function fromRecord(record: RecordDto, cached: boolean, latencyMs: number | null): AiAssessmentView {
  const analysisType = recordAnalysisType(record);
  const storedLabel =
    typeof record.values.analysisLabel === 'string' ? record.values.analysisLabel : analysisLabel(analysisType);
  return {
    available: true,
    riskLevel: (record.values.aiRiskLevel as AiRiskOutput['riskLevel']) ?? null,
    riskScore: typeof record.values.aiRiskScore === 'number' ? record.values.aiRiskScore : null,
    keyRiskFactors: Array.isArray(record.values.riskFactors)
      ? (record.values.riskFactors as string[])
      : [],
    positiveFactors: Array.isArray(record.values.positiveFactors)
      ? (record.values.positiveFactors as string[])
      : [],
    assessmentSummary:
      typeof record.values.assessmentSummary === 'string' ? record.values.assessmentSummary : null,
    confidence: typeof record.values.confidence === 'number' ? record.values.confidence : null,
    model: typeof record.meta.model === 'string' ? String(record.meta.model) : computeModelId(),
    latencyMs,
    blockedReason: null,
    cached,
    sourceDataHash:
      typeof record.values.sourceDataHash === 'string' ? record.values.sourceDataHash : null,
    record,
    analysisType,
    analysisLabel: storedLabel,
    riskOutlook: parseRiskOutlook(record.values.riskOutlook),
  };
}

function unavailable(
  reason: string,
  hash: string | null,
  analysisType: AnalysisType = DEFAULT_ANALYSIS_TYPE,
  cached = false,
): AiAssessmentView {
  return {
    available: false,
    riskLevel: null,
    riskScore: null,
    keyRiskFactors: [],
    positiveFactors: [],
    assessmentSummary: null,
    confidence: null,
    model: computeModelId() || null,
    latencyMs: null,
    blockedReason: reason,
    cached,
    sourceDataHash: hash,
    record: null,
    analysisType,
    analysisLabel: analysisLabel(analysisType),
    riskOutlook: null,
  };
}

function borrowerFacts(
  wallet: string,
  features: FeaturesDto,
  score: ScoreResult,
  analysisType: AnalysisType,
) {
  const facts: Record<string, unknown> = {
    chainId: features.chainId,
    wallet,
    balanceWei: features.balanceWei,
    balanceFormatted: features.balanceFormatted,
    transactionCount: features.transactionCount,
    observedTransactions: features.observedTransactions,
    firstSeen: features.firstSeen,
    lastActivity: features.lastActivity,
    txMix: features.txMix ?? { inbound: 0, outbound: 0, self: 0 },
    outstandingWei: features.outstandingWei ?? '0',
    overdue: features.overdue ?? false,
    activeLoanCount: features.activeLoanCount ?? 0,
    repaidLoanCount: features.repaidLoanCount ?? 0,
    repayment: features.repayment,
    deterministicScore: score.creditScore,
    creditBand: score.creditBand,
    deterministicFactors: score.factors.map((factor) => ({
      factor: factor.factor,
      observed: factor.observed,
      normalized: Number(factor.normalized.toFixed(4)),
      impact: factor.impact,
    })),
    missingInputs: score.completeness.missing,
    instructions: [
      'Do not invent loans, transactions, balances, or scores.',
      'Do not modify deterministicScore.',
      'riskScore is independent: higher means more risk.',
      'riskLevel must be exactly Low, Medium, or High. Do not copy creditBand.',
    ],
  };

  if (analysisType !== 'general') {
    facts.analysisType = analysisType;
    facts.analysisFocus = ANALYSIS_FOCUS[analysisType];
    (facts.instructions as string[]).push(`Focus this assessment on: ${ANALYSIS_FOCUS[analysisType]}`);
    (facts.instructions as string[]).push(
      'Return the same JSON keys as a general assessment, including a non-empty assessmentSummary string.',
    );
    facts.requiredOutputKeys = [
      'riskLevel',
      'riskScore',
      'keyRiskFactors',
      'positiveFactors',
      'assessmentSummary',
    ];
  }

  return facts;
}

export async function getCachedAiAssessment(
  wallet: string,
  sourceDataHash: string,
  analysisType: AnalysisType = DEFAULT_ANALYSIS_TYPE,
): Promise<AiAssessmentView | null> {
  if (!computeModelId()) return null;
  const lookup = await indexerClient.assessmentCache(
    wallet,
    sourceDataHash,
    'ai_risk_assessment',
    modelKey(analysisType),
  );
  if (!lookup.hit || !lookup.record) return null;
  return fromRecord(lookup.record, true, 0);
}

/** Latest indexed AI record for this wallet + source hash + analysis type. */
export function aiFromRecordList(
  records: RecordDto[],
  sourceDataHash: string | null,
  analysisType: AnalysisType = DEFAULT_ANALYSIS_TYPE,
): AiAssessmentView | null {
  const match = records.find((record) => {
    if (record.eventType !== 'ai_risk_assessment') return false;
    if (recordAnalysisType(record) !== analysisType) return false;
    if (!sourceDataHash) return true;
    const stored = record.values.sourceDataHash;
    return typeof stored !== 'string' || stored === sourceDataHash;
  });
  if (!match) return null;
  return fromRecord(match, true, 0);
}

export function aiByAnalysisFromRecords(
  records: RecordDto[],
  sourceDataHash: string | null,
): Partial<Record<AnalysisType, AiAssessmentView>> {
  const out: Partial<Record<AnalysisType, AiAssessmentView>> = {};
  for (const type of ANALYSIS_TYPES) {
    const view = aiFromRecordList(records, sourceDataHash, type);
    if (view) out[type] = view;
  }
  return out;
}

/**
 * Returns a cached AI assessment when source data + model + analysis type match.
 * On a miss, calls 0G Compute. Never fabricates an assessment.
 */
export async function evaluateAiRisk(
  wallet: string,
  features: FeaturesDto,
  score: ScoreResult,
  analysisType: AnalysisType = DEFAULT_ANALYSIS_TYPE,
): Promise<AiAssessmentView> {
  const hash = features.sourceDataHash ?? null;
  if (!hash) {
    return unavailable(
      'Indexer did not return sourceDataHash; cannot cache or run AI assessment.',
      null,
      analysisType,
    );
  }

  const cached = await getCachedAiAssessment(wallet, hash, analysisType);
  if (cached) return cached;

  try {
    const indexed = await indexerClient.records(wallet, ['ai_risk_assessment'], 40);
    const existing = aiFromRecordList(indexed.records, hash, analysisType);
    if (existing) return existing;
  } catch {
    /* Cache miss is recoverable; a records lookup failure should not skip Compute. */
  }

  const capability = computeCapability();
  if (!capability.available) {
    return unavailable(capability.blockedReason ?? '0G Compute is not configured.', hash, analysisType);
  }

  const inference = await assessBorrowerRisk(
    JSON.stringify(borrowerFacts(wallet, features, score, analysisType)),
    analysisType,
  );
  if (!inference.available || !inference.output) {
    return unavailable(inference.blockedReason ?? '0G Compute inference failed.', hash, analysisType);
  }

  const outlook =
    analysisType === 'risk-outlook' ? parseRiskOutlook(inference.output.riskOutlook) : null;

  const saved = await indexerClient.saveAssessment({
    wallet,
    eventType: 'ai_risk_assessment',
    confidence: inference.output.confidence ?? 0,
    model: computeModelId(),
    methodology: `0G Compute structured risk JSON via ${inference.model ?? computeModelId()} (${SCORING_MODEL.id} baseline ${score.creditScore}/1000 ${score.creditBand}; ${analysisLabel(analysisType)})`,
    sourceDataHash: hash,
    deterministicScore: score.creditScore,
    aiRiskScore: inference.output.riskScore,
    aiRiskLevel: inference.output.riskLevel,
    riskFactors: inference.output.keyRiskFactors,
    positiveFactors: inference.output.positiveFactors,
    assessmentSummary: inference.output.assessmentSummary,
    modelVersion: analysisType === 'general' ? 'router' : `router:${analysisType}`,
    analysisType,
    analysisLabel: analysisLabel(analysisType),
    ...(outlook ? { riskOutlook: outlook } : {}),
  });

  return {
    ...fromRecord(saved.record, false, inference.latencyMs),
    model: inference.model,
    latencyMs: inference.latencyMs,
    analysisType,
    analysisLabel: analysisLabel(analysisType),
    riskOutlook: outlook,
  };
}

export { describeMethodology, scoreWallet, modelKey };
export type { AnalysisType };
