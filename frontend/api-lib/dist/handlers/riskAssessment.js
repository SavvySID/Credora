"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handle = handle;
const indexer_1 = require("../indexer");
const scoring_1 = require("../scoring");
const riskEngine_1 = require("../riskEngine");
const analysis_1 = require("../analysis");
const http_1 = require("../http");
function readRequestedAnalysis(req) {
    const fromQuery = Array.isArray(req.query.analysisType)
        ? req.query.analysisType[0]
        : req.query.analysisType;
    const body = req.body;
    return (0, analysis_1.parseAnalysisType)(body?.analysisType ?? fromQuery);
}
function featuresFromPostedFacts(wallet, body) {
    if (!body || typeof body !== 'object')
        return null;
    const facts = body.facts;
    if (!facts)
        return null;
    const factWallet = typeof facts.wallet === 'string' ? facts.wallet.toLowerCase() : '';
    if (factWallet !== wallet)
        return null;
    if (typeof facts.balanceWei !== 'string' || typeof facts.transactionCount !== 'number')
        return null;
    if (typeof facts.sourceDataHash !== 'string' || !facts.sourceDataHash)
        return null;
    const txMix = facts.txMix && typeof facts.txMix === 'object'
        ? facts.txMix
        : { inbound: 0, outbound: 0, self: 0 };
    const repayment = facts.repayment && typeof facts.repayment === 'object'
        ? facts.repayment
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
        observedTransactions: typeof facts.observedTransactions === 'number'
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
async function handle(req, res) {
    if (!(0, http_1.methodGuard)(req, res, ['GET', 'POST']))
        return;
    const wallet = (0, http_1.readAddress)(req, res);
    if (!wallet)
        return;
    const analysis = readRequestedAnalysis(req);
    if (!analysis.ok) {
        res.status(400).json({ error: 'invalid_analysis_type', message: analysis.reason });
        return;
    }
    const analysisType = analysis.value;
    let features = req.method === 'POST' ? featuresFromPostedFacts(wallet, req.body) : null;
    if (!features) {
        try {
            features = await (0, indexer_1.loadFeatures)(wallet, { fast: req.method === 'POST' });
        }
        catch (error) {
            if (error instanceof indexer_1.IndexerUnavailableError) {
                (0, http_1.unavailable)(res, 'Credora indexer', error.message);
                return;
            }
            throw error;
        }
    }
    const score = (0, scoring_1.scoreWallet)(features);
    const hash = features.sourceDataHash ?? null;
    (0, http_1.noStore)(res);
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
        const cached = (0, indexer_1.indexerConfigured)().ok ? await (0, riskEngine_1.getCachedAiAssessment)(wallet, hash, analysisType) : null;
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
            const indexed = await indexer_1.indexerClient.records(wallet, ['ai_risk_assessment'], 40);
            const fromList = (0, riskEngine_1.aiFromRecordList)(indexed.records, hash, analysisType);
            if (fromList) {
                res.status(200).json({
                    wallet,
                    ...fromList,
                    deterministicScore: score.creditScore,
                    creditBand: score.creditBand,
                });
                return;
            }
        }
        catch (error) {
            if (!(error instanceof indexer_1.IndexerUnavailableError))
                throw error;
        }
        res.status(200).json({
            wallet,
            available: false,
            blockedReason: `Run 0G Compute assessment for this wallet.`,
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
    const ai = await (0, riskEngine_1.evaluateAiRisk)(wallet, features, score, analysisType);
    res.status(200).json({
        wallet,
        ...ai,
        deterministicScore: score.creditScore,
        creditBand: score.creditBand,
    });
}
