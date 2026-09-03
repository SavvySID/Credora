"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handle = handle;
const indexer_1 = require("../indexer");
const scoring_1 = require("../scoring");
const riskEngine_1 = require("../riskEngine");
const analysis_1 = require("../analysis");
const computeProbe_1 = require("../computeProbe");
const reputation_1 = require("../reputation");
const http_1 = require("../http");
function serializeAi(ai) {
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
function historyPoint(record) {
    const isAi = record.eventType === 'ai_risk_assessment';
    return {
        kind: isAi ? 'ai' : 'deterministic',
        score: isAi
            ? Number(record.values.aiRiskScore ?? 0)
            : Number(record.values.creditScore ?? record.values.deterministicScore ?? 0),
        riskLevel: isAi
            ? record.values.aiRiskLevel ?? null
            : record.values.riskLevel ?? null,
        timestamp: record.timestamp,
        source: record.source,
        verification: record.verification.status,
        recordId: record.recordId,
    };
}
async function handle(req, res) {
    if (!(0, http_1.methodGuard)(req, res, ['GET']))
        return;
    const wallet = (0, http_1.readAddress)(req, res);
    if (!wallet)
        return;
    let features;
    let loans;
    let records;
    try {
        [features, loans, records] = await Promise.all([
            (0, indexer_1.loadFeatures)(wallet),
            (0, indexer_1.loadLoans)(wallet),
            (0, indexer_1.loadRecords)(wallet, ['credit_assessment', 'ai_risk_assessment'], 60),
        ]);
    }
    catch (error) {
        if (error instanceof indexer_1.IndexerUnavailableError) {
            (0, http_1.unavailable)(res, 'Credora indexer', error.message);
            return;
        }
        throw error;
    }
    const score = (0, scoring_1.scoreWallet)(features);
    const hash = features.sourceDataHash ?? null;
    const compute = (0, computeProbe_1.computeCapability)();
    const assessments = records.records;
    const byType = (0, riskEngine_1.aiByAnalysisFromRecords)(assessments, hash);
    if (hash && (0, indexer_1.indexerConfigured)().ok) {
        for (const type of analysis_1.ANALYSIS_TYPES) {
            if (byType[type])
                continue;
            try {
                const cached = await (0, riskEngine_1.getCachedAiAssessment)(wallet, hash, type);
                if (cached)
                    byType[type] = cached;
            }
            catch (error) {
                if (!(error instanceof indexer_1.IndexerUnavailableError))
                    throw error;
            }
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
                ? 'Run 0G Compute assessment for this wallet.'
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
    const reputation = (0, reputation_1.evaluateReputation)({
        lastActivity: features.lastActivity,
        firstSeen: features.firstSeen,
        transactionCount: features.transactionCount,
        repaid: features.repayment.repaid,
        repaymentRate: features.repayment.repaymentRate,
        overdue: features.repayment.overdue,
        latestAssessmentVerified: latestCredit?.verification.status === 'verified',
        anyVerifiedRecord: anyVerified,
    });
    (0, http_1.noStore)(res);
    res.status(200).json({
        wallet,
        sourceDataHash: hash,
        deterministic: {
            score: score.creditScore,
            creditBand: score.creditBand,
            riskLevel: score.riskLevel,
            factors: score.factors,
            methodology: (0, scoring_1.describeMethodology)(score),
            confidence: score.confidence,
            completeness: score.completeness,
            model: 'credora-onchain-v1',
        },
        ai: serializeAi(ai),
        aiByAnalysis: Object.fromEntries(Object.entries(byType).map(([type, view]) => [
            type,
            serializeAi(view),
        ])),
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
}
