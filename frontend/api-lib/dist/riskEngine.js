"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scoreWallet = exports.describeMethodology = void 0;
exports.getCachedAiAssessment = getCachedAiAssessment;
exports.aiFromRecordList = aiFromRecordList;
exports.aiByAnalysisFromRecords = aiByAnalysisFromRecords;
exports.evaluateAiRisk = evaluateAiRisk;
exports.modelKey = modelKey;
const indexer_1 = require("./indexer");
const compute_1 = require("./compute");
const scoring_1 = require("./scoring");
Object.defineProperty(exports, "describeMethodology", { enumerable: true, get: function () { return scoring_1.describeMethodology; } });
Object.defineProperty(exports, "scoreWallet", { enumerable: true, get: function () { return scoring_1.scoreWallet; } });
const analysis_1 = require("./analysis");
function modelKey(analysisType = analysis_1.DEFAULT_ANALYSIS_TYPE) {
    return (0, analysis_1.analysisCacheModelKey)((0, compute_1.computeModelId)(), analysisType);
}
function recordAnalysisType(record) {
    return (0, analysis_1.isAnalysisType)(record.values.analysisType) ? record.values.analysisType : analysis_1.DEFAULT_ANALYSIS_TYPE;
}
function fromRecord(record, cached, latencyMs) {
    const analysisType = recordAnalysisType(record);
    const storedLabel = typeof record.values.analysisLabel === 'string' ? record.values.analysisLabel : (0, analysis_1.analysisLabel)(analysisType);
    return {
        available: true,
        riskLevel: record.values.aiRiskLevel ?? null,
        riskScore: typeof record.values.aiRiskScore === 'number' ? record.values.aiRiskScore : null,
        keyRiskFactors: Array.isArray(record.values.riskFactors)
            ? record.values.riskFactors
            : [],
        positiveFactors: Array.isArray(record.values.positiveFactors)
            ? record.values.positiveFactors
            : [],
        assessmentSummary: typeof record.values.assessmentSummary === 'string' ? record.values.assessmentSummary : null,
        confidence: typeof record.values.confidence === 'number' ? record.values.confidence : null,
        model: typeof record.meta.model === 'string' ? String(record.meta.model) : (0, compute_1.computeModelId)(),
        latencyMs,
        blockedReason: null,
        cached,
        sourceDataHash: typeof record.values.sourceDataHash === 'string' ? record.values.sourceDataHash : null,
        record,
        analysisType,
        analysisLabel: storedLabel,
        riskOutlook: (0, analysis_1.parseRiskOutlook)(record.values.riskOutlook),
    };
}
function unavailable(reason, hash, analysisType = analysis_1.DEFAULT_ANALYSIS_TYPE, cached = false) {
    return {
        available: false,
        riskLevel: null,
        riskScore: null,
        keyRiskFactors: [],
        positiveFactors: [],
        assessmentSummary: null,
        confidence: null,
        model: (0, compute_1.computeModelId)() || null,
        latencyMs: null,
        blockedReason: reason,
        cached,
        sourceDataHash: hash,
        record: null,
        analysisType,
        analysisLabel: (0, analysis_1.analysisLabel)(analysisType),
        riskOutlook: null,
    };
}
function borrowerFacts(wallet, features, score, analysisType) {
    const compact = Boolean(process.env.VERCEL);
    const facts = compact
        ? {
            wallet,
            balance: features.balanceFormatted,
            nonce: features.transactionCount,
            firstSeen: features.firstSeen,
            lastActivity: features.lastActivity,
            txMix: features.txMix ?? { inbound: 0, outbound: 0, self: 0 },
            loans: {
                active: features.activeLoanCount ?? 0,
                repaid: features.repaidLoanCount ?? 0,
                overdue: features.overdue ?? false,
                repaymentRate: features.repayment?.repaymentRate ?? null,
            },
        }
        : {
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
            observedFactors: score.factors.map((factor) => ({
                factor: factor.factor,
                observed: factor.observed,
                normalized: Number(factor.normalized.toFixed(4)),
                impact: factor.impact,
            })),
            missingInputs: score.completeness.missing,
            instructions: [
                'Do not invent loans, transactions, or balances.',
                'riskScore is independent of any Credora credit score: higher means more risk.',
                'riskLevel must be exactly Low, Medium, or High.',
            ],
        };
    if (analysisType !== 'general') {
        facts.focus = process.env.VERCEL ? analysisType : analysis_1.ANALYSIS_FOCUS[analysisType];
    }
    return facts;
}
async function getCachedAiAssessment(wallet, sourceDataHash, analysisType = analysis_1.DEFAULT_ANALYSIS_TYPE) {
    if (!(0, compute_1.computeModelId)() || !(0, indexer_1.indexerConfigured)().ok)
        return null;
    try {
        const lookup = await indexer_1.indexerClient.assessmentCache(wallet, sourceDataHash, 'ai_risk_assessment', modelKey(analysisType));
        if (!lookup.hit || !lookup.record)
            return null;
        return fromRecord(lookup.record, true, 0);
    }
    catch (error) {
        if (error instanceof indexer_1.IndexerUnavailableError)
            return null;
        throw error;
    }
}
/** Latest indexed AI record for this wallet + source hash + analysis type. */
function aiFromRecordList(records, sourceDataHash, analysisType = analysis_1.DEFAULT_ANALYSIS_TYPE) {
    const match = records.find((record) => {
        if (record.eventType !== 'ai_risk_assessment')
            return false;
        if (recordAnalysisType(record) !== analysisType)
            return false;
        if (!sourceDataHash)
            return true;
        const stored = record.values.sourceDataHash;
        return typeof stored !== 'string' || stored === sourceDataHash;
    });
    if (!match)
        return null;
    return fromRecord(match, true, 0);
}
function aiByAnalysisFromRecords(records, sourceDataHash) {
    const out = {};
    for (const type of analysis_1.ANALYSIS_TYPES) {
        const view = aiFromRecordList(records, sourceDataHash, type);
        if (view)
            out[type] = view;
    }
    return out;
}
/**
 * Returns a cached AI assessment when source data + model + analysis type match.
 * On a miss, calls 0G Compute. Never fabricates an assessment.
 */
