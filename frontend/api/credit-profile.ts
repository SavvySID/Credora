import type { VercelRequest, VercelResponse } from '@vercel/node';
import { IndexerUnavailableError, indexerClient, type RecordDto } from './_lib/indexer';
import { describeMethodology, scoreWallet } from './_lib/scoring';
import { aiByAnalysisFromRecords, getCachedAiAssessment, type AiAssessmentView } from './_lib/riskEngine';
import { ANALYSIS_TYPES, type AnalysisType } from './_lib/analysis';
import { computeCapability } from './_lib/computeProbe';
import { evaluateReputation } from './_lib/reputation';
import { methodGuard, noStore, readAddress, unavailable, withApiHandler } from './_lib/http';

function serializeAi(ai: AiAssessmentView) {
  return {
    available: ai.available,
    riskLevel: ai.riskLevel,
    riskScore: ai.riskScore,
    factors: {
      keyRiskFactors: ai.keyRiskFactors,
      positiveFactors: ai.positiveFactors,
    },
    summary: ai.assessmentSummary,
    model: ai.model,
    latencyMs: ai.latencyMs,
    confidence: ai.confidence,
    blockedReason: ai.blockedReason,
    cached: ai.cached,
    timestamp: ai.record?.timestamp ?? null,
    sourceDataHash: ai.sourceDataHash,
    analysisType: ai.analysisType,
    analysisLabel: ai.analysisLabel,
    riskOutlook: ai.riskOutlook,
    verification: ai.record
      ? {
          status: ai.record.verification.status,
          rootHash: ai.record.verification.rootHash,
          storageTxHash: ai.record.verification.storageTxHash,
          verifiedAt: ai.record.verification.verifiedAt,
          detail: ai.record.verification.detail,
          recordId: ai.record.recordId,
          eventType: ai.record.eventType,
        }
      : null,
  };
}

function historyPoint(record: RecordDto) {
  const isAi = record.eventType === 'ai_risk_assessment';
  return {
    kind: isAi ? 'ai' : 'deterministic',
    score: isAi
      ? Number(record.values.aiRiskScore ?? 0)
      : Number(record.values.creditScore ?? record.values.deterministicScore ?? 0),
    riskLevel: isAi
      ? (record.values.aiRiskLevel as string | undefined) ?? null
      : (record.values.riskLevel as string | undefined) ?? null,
    timestamp: record.timestamp,
    source: record.source,
    verification: record.verification.status,
    recordId: record.recordId,
  };
}

export default withApiHandler(async function handler(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res, ['GET'])) return;

  const wallet = readAddress(req, res);
  if (!wallet) return;

  let features;
  let loans;
  let records;
  try {
    [features, loans, records] = await Promise.all([
      indexerClient.features(wallet),
      indexerClient.loans(wallet),
      indexerClient.records(wallet, ['credit_assessment', 'ai_risk_assessment'], 60),
    ]);
  } catch (error) {
    if (error instanceof IndexerUnavailableError) {
      unavailable(res, 'Credora indexer', error.message);
      return;
    }
    throw error;
  }

  const score = scoreWallet(features);
  const hash = features.sourceDataHash ?? null;
  const compute = computeCapability();

  const assessments = records.records;
  const byType = aiByAnalysisFromRecords(assessments, hash);
  if (hash) {
    for (const type of ANALYSIS_TYPES) {
      if (byType[type]) continue;
      const cached = await getCachedAiAssessment(wallet, hash, type);
      if (cached) byType[type] = cached;
    }
  }

  let ai = byType.general ?? null;
  if (!ai) {
    ai = {
      available: false,
      riskLevel: null,
      riskScore: null,
      keyRiskFactors: [],
      positiveFactors: [],
      assessmentSummary: null,
      confidence: null,
      model: null,
      latencyMs: null,
      blockedReason: compute.available
        ? 'No cached AI assessment for the current source data. Request a risk assessment to call 0G Compute.'
        : compute.blockedReason,
      cached: false,
      sourceDataHash: hash,
      record: null,
      analysisType: 'general',
      analysisLabel: 'General Risk Assessment',
      riskOutlook: null,
    };
  }
  const latestCredit = assessments.find((record) => record.eventType === 'credit_assessment') ?? null;
  const anyVerified = assessments.some((record) => record.verification.status === 'verified');

  const reputation = evaluateReputation({
    lastActivity: features.lastActivity,
    firstSeen: features.firstSeen,
    transactionCount: features.transactionCount,
    repaid: features.repayment.repaid,
    repaymentRate: features.repayment.repaymentRate,
    overdue: features.repayment.overdue,
    latestAssessmentVerified: latestCredit?.verification.status === 'verified',
    anyVerifiedRecord: anyVerified,
  });

  noStore(res);
  res.status(200).json({
    wallet,
    sourceDataHash: hash,
    deterministic: {
      score: score.creditScore,
      creditBand: score.creditBand,
      riskLevel: score.riskLevel,
      factors: score.factors,
      methodology: describeMethodology(score),
      confidence: score.confidence,
      completeness: score.completeness,
      model: 'credora-onchain-v1',
    },
    ai: serializeAi(ai),
    aiByAnalysis: Object.fromEntries(
      (Object.entries(byType) as Array<[AnalysisType, AiAssessmentView]>).map(([type, view]) => [
        type,
        serializeAi(view),
      ]),
    ) as Partial<Record<AnalysisType, ReturnType<typeof serializeAi>>>,
    reputation: {
      badges: reputation,
      earned: reputation.filter((badge) => badge.earned),
    },
    loans: {
      list: loans.loans,
      stats: loans.stats,
      reconciled: loans.reconciled,
      reason: loans.reason,
    },
    walletSummary: {
      balanceWei: features.balanceWei,
      balanceFormatted: features.balanceFormatted,
      transactionCount: features.transactionCount,
      firstSeen: features.firstSeen,
      lastActivity: features.lastActivity,
      txMix: features.txMix,
      outstandingWei: features.outstandingWei,
      overdue: features.overdue,
      chainId: features.chainId,
    },
    verification: latestCredit
      ? {
          status: latestCredit.verification.status,
          rootHash: latestCredit.verification.rootHash,
          storageTxHash: latestCredit.verification.storageTxHash,
          verifiedAt: latestCredit.verification.verifiedAt,
          detail: latestCredit.verification.detail,
          recordId: latestCredit.recordId,
          eventType: latestCredit.eventType,
        }
      : null,
    history: [...assessments].reverse().map(historyPoint),
    limitations: {
      loanDefaultedUnsupported: true,
      oneLoanPerBorrower: true,
      accountingOnlyLoan: true,
      noLenderPool: true,
    },
    dataQuality: {
      degraded: features.degraded,
      degradedReason: features.degradedReason,
      loanIndexing: features.loanIndexing,
    },
  });
});
