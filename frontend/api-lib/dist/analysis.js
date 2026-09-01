"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RISK_OUTLOOKS = exports.ANALYSIS_FOCUS = exports.ANALYSIS_LABELS = exports.DEFAULT_ANALYSIS_TYPE = exports.ANALYSIS_TYPES = void 0;
exports.isAnalysisType = isAnalysisType;
exports.parseAnalysisType = parseAnalysisType;
exports.analysisLabel = analysisLabel;
exports.analysisCacheModelKey = analysisCacheModelKey;
exports.parseRiskOutlook = parseRiskOutlook;
exports.ANALYSIS_TYPES = [
    'general',
    'borrower-risk',
    'repayment-behavior',
    'liquidity',
    'wallet-activity',
    'risk-outlook',
];
exports.DEFAULT_ANALYSIS_TYPE = 'general';
exports.ANALYSIS_LABELS = {
    general: 'General Risk Assessment',
    'borrower-risk': 'Borrower Risk',
    'repayment-behavior': 'Repayment Behavior',
    liquidity: 'Liquidity & Financial Health',
    'wallet-activity': 'Wallet Activity & Stability',
    'risk-outlook': 'Risk Outlook',
};
exports.ANALYSIS_FOCUS = {
    general: "Evaluate the borrower's overall on-chain financial risk.",
    'borrower-risk': 'Focus on the factors that increase or decrease the likelihood that this borrower represents elevated financial risk.',
    'repayment-behavior': 'Focus specifically on repayment history, repayment consistency, overdue behavior, and observed loan obligations.',
    liquidity: 'Focus on available balance, financial buffer, obligations, and observable liquidity-related signals.',
    'wallet-activity': 'Focus on transaction activity, account age, activity consistency, recency, and stability of observed wallet behavior.',
    'risk-outlook': 'Assess whether the available evidence suggests the borrower\'s risk profile is improving, stable, or deteriorating, and explain which observed changes support that conclusion. Include riskOutlook as Improving, Stable, Deteriorating, or Insufficient Data.',
};
exports.RISK_OUTLOOKS = ['Improving', 'Stable', 'Deteriorating', 'Insufficient Data'];
function isAnalysisType(value) {
    return typeof value === 'string' && exports.ANALYSIS_TYPES.includes(value);
}
/** Missing/blank defaults to general. Unknown strings are rejected. */
function parseAnalysisType(value) {
    if (value === undefined || value === null || value === '') {
        return { ok: true, value: exports.DEFAULT_ANALYSIS_TYPE };
    }
    if (!isAnalysisType(value)) {
        return {
            ok: false,
            reason: `Invalid analysisType. Allowed: ${exports.ANALYSIS_TYPES.join(', ')}`,
        };
    }
    return { ok: true, value };
}
function analysisLabel(type) {
    return exports.ANALYSIS_LABELS[type];
}
/**
 * Encoded into the indexer cache `model` slot so analysis types do not collide.
 * General keeps `id@router` so existing cached assessments still hit.
 */
function analysisCacheModelKey(computeModel, analysisType) {
    if (!computeModel)
        return 'unconfigured';
    if (analysisType === 'general')
        return `${computeModel}@router`;
    return `${computeModel}@router:${analysisType}`;
}
function parseRiskOutlook(value) {
    if (typeof value !== 'string')
        return null;
    const trimmed = value.trim();
    const match = exports.RISK_OUTLOOKS.find((entry) => entry.toLowerCase() === trimmed.toLowerCase());
    return match ?? null;
}
