"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.probeCompute = exports.computeModelId = exports.computeCapability = void 0;
exports.explainScore = explainScore;
exports.assessBorrowerRisk = assessBorrowerRisk;
const scoring_1 = require("./scoring");
const riskSchema_1 = require("./riskSchema");
const analysis_1 = require("./analysis");
const computeProbe_1 = require("./computeProbe");
var computeProbe_2 = require("./computeProbe");
Object.defineProperty(exports, "computeCapability", { enumerable: true, get: function () { return computeProbe_2.computeCapability; } });
Object.defineProperty(exports, "computeModelId", { enumerable: true, get: function () { return computeProbe_2.computeModelId; } });
Object.defineProperty(exports, "probeCompute", { enumerable: true, get: function () { return computeProbe_2.probeCompute; } });
function buildPrompt(wallet, score) {
    const lines = score.factors.map((factor) => `- ${factor.factor}: observed ${factor.observed}, normalised ${factor.normalized.toFixed(2)}, weight ${factor.weight}`);
    return [
        `Wallet ${wallet} on 0G Galileo received a Credora credit score of ${score.creditScore}/1000 (${score.riskLevel} rating band).`,
        '',
        'The score was produced by a deterministic weighted-feature model, not by you. Do not recalculate or dispute the number.',
        '',
        'Factor breakdown:',
        ...lines,
        '',
        score.completeness.missing.length > 0
            ? `Unavailable inputs: ${score.completeness.missing.join(', ')}.`
            : 'All inputs were available.',
        '',
        'In at most 3 sentences, explain to the wallet owner what is driving this score and the single most effective thing they could do to improve it. Be specific and factual. Do not invent data that is not listed above.',
    ].join('\n');
}
/**
 * Requests an explanation from 0G Compute.
 *
 * Returns `available: false` with a reason on any failure. Callers must render
 * the unavailable state rather than substituting canned text.
 */
async function explainScore(wallet, score) {
    const capability = (0, computeProbe_1.computeCapability)();
    if (!capability.available) {
        return {
            available: false,
            provider: null,
            model: null,
            text: null,
            blockedReason: capability.blockedReason,
            latencyMs: null,
        };
    }
    const { routerUrl, apiKey, model, timeoutMs } = (0, computeProbe_1.computeEnv)();
    const started = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(`${routerUrl}/chat/completions`, {
            method: 'POST',
            signal: controller.signal,
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model,
                temperature: 0.2,
                max_tokens: 220,
                messages: [
                    {
                        role: 'system',
                        content: `You explain credit assessments produced by ${scoring_1.SCORING_MODEL.id}. ` +
                            'You never compute or alter scores, and you never state facts that were not given to you.',
                    },
                    { role: 'user', content: buildPrompt(wallet, score) },
                ],
            }),
        });
        if (!response.ok) {
            const body = await response.text().catch(() => '');
            return {
                available: false,
                provider: '0G Compute Router',
                model,
                text: null,
                blockedReason: `0G Compute returned ${response.status}: ${body.slice(0, 300)}`,
                latencyMs: Date.now() - started,
            };
        }
        const payload = (await response.json());
        const text = payload.choices?.[0]?.message?.content?.trim() ?? null;
        if (!text) {
            return {
                available: false,
                provider: '0G Compute Router',
                model: payload.model ?? model,
                text: null,
                blockedReason: '0G Compute returned an empty completion',
                latencyMs: Date.now() - started,
            };
        }
        return {
            available: true,
            provider: '0G Compute Router',
            // Report the model the router actually served, not the one requested.
            model: payload.model ?? model,
            text,
            blockedReason: null,
            latencyMs: Date.now() - started,
        };
    }
    catch (error) {
        const reason = error instanceof Error && error.name === 'AbortError'
            ? `0G Compute did not respond within ${timeoutMs}ms`
            : error instanceof Error
                ? error.message
                : String(error);
        return {
            available: false,
            provider: '0G Compute Router',
            model,
            text: null,
            blockedReason: reason,
            latencyMs: Date.now() - started,
        };
    }
    finally {
        clearTimeout(timer);
    }
}
const RISK_SYSTEM = 'You are Credora\'s on-chain credit risk analyst. You only evaluate the JSON facts provided. ' +
    'You never invent loans, transactions, balances, or scores. You never modify the deterministicScore. ' +
    'Higher riskScore means more risk (0 = lowest risk, 1000 = highest risk). ' +
    'riskLevel must be exactly one of Low, Medium, High — never creditBand values (Building, Established, Excellent). ' +
    'Reply with a single JSON object only.';
/** glm drops keys unless the shape is in the system prompt on every path, including Vercel. */
const RISK_JSON_SHAPE = 'Required JSON keys — do not omit any of them: ' +
    'riskLevel (exactly Low, Medium, or High), ' +
    'riskScore (integer 0-1000, higher = more risk), ' +
    'keyRiskFactors (array of strings), ' +
    'positiveFactors (array of strings), ' +
    'assessmentSummary (non-empty string: the focused analysis in 1-4 sentences). ' +
    'Optional: confidence (number 0-1). Extra keys are allowed. ' +
    'Shape example only (replace with your analysis of the facts): ' +
    '{"riskLevel":"Medium","riskScore":410,"keyRiskFactors":["example"],"positiveFactors":["example"],"assessmentSummary":"Focused analysis of the provided facts."}';
