"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RISK_OUTLOOKS = exports.DEFAULT_ANALYSIS_TYPE = exports.ANALYSIS_TYPES = void 0;
exports.isAnalysisType = isAnalysisType;
exports.parseAnalysisType = parseAnalysisType;
exports.analysisLabel = analysisLabel;
exports.analysisCacheModelKey = analysisCacheModelKey;
exports.parseRiskOutlook = parseRiskOutlook;
exports.ANALYSIS_TYPES = ['general'];
exports.DEFAULT_ANALYSIS_TYPE = 'general';
exports.RISK_OUTLOOKS = ['Improving', 'Stable', 'Deteriorating', 'Insufficient Data'];
function isAnalysisType(value) {
    return value === 'general';
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
function analysisLabel(_type = exports.DEFAULT_ANALYSIS_TYPE) {
    return 'General Risk Assessment';
}
/**
 * Encoded into the indexer cache `model` slot.
 * General keeps `id@router` so existing cached assessments still hit.
 */
function analysisCacheModelKey(computeModel, _analysisType = exports.DEFAULT_ANALYSIS_TYPE) {
    if (!computeModel)
        return 'unconfigured';
    return `${computeModel}@router`;
}
function parseRiskOutlook(value) {
    if (typeof value !== 'string')
        return null;
    const trimmed = value.trim();
    const match = exports.RISK_OUTLOOKS.find((entry) => entry.toLowerCase() === trimmed.toLowerCase());
    return match ?? null;
}
