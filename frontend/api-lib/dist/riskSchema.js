"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiRiskOutputSchema = exports.AI_RISK_LEVELS = void 0;
exports.parseAiRiskJson = parseAiRiskJson;
exports.completionTextFromChoice = completionTextFromChoice;
exports.parseComputeChoice = parseComputeChoice;
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
function coerceFiniteNumber(value) {
    if (typeof value === 'number' && Number.isFinite(value))
        return value;
    if (typeof value === 'string' && value.trim()) {
        const parsed = Number(value.trim());
        if (Number.isFinite(parsed))
            return parsed;
    }
    return undefined;
}
/** Model lists as arrays, a single string, or `{ factor: "..." }` objects. Truncate — do not reject. */
function asStringList(value, max = 8) {
    const items = Array.isArray(value) ? value : value == null || value === '' ? [] : [value];
    const out = [];
    for (const item of items) {
        if (out.length >= max)
            break;
        if (typeof item === 'string' && item.trim()) {
            out.push(item.trim().slice(0, 240));
            continue;
        }
        if (item && typeof item === 'object' && !Array.isArray(item)) {
            const rec = item;
            const text = (typeof rec.factor === 'string' && rec.factor) ||
                (typeof rec.text === 'string' && rec.text) ||
                (typeof rec.reason === 'string' && rec.reason) ||
                '';
            if (text.trim())
                out.push(text.trim().slice(0, 240));
        }
    }
    return out;
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
    const scoreRaw = coerceFiniteNumber(raw.riskScore ?? raw.risk_score);
    const riskScore = scoreRaw === undefined ? undefined : Math.round(scoreRaw);
    let confidence = coerceFiniteNumber(raw.confidence);
    if (typeof confidence === 'number' && confidence >= 2 && confidence <= 100) {
        confidence = confidence / 100;
    }
    if (typeof confidence === 'number' && (confidence < 0 || confidence > 1)) {
        confidence = undefined;
    }
    return {
        riskLevel,
        riskScore,
        keyRiskFactors: asStringList(raw.keyRiskFactors ?? raw.riskFactors ?? raw.key_risk_factors),
        positiveFactors: asStringList(raw.positiveFactors ?? raw.positive_factors),
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
function sanitizeComputeText(raw) {
    return raw
        .replace(/<\/?think>/gi, ' ')
        .replace(/<\/?reasoning>/gi, ' ')
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/[\u2018\u2019]/g, "'")
        .trim();
}
function jsonParseLoose(objectText) {
    const attempts = [
        objectText,
        objectText.replace(/,\s*([}\]])/g, '$1'),
        objectText
            .replace(/\bTrue\b/g, 'true')
            .replace(/\bFalse\b/g, 'false')
            .replace(/\bNone\b/g, 'null')
            .replace(/,\s*([}\]])/g, '$1'),
    ];
    for (const attempt of attempts) {
        try {
            return JSON.parse(attempt);
        }
        catch {
            /* next encoding quirk */
        }
    }
    return undefined;
}
function schemaReason(parsed, issuePath, issueMessage) {
    const received = parsed && typeof parsed === 'object' && parsed !== null && 'riskLevel' in parsed
        ? ` (received riskLevel ${JSON.stringify(parsed.riskLevel)})`
        : '';
    return `0G Compute JSON failed schema validation: ${issuePath || 'root'} ${issueMessage}${received}`;
}
function trySchema(parsed) {
    const result = exports.aiRiskOutputSchema.safeParse(normalizeAiRiskCandidate(parsed));
    if (result.success)
        return { ok: true, value: result.data };
    const issue = result.error.issues[0];
    return { ok: false, reason: schemaReason(parsed, issue.path.join('.'), issue.message) };
}
function parseAiRiskJson(raw) {
    const trimmed = sanitizeComputeText(raw);
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidate = fenced ? fenced[1].trim() : trimmed;
    const objects = extractJsonObjects(candidate);
    const closed = closeTruncatedJson(candidate);
    if (closed && !objects.includes(closed))
        objects.push(closed);
    if (objects.length === 0) {
        return { ok: false, reason: '0G Compute response did not contain a JSON object' };
    }
    let lastReason = '0G Compute response was not valid JSON';
    for (const [index, objectText] of objects.entries()) {
        const parsed = jsonParseLoose(objectText);
        if (parsed === undefined)
            continue;
        const result = trySchema(parsed);
        if (result.ok)
            return result;
        if (index === 0 || lastReason === '0G Compute response was not valid JSON') {
            lastReason = result.reason;
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
/** Close a cut-off `{...}` so a length-truncated glm reply can still parse. Does not invent keys. */
function closeTruncatedJson(text) {
    const start = text.indexOf('{');
    if (start < 0)
        return null;
    let slice = text.slice(start).replace(/,\s*$/, '');
    let inString = false;
    let escape = false;
    let braces = 0;
    let brackets = 0;
    for (const ch of slice) {
        if (inString) {
            if (escape)
                escape = false;
            else if (ch === '\\')
                escape = true;
            else if (ch === '"')
                inString = false;
            continue;
        }
        if (ch === '"') {
            inString = true;
            continue;
        }
        if (ch === '{')
            braces += 1;
        else if (ch === '}')
            braces -= 1;
        else if (ch === '[')
            brackets += 1;
        else if (ch === ']')
            brackets -= 1;
    }
    if (!inString && braces <= 0 && brackets <= 0)
        return null;
    if (inString)
        slice += '"';
    while (brackets > 0) {
        slice += ']';
        brackets -= 1;
    }
    while (braces > 0) {
        slice += '}';
        braces -= 1;
    }
    slice = slice.replace(/,\s*([}\]])/g, '$1');
    try {
        JSON.parse(slice);
        return slice;
    }
    catch {
        return null;
    }
}
function completionTextFromChoice(choice) {
    const message = choice.message ?? {};
    const content = typeof message.content === 'string' ? message.content.trim() : '';
    const reasoning = typeof message.reasoning_content === 'string' ? message.reasoning_content.trim() : '';
    if (content && reasoning)
        return `${content}\n${reasoning}`;
    return content || reasoning;
}
function uniqueTexts(values) {
    const out = [];
    for (const value of values) {
        if (value && !out.includes(value))
            out.push(value);
    }
    return out;
}
/** Prefer visible `content` over `reasoning_content` so thinking fragments cannot beat the JSON payload. */
function parseComputeChoice(choice) {
    const message = choice.message ?? {};
    const content = typeof message.content === 'string' ? message.content.trim() : '';
    const reasoning = typeof message.reasoning_content === 'string' ? message.reasoning_content.trim() : '';
    const attempts = uniqueTexts([content, reasoning, [content, reasoning].filter(Boolean).join('\n')]);
    if (attempts.length === 0) {
        return { ok: false, reason: '0G Compute returned an empty completion' };
    }
    let last = {
        ok: false,
        reason: '0G Compute response did not contain a JSON object',
    };
    for (const text of attempts) {
        const parsed = parseAiRiskJson(text);
        if (parsed.ok)
            return parsed;
        last = parsed;
    }
    return last;
}
