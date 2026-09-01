"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handle = handle;
const indexer_1 = require("../indexer");
const scoring_1 = require("../scoring");
const compute_1 = require("../compute");
const http_1 = require("../http");
/** Deterministic Credora score. 0G Compute is not used unless explain=true. */
async function handle(req, res) {
    if (!(0, http_1.methodGuard)(req, res, ['GET', 'POST']))
        return;
    const wallet = (0, http_1.readAddress)(req, res);
    if (!wallet)
        return;
    const explain = req.query.explain === 'true';
    let features;
    try {
        features = await (0, indexer_1.loadFeatures)(wallet);
    }
    catch (error) {
        if (error instanceof indexer_1.IndexerUnavailableError) {
            (0, http_1.unavailable)(res, 'Credora indexer', error.message);
            return;
        }
        throw error;
    }
    const score = (0, scoring_1.scoreWallet)(features);
    const methodology = (0, scoring_1.describeMethodology)(score);
    const narrative = explain
        ? await (0, compute_1.explainScore)(wallet, score)
        : {
            available: false,
            provider: null,
            model: null,
            text: null,
            blockedReason: 'Explanation skipped (explain is not the Phase 3 AI path; use POST /api/risk-assessment)',
            latencyMs: null,
        };
    let record = null;
    let recordError = null;
    try {
        record = await indexer_1.indexerClient.saveAssessment({
            wallet,
            eventType: 'credit_assessment',
            creditScore: score.creditScore,
            riskLevel: score.riskLevel,
            confidence: score.confidence,
            model: scoring_1.SCORING_MODEL.id,
            methodology,
            sourceDataHash: features.sourceDataHash,
            deterministicScore: score.creditScore,
            modelVersion: scoring_1.SCORING_MODEL.version,
        });
    }
    catch (error) {
        recordError = error instanceof Error ? error.message : String(error);
    }
    (0, http_1.noStore)(res);
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
            ...scoring_1.SCORING_MODEL,
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
}