const REPAIR_BUDGET_MS = 3_000;
const MIN_COMPLETION_TOKENS = 500;
/**
 * Structured 0G Compute risk inference. Never returns a fabricated assessment.
 *
 * Stability contract — do not strip these for latency:
 * - Always request `response_format: json_object` first
 * - Always send `reasoning_effort: low` (glm thinking otherwise eats max_tokens)
 * - Never set max_tokens below 500
 * - Always include RISK_JSON_SHAPE
 * Drop json_object only if the router rejects the format (400/422).
 */
async function assessBorrowerRisk(userJson, analysisType = 'general') {
    const capability = (0, computeProbe_1.computeCapability)();
    if (!capability.available) {
        return {
            available: false,
            output: null,
            provider: null,
            model: null,
            blockedReason: capability.blockedReason,
            latencyMs: null,
        };
    }
    const started = Date.now();
    const budgetMs = (0, computeProbe_1.computeEnv)().timeoutMs;
    const outlookHint = analysisType === 'risk-outlook'
        ? ' Include riskOutlook as Improving, Stable, Deteriorating, or Insufficient Data.'
        : '';
    const focus = analysisType === 'general' ? '' : ` Analytical focus: ${analysis_1.ANALYSIS_FOCUS[analysisType]}.${outlookHint}`;
    const system = `${RISK_SYSTEM} ${RISK_JSON_SHAPE}${focus} Use only the provided facts.`;
    const messages = [
        { role: 'system', content: system },
        { role: 'user', content: userJson },
    ];
    const remaining = () => Math.max(0, budgetMs - (Date.now() - started));
    let completion = await chatCompletion(messages, true, remaining());
    if (!completion.ok && jsonFormatRejected(completion.status, completion.reason)) {
        completion = await chatCompletion(messages, false, remaining());
    }
    const requestedModel = (0, computeProbe_1.computeModelId)();
    if (!completion.ok) {
        return {
            available: false,
            output: null,
            provider: '0G Compute Router',
            model: requestedModel,
            blockedReason: completion.reason,
            latencyMs: Date.now() - started,
        };
    }
    let parsed = (0, riskSchema_1.parseComputeChoice)(completion.choice);
    if (!parsed.ok && completion.text && remaining() >= REPAIR_BUDGET_MS) {
        const repaired = await chatCompletion([
            {
                role: 'system',
                content: `${RISK_SYSTEM} ${RISK_JSON_SHAPE} Reply with the JSON object only. No markdown.`,
            },
            {
                role: 'user',
                content: 'The previous reply was not valid JSON for the required schema. ' +
                    'Convert it into that JSON object. Do not invent loans, balances, or scores.\n\n' +
                    completion.text.slice(0, 2500),
            },
        ], true, remaining());
        if (repaired.ok) {
            const repairedParsed = (0, riskSchema_1.parseComputeChoice)(repaired.choice);
            if (repairedParsed.ok)
                parsed = repairedParsed;
        }
    }
    if (!parsed.ok) {
        return {
            available: false,
            output: null,
            provider: '0G Compute Router',
            model: completion.model ?? requestedModel,
            blockedReason: parsed.reason,
            latencyMs: Date.now() - started,
        };
    }
    return {
        available: true,
        output: parsed.value,
        provider: '0G Compute Router',
        model: completion.model ?? requestedModel,
        blockedReason: null,
        latencyMs: Date.now() - started,
    };
}
function jsonFormatRejected(status, reason) {
    if (status !== 400 && status !== 422)
        return false;
    return /response_format|json_object|json mode/i.test(reason);
}
async function chatCompletion(messages, jsonMode, timeoutMs) {
    const { routerUrl, apiKey, model } = (0, computeProbe_1.computeEnv)();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const maxTokens = Math.max(MIN_COMPLETION_TOKENS, process.env.VERCEL ? 700 : 1600);
    try {
        const body = {
            model,
            temperature: 0,
            max_tokens: maxTokens,
            reasoning_effort: 'low',
            messages,
        };
        if (jsonMode)
            body.response_format = { type: 'json_object' };
        const response = await fetch(`${routerUrl}/chat/completions`, {
            method: 'POST',
            signal: controller.signal,
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });
        if (!response.ok) {
            const text = await response.text().catch(() => '');
            return {
                ok: false,
                reason: `0G Compute returned ${response.status}: ${text.slice(0, 300)}`,
                status: response.status,
            };
        }
        const payload = (await response.json());
        const choice = payload.choices?.[0] ?? {};
        const text = (0, riskSchema_1.completionTextFromChoice)(choice);
        if (!text) {
            return { ok: false, reason: '0G Compute returned an empty completion', status: response.status };
        }
        return { ok: true, text, model: payload.model ?? model, status: response.status, choice };
    }
    catch (error) {
        const reason = error instanceof Error && error.name === 'AbortError'
            ? `0G Compute did not respond within ${timeoutMs}ms`
            : error instanceof Error
                ? error.message
                : String(error);
        return { ok: false, reason, status: null };
    }
    finally {
        clearTimeout(timer);
    }
}
