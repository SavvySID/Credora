import type { VercelRequest, VercelResponse } from '@vercel/node';
import { IndexerUnavailableError, indexerClient } from './lib/indexer';
import { SCORING_MODEL, describeMethodology, scoreWallet } from './lib/scoring';
import { explainScore } from './lib/compute';
import { methodGuard, noStore, readAddress, unavailable, withApiHandler } from './lib/http';

/**
 * Deterministic Credora score. 0G Compute is not used unless explain=true.
 */
export default withApiHandler(async function handler(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res, ['GET', 'POST'])) return;

  const wallet = readAddress(req, res);
  if (!wallet) return;

  const explain = req.query.explain === 'true';

  let features;
  try {
    features = await indexerClient.features(wallet);
  } catch (error) {
    if (error instanceof IndexerUnavailableError) {
      unavailable(res, 'Credora indexer', error.message);
      return;
    }
    throw error;
  }

  const score = scoreWallet(features);
  const methodology = describeMethodology(score);

  const narrative = explain
    ? await explainScore(wallet, score)
    : {
        available: false,
        provider: null,
        model: null,
        text: null,
        blockedReason: 'Explanation skipped (explain is not the Phase 3 AI path; use POST /api/risk-assessment)',
        latencyMs: null,
      };

  let record: Awaited<ReturnType<typeof indexerClient.saveAssessment>> | null = null;
  let recordError: string | null = null;

  try {
    record = await indexerClient.saveAssessment({
      wallet,
      eventType: 'credit_assessment',
      creditScore: score.creditScore,
      riskLevel: score.riskLevel,
      confidence: score.confidence,
      model: SCORING_MODEL.id,
      methodology,
      sourceDataHash: features.sourceDataHash,
      deterministicScore: score.creditScore,
      modelVersion: SCORING_MODEL.version,
    });
  } catch (error) {
    recordError = error instanceof Error ? error.message : String(error);
  }

  noStore(res);
  res.status(200).json({
    wallet,
    creditScore: score.creditScore,
    creditBand: score.creditBand,
    riskLevel: score.riskLevel,
    confidence: score.confidence,
    factors: score.factors,
    timestamp: new Date().toISOString(),
    sourceDataHash: features.sourceDataHash ?? null,
    cached: record?.cached ?? false,

    walletData: {
      balance: features.balanceFormatted,
      balanceWei: features.balanceWei,
      transactionCount: features.transactionCount,
      firstSeen: features.firstSeen,
      lastActivity: features.lastActivity,
      chainId: features.chainId,
      outstandingWei: features.outstandingWei,
      overdue: features.overdue,
      txMix: features.txMix,
    },

    scoring: {
      ...SCORING_MODEL,
      methodology,
      inputs: score.inputs,
      completeness: score.completeness,
    },

    narrative,

    dataQuality: {
      degraded: features.degraded,
      degradedReason: features.degradedReason,
      loanIndexing: features.loanIndexing,
      missingInputs: score.completeness.missing,
      fetchedAt: features.fetchedAt,
    },

    record: record
      ? {
          recordId: record.record.recordId,
          verification: record.record.verification,
          storageWrites: record.storageWrites,
          persistence: record.verification,
          cached: record.cached ?? false,
        }
      : { error: recordError },
  });
});
