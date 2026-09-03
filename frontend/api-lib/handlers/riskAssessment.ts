import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  IndexerUnavailableError,
  indexerClient,
  indexerConfigured,
  loadFeatures,
  type FeaturesDto,
} from '../indexer';
import { scoreWallet } from '../scoring';
import { aiFromRecordList, evaluateAiRisk, getCachedAiAssessment } from '../riskEngine';
import { parseAnalysisType } from '../analysis';
import { methodGuard, noStore, readAddress, unavailable } from '../http';

function readRequestedAnalysis(req: VercelRequest) {
  const fromQuery = Array.isArray(req.query.analysisType)
    ? req.query.analysisType[0]
    : req.query.analysisType;
  const body = req.body as { analysisType?: unknown } | undefined;
  return parseAnalysisType(body?.analysisType ?? fromQuery);
}

function featuresFromPostedFacts(wallet: string, body: unknown): FeaturesDto | null {
  if (!body || typeof body !== 'object') return null;
  const facts = (body as { facts?: Record<string, unknown> }).facts;
  if (!facts) return null;
  const factWallet = typeof facts.wallet === 'string' ? facts.wallet.toLowerCase() : '';
  if (factWallet !== wallet) return null;
  if (typeof facts.balanceWei !== 'string' || typeof facts.transactionCount !== 'number') return null;
  if (typeof facts.sourceDataHash !== 'string' || !facts.sourceDataHash) return null;
  const txMix =
    facts.txMix && typeof facts.txMix === 'object'
      ? (facts.txMix as { inbound?: number; outbound?: number; self?: number })
      : { inbound: 0, outbound: 0, self: 0 };
  const repayment =
    facts.repayment && typeof facts.repayment === 'object'
      ? (facts.repayment as FeaturesDto['repayment'])
      : {
          total: 0,
          repaid: Number(facts.repaidLoanCount ?? 0),
          active: Number(facts.activeLoanCount ?? 0),
          defaulted: 0,
          overdue: Number(facts.overdue ? 1 : 0),
          repaymentRate: null,
        };
  const inbound = Number(txMix.inbound ?? 0);
  const outbound = Number(txMix.outbound ?? 0);
  const self = Number(txMix.self ?? 0);

  return {
    wallet,
    chainId: typeof facts.chainId === 'number' ? facts.chainId : 16602,
    balanceWei: facts.balanceWei,
    balanceFormatted: typeof facts.balanceFormatted === 'string' ? facts.balanceFormatted : '0',
    transactionCount: facts.transactionCount,
    observedTransactions:
      typeof facts.observedTransactions === 'number'
        ? facts.observedTransactions
        : inbound + outbound + self,
    firstSeen: typeof facts.firstSeen === 'string' ? facts.firstSeen : null,
    lastActivity: typeof facts.lastActivity === 'string' ? facts.lastActivity : null,
    repayment,
    outstandingWei: typeof facts.outstandingWei === 'string' ? facts.outstandingWei : '0',
    overdue: Boolean(facts.overdue),
    activeLoanCount: typeof facts.activeLoanCount === 'number' ? facts.activeLoanCount : repayment.active,
    repaidLoanCount: typeof facts.repaidLoanCount === 'number' ? facts.repaidLoanCount : repayment.repaid,
    txMix: { inbound, outbound, self },
    sourceDataHash: typeof facts.sourceDataHash === 'string' ? facts.sourceDataHash : undefined,
    degraded: true,
    degradedReason: 'Wallet facts reused from the already-loaded credit profile so 0G Compute can start immediately.',
    loanIndexing: { available: false, blockedReason: 'Posted facts; loan index not re-fetched.' },
    fetchedAt: new Date().toISOString(),
  };
}

export async function handle(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res, ['GET', 'POST'])) return;

  const wallet = readAddress(req, res);
  if (!wallet) return;

  const analysis = readRequestedAnalysis(req);
  if (!analysis.ok) {
    res.status(400).json({ error: 'invalid_analysis_type', message: analysis.reason });
    return;
  }
  const analysisType = analysis.value;

  let features = req.method === 'POST' ? featuresFromPostedFacts(wallet, req.body) : null;
  if (!features) {
    try {
      features = await loadFeatures(wallet, { fast: req.method === 'POST' });
    } catch (error) {
      if (error instanceof IndexerUnavailableError) {
        unavailable(res, 'Credora indexer', error.message);
        return;
      }
      throw error;
    }
  }

  const score = scoreWallet(features);
  const hash = features.sourceDataHash ?? null;

  noStore(res);

  if (req.method === 'GET') {
    if (!hash) {
      res.status(200).json({
        wallet,
        available: false,
        blockedReason: 'Indexer did not return sourceDataHash.',
        deterministicScore: score.creditScore,
        creditBand: score.creditBand,
        analysisType,
      });
      return;
    }

    const cached = indexerConfigured().ok ? await getCachedAiAssessment(wallet, hash, analysisType) : null;
    if (cached) {
      res.status(200).json({
        wallet,
        ...cached,
        deterministicScore: score.creditScore,
        creditBand: score.creditBand,
      });
      return;
    }

    try {
      const indexed = await indexerClient.records(wallet, ['ai_risk_assessment'], 40);
      const fromList = aiFromRecordList(indexed.records, hash, analysisType);
      if (fromList) {
        res.status(200).json({
          wallet,
          ...fromList,
          deterministicScore: score.creditScore,
          creditBand: score.creditBand,
        });
        return;
      }
    } catch (error) {
      if (!(error instanceof IndexerUnavailableError)) throw error;
    }

    res.status(200).json({
      wallet,
      available: false,
      blockedReason: `Run AI assessment to call 0G Compute for this wallet.`,
      cached: false,
      sourceDataHash: hash,
      deterministicScore: score.creditScore,
      creditBand: score.creditBand,
      riskLevel: null,
      riskScore: null,
      keyRiskFactors: [],
      positiveFactors: [],
      assessmentSummary: null,
      confidence: null,
      model: null,
      latencyMs: null,
      record: null,
      analysisType,
    });
    return;
  }

  const ai = await evaluateAiRisk(wallet, features, score, analysisType);
  res.status(200).json({
    wallet,
    ...ai,
    deterministicScore: score.creditScore,
    creditBand: score.creditBand,
  });
}
