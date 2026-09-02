import type { VercelRequest, VercelResponse } from '@vercel/node';
import { IndexerUnavailableError, indexerClient, indexerConfigured, loadFeatures } from '../indexer';
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

  let features;
  try {
    features = await loadFeatures(wallet, { fast: req.method === 'POST' });
  } catch (error) {
    if (error instanceof IndexerUnavailableError) {
      unavailable(res, 'Credora indexer', error.message);
      return;
    }
    throw error;
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