async function evaluateAiRisk(wallet, features, score, analysisType = analysis_1.DEFAULT_ANALYSIS_TYPE) {
    const hash = features.sourceDataHash ?? null;
    if (!hash) {
        return unavailable('Indexer did not return sourceDataHash; cannot cache or run AI assessment.', null, analysisType);
    }
    const cached = (0, indexer_1.indexerConfigured)().ok ? await getCachedAiAssessment(wallet, hash, analysisType) : null;
    if (cached)
        return cached;
    if ((0, indexer_1.indexerConfigured)().ok) {
        try {
            const indexed = await indexer_1.indexerClient.records(wallet, ['ai_risk_assessment'], 40);
            const existing = aiFromRecordList(indexed.records, hash, analysisType);
            if (existing)
                return existing;
        }
        catch {
            /* Cache miss is recoverable; a records lookup failure should not skip Compute. */
        }
    }
    const capability = (0, compute_1.computeCapability)();
    if (!capability.available) {
        return unavailable(capability.blockedReason ?? '0G Compute is not configured.', hash, analysisType);
    }
    const inference = await (0, compute_1.assessBorrowerRisk)(JSON.stringify(borrowerFacts(wallet, features, score, analysisType)), analysisType);
    if (!inference.available || !inference.output) {
        return unavailable(inference.blockedReason ?? '0G Compute inference failed.', hash, analysisType);
    }
    const outlook = analysisType === 'risk-outlook' ? (0, analysis_1.parseRiskOutlook)(inference.output.riskOutlook) : null;
    const live = {
        available: true,
        riskLevel: inference.output.riskLevel,
        riskScore: inference.output.riskScore,
        keyRiskFactors: inference.output.keyRiskFactors,
        positiveFactors: inference.output.positiveFactors,
        assessmentSummary: inference.output.assessmentSummary,
        confidence: inference.output.confidence ?? null,
        model: inference.model,
        latencyMs: inference.latencyMs,
        blockedReason: null,
        cached: false,
        sourceDataHash: hash,
        record: null,
        analysisType,
        analysisLabel: (0, analysis_1.analysisLabel)(analysisType),
        riskOutlook: outlook,
    };
    if (!(0, indexer_1.indexerConfigured)().ok) {
        return live;
    }
    try {
        const saved = await indexer_1.indexerClient.saveAssessment({
            wallet,
            eventType: 'ai_risk_assessment',
            confidence: inference.output.confidence ?? 0,
            model: (0, compute_1.computeModelId)(),
            methodology: `0G Compute structured risk JSON via ${inference.model ?? (0, compute_1.computeModelId)()} (${scoring_1.SCORING_MODEL.id} baseline ${score.creditScore}/1000 ${score.creditBand}; ${(0, analysis_1.analysisLabel)(analysisType)})`,
            sourceDataHash: hash,
            deterministicScore: score.creditScore,
            aiRiskScore: inference.output.riskScore,
            aiRiskLevel: inference.output.riskLevel,
            riskFactors: inference.output.keyRiskFactors,
            positiveFactors: inference.output.positiveFactors,
            assessmentSummary: inference.output.assessmentSummary,
            modelVersion: analysisType === 'general' ? 'router' : `router:${analysisType}`,
            analysisType,
            analysisLabel: (0, analysis_1.analysisLabel)(analysisType),
            ...(outlook ? { riskOutlook: outlook } : {}),
        });
        return {
            ...fromRecord(saved.record, false, inference.latencyMs),
            model: inference.model,
            latencyMs: inference.latencyMs,
            analysisType,
            analysisLabel: (0, analysis_1.analysisLabel)(analysisType),
            riskOutlook: outlook,
        };
    }
    catch (error) {
        if (error instanceof indexer_1.IndexerUnavailableError)
            return live;
        throw error;
    }
}
