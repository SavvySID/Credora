"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiRiskOutputSchema = exports.AI_RISK_LEVELS = void 0;
exports.parseAiRiskJson = parseAiRiskJson;
exports.completionTextFromChoice = completionTextFromChoice;
const zod_1 = require("zod");
/** Higher riskScore = more risk. Independent of the Credora credit band. */
exports.AI_RISK_LEVELS = ['Low', 'Medium', 'High'];
const factor = zod_1.z.string().trim().min(1).max(240);
exports.aiRiskOutputSchema = zod_1.z
    .object({
    riskLevel: zod_1.z.enum(exports.AI_RISK_LEVELS),
    riskScore: zod_1.z.number().int().min(0).max(1000),
    keyRiskFactors: zod_1.z.array(factor).max(8).default([]),
    positiveFactors: zod_1.z.array(factor).max(8).default([]),
    assessmentSummary: zod_1.z.string().trim().min(1).max(800),
    confidence: zod_1.z.number().min(0).max(1).optional(),
    riskOutlook: zod_1.z.enum(['Improving', 'Stable', 'Deteriorating', 'Insufficient Data']).optional(),
})
    .strict();
const RISK_LEVEL_BY_LOWER = {
    low: 'Low',
    medium: 'Medium',
    high: 'High',
};
const SUMMARY_KEYS = [
    'assessmentSummary',
    'assessment_summary',
    'rationale',
    'summary',
    'analysis',
    'explanation',
    'overview',
    'description',
    'comment',
    'reason',
    'notes',
    'conclusion',
    'findings',
    'narrative',
    'details',
    'assessment',
    'analysisSummary',
    'riskSummary',
    'risk_summary',
    'outlookRationale',
    'focusSummary',
    'answer',
];
const SUMMARY_RESERVED_KEYS = new Set([
    'riskLevel',
    'risk_level',
    'riskScore',
    'risk_score',
    'confidence',
    'creditBand',
    'wallet',
    'analysisType',
    'analysisFocus',
    'model',
    'keyRiskFactors',
    'key_risk_factors',
    'positiveFactors',
    'positive_factors',
    'riskFactors',
    'riskOutlook',
    'risk_outlook',
    'missingInputs',
    'deterministicScore',
]);
function asTrimmedString(value) {
    if (typeof value === 'string' && value.trim())
        return value.trim();
    if (Array.isArray(value)) {
        const parts = value.filter((item) => typeof item === 'string' && Boolean(item.trim()));
        if (parts.length > 0)
            return parts.join(' ').trim();
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        const nested = value;
        for (const key of SUMMARY_KEYS) {
            const inner = nested[key];
            if (typeof inner === 'string' && inner.trim())
                return inner.trim();
        }
    }
    return undefined;
}
/** Model text under any summary-like key. Does not invent a narrative from the score. */
function pickAssessmentSummary(raw) {
    for (const key of SUMMARY_KEYS) {
        const found = asTrimmedString(raw[key]);
        if (found)
            return found.slice(0, 800);
    }
    let longest = '';
    for (const [key, value] of Object.entries(raw)) {
        if (SUMMARY_RESERVED_KEYS.has(key))
            continue;
        const found = asTrimmedString(value);
        if (found && found.length > longest.length)
            longest = found;
    }
    if (longest)
        return longest.slice(0, 800);
    const factorText = [
        ...(Array.isArray(raw.keyRiskFactors) ? raw.keyRiskFactors : []),
        ...(Array.isArray(raw.key_risk_factors) ? raw.key_risk_factors : []),
        ...(Array.isArray(raw.riskFactors) ? raw.riskFactors : []),
        ...(Array.isArray(raw.positiveFactors) ? raw.positiveFactors : []),
        ...(Array.isArray(raw.positive_factors) ? raw.positive_factors : []),
    ]
        .filter((item) => typeof item === 'string' && Boolean(item.trim()))
        .join('; ');
    return factorText ? factorText.slice(0, 800) : undefined;
}
/** Accepts case variants, wrappers, and alias keys. Does not map credit-band labels. */
function unwrapRiskObject(parsed) {
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
        return null;
    const raw = parsed;
    if ('riskLevel' in raw || 'riskScore' in raw || 'risk_level' in raw || 'risk_score' in raw)
        return raw;
    for (const key of ['answer', 'data', 'result', 'assessment', 'output', 'json']) {
        const inner = raw[key];
        if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
            return inner;
        }
    }
    for (const value of Object.values(raw)) {
        if (value &&
            typeof value === 'object' &&
            !Array.isArray(value) &&
            ('riskLevel' in value || 'risk_level' in value)) {
            return value;
        }
    }
    return raw;
}
function normalizeAiRiskCandidate(parsed) {
    const raw = unwrapRiskObject(parsed);
    if (!raw)
        return parsed;
    let riskLevel = raw.riskLevel ?? raw.risk_level;
    if (typeof riskLevel === 'string') {
        const cleaned = riskLevel.trim().toLowerCase().replace(/[\s_-]*risk$/, '').trim();
        const mapped = RISK_LEVEL_BY_LOWER[cleaned];
        if (mapped)
            riskLevel = mapped;
    }
    let riskScore = raw.riskScore ?? raw.risk_score;
    if (typeof riskScore === 'number' && Number.isFinite(riskScore)) {
        riskScore = Math.round(riskScore);
    }
    let confidence = raw.confidence;
    if (typeof confidence === 'number' && confidence >= 2 && confidence <= 100) {
        confidence = confidence / 100;
    }
    const factors = raw.keyRiskFactors ?? raw.riskFactors ?? raw.key_risk_factors;
    const positives = raw.positiveFactors ?? raw.positive_factors;
    return {
        riskLevel,
        riskScore,
        keyRiskFactors: Array.isArray(factors) ? factors : [],
        positiveFactors: Array.isArray(positives) ? positives : [],
        assessmentSummary: pickAssessmentSummary(raw),
        ...(typeof confidence === 'number' ? { confidence } : {}),
        ...(parseOutlook(raw.riskOutlook ?? raw.risk_outlook)
            ? { riskOutlook: parseOutlook(raw.riskOutlook ?? raw.risk_outlook) }
            : {}),
    };
}
function parseOutlook(value) {
    if (typeof value !== 'string')
        return undefined;
    const match = ['Improving', 'Stable', 'Deteriorating', 'Insufficient Data'].find((entry) => entry.toLowerCase() === value.trim().toLowerCase());
    return match;
}
function parseAiRiskJson(raw) {
    const trimmed = raw
        .replace(/<\/?think>/gi, ' ')
        .replace(/<\/?reasoning>/gi, ' ')
        .trim();
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidate = fenced ? fenced[1].trim() : trimmed;
    const objects = extractJsonObjects(candidate);
    if (objects.length === 0) {
        return { ok: false, reason: '0G Compute response did not contain a JSON object' };
    }
    let lastReason = '0G Compute response was not valid JSON';
    for (const [index, objectText] of objects.entries()) {
        let parsed;
        try {
            parsed = JSON.parse(objectText);
        }
        catch {
            continue;
        }
        const result = exports.aiRiskOutputSchema.safeParse(normalizeAiRiskCandidate(parsed));
        if (result.success)
            return { ok: true, value: result.data };
        const issue = result.error.issues[0];
        const received = parsed && typeof parsed === 'object' && parsed !== null && 'riskLevel' in parsed
            ? ` (received riskLevel ${JSON.stringify(parsed.riskLevel)})`
            : '';
        const reason = `0G Compute JSON failed schema validation: ${issue.path.join('.') || 'root'} ${issue.message}${received}`;
        if (index === 0 || lastReason === '0G Compute response was not valid JSON') {
            lastReason = reason;
        }
    }
    return { ok: false, reason: lastReason };
}
/** Complete `{...}` objects, longest first so nested reasoning fragments lose to the full payload. */
function extractJsonObjects(text) {
    const found = [];
    let depth = 0;
    let start = -1;
    let inString = false;
    let escape = false;
    for (let i = 0; i < text.length; i += 1) {
        const ch = text[i];
        if (inString) {
            if (escape) {
                escape = false;
            }
            else if (ch === '\\') {
                escape = true;
            }
            else if (ch === '"') {
                inString = false;
            }
            continue;
        }
        if (ch === '"') {
            inString = true;
            continue;
        }
        if (ch === '{') {
            if (depth === 0)
                start = i;
            depth += 1;
            continue;
        }
        if (ch === '}' && depth > 0) {
            depth -= 1;
            if (depth === 0 && start >= 0) {
                found.push(text.slice(start, i + 1));
                start = -1;
            }
        }
    }
    return found.sort((a, b) => b.length - a.length);
}
function completionTextFromChoice(choice) {
    const message = choice.message ?? {};
    const content = typeof message.content === 'string' ? message.content.trim() : '';
    const reasoning = typeof message.reasoning_content === 'string' ? message.reasoning_content.trim() : '';
    if (content && reasoning)
        return `${content}\n${reasoning}`;
    return content || reasoning;
}
