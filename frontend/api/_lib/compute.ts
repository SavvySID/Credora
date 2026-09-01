import type { ScoreResult } from './scoring';
import { SCORING_MODEL } from './scoring';
import { parseAiRiskJson, completionTextFromChoice, type AiRiskOutput } from './riskSchema';
import { ANALYSIS_FOCUS, type AnalysisType } from './analysis';

/**
 * 0G COMPUTE INTEGRATION
 * ======================
 *
 * Primary Phase 3 role: structured borrower-risk JSON via assessBorrowerRisk().
 * explainScore() is retained but is not used on the default profile path.
 * The deterministic score in scoring.ts is never produced or altered here.
 *
 * Transport: the 0G Compute Router (https://router-api.0g.ai/v1), which is
 * OpenAI-compatible and authenticated with a single `sk-` key held server-side.
 * Provision at https://pc.0g.ai -> API Keys, with `inference` permission.
 */

function computeEnv() {
  return {
    routerUrl: process.env.ZG_COMPUTE_ROUTER_URL ?? 'https://router-api.0g.ai/v1',
    apiKey: process.env.ZG_COMPUTE_API_KEY ?? '',
    model: process.env.ZG_COMPUTE_MODEL ?? '',
    timeoutMs: Number.parseInt(process.env.ZG_COMPUTE_TIMEOUT_MS ?? '25000', 10),
  };
}

export interface NarrativeResult {
  available: boolean;
  provider: string | null;
  model: string | null;
  text: string | null;
  /** Populated when the narrative could not be produced. */
  blockedReason: string | null;
  latencyMs: number | null;
}

export function computeCapability(): { available: boolean; blockedReason: string | null } {
  const { apiKey, model } = computeEnv();
  if (!apiKey) {
    return {
      available: false,
      blockedReason:
        'ZG_COMPUTE_API_KEY is not set. Create an inference key at https://pc.0g.ai and fund the unified balance with 0G.',
    };
  }
  if (!model) {
    return {
      available: false,
      blockedReason:
        'ZG_COMPUTE_MODEL is not set. Pick a model id from GET https://router-api.0g.ai/v1/models.',
    };
  }
  return { available: true, blockedReason: null };
}

function buildPrompt(wallet: string, score: ScoreResult): string {
  const lines = score.factors.map(
    (factor) =>
      `- ${factor.factor}: observed ${factor.observed}, normalised ${factor.normalized.toFixed(
        2,
      )}, weight ${factor.weight}`,
  );

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
export async function explainScore(wallet: string, score: ScoreResult): Promise<NarrativeResult> {
  const capability = computeCapability();

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

  const { routerUrl, apiKey, model, timeoutMs } = computeEnv();
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
            content:
              `You explain credit assessments produced by ${SCORING_MODEL.id}. ` +
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

    const payload = (await response.json()) as {
      model?: string;
      choices?: Array<{ message?: { content?: string } }>;
    };

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
  } catch (error) {
    const reason =
      error instanceof Error && error.name === 'AbortError'
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
  } finally {
    clearTimeout(timer);
  }
}

export function computeModelId(): string {
  return computeEnv().model;
}

export interface RiskInferenceResult {
  available: boolean;
  output: AiRiskOutput | null;
  provider: string | null;
  model: string | null;
  blockedReason: string | null;
  latencyMs: number | null;
}

const RISK_SYSTEM =
  'You are Credora\'s on-chain credit risk analyst. You only evaluate the JSON facts provided. ' +
  'You never invent loans, transactions, balances, or scores. You never modify the deterministicScore. ' +
  'Higher riskScore means more risk (0 = lowest risk, 1000 = highest risk). ' +
  'riskLevel must be exactly one of Low, Medium, High — never creditBand values (Building, Established, Excellent). ' +
  'Reply with a single JSON object only.';

/** Specialized modes must keep the same keys as general. glm often drops assessmentSummary without this. */
const RISK_JSON_SHAPE =
  'Required JSON keys — do not omit any of them: ' +
  'riskLevel (exactly Low, Medium, or High), ' +
  'riskScore (integer 0-1000, higher = more risk), ' +
  'keyRiskFactors (array of strings), ' +
  'positiveFactors (array of strings), ' +
  'assessmentSummary (non-empty string: the focused analysis in 1-4 sentences). ' +
  'Optional: confidence (number 0-1). Extra keys are allowed. ' +
  'Shape example only (replace with your analysis of the facts): ' +
  '{"riskLevel":"Medium","riskScore":410,"keyRiskFactors":["example"],"positiveFactors":["example"],"assessmentSummary":"Focused analysis of the provided facts."}';

/**
 * Structured 0G Compute risk inference. Never returns a fabricated assessment.
 */
export async function assessBorrowerRisk(
  userJson: string,
  analysisType: AnalysisType = 'general',
): Promise<RiskInferenceResult> {
  const capability = computeCapability();
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
  const outlookHint =
    analysisType === 'risk-outlook'
      ? ' Also include riskOutlook as exactly Improving, Stable, Deteriorating, or Insufficient Data.'
      : '';
  const system =
    analysisType === 'general'
      ? RISK_SYSTEM
      : `${RISK_SYSTEM} Analytical focus: ${ANALYSIS_FOCUS[analysisType]} ${RISK_JSON_SHAPE}${outlookHint} Use only the provided facts.`;
  const messages = [
    { role: 'system', content: system },
    { role: 'user', content: userJson },
  ];

  const withFormat = await chatCompletion(messages, true);
  const completion =
    withFormat.ok || withFormat.status === null
      ? withFormat
      : await chatCompletion(messages, false);

  const latencyMs = Date.now() - started;

  const requestedModel = computeModelId();

  if (!completion.ok) {
    return {
      available: false,
      output: null,
      provider: '0G Compute Router',
      model: requestedModel,
      blockedReason: completion.reason,
      latencyMs,
    };
  }

  const parsed = parseAiRiskJson(completion.text);
  if (!parsed.ok) {
    return {
      available: false,
      output: null,
      provider: '0G Compute Router',
      model: completion.model ?? requestedModel,
      blockedReason: parsed.reason,
      latencyMs,
    };
  }

  return {
    available: true,
    output: parsed.value,
    provider: '0G Compute Router',
    model: completion.model ?? requestedModel,
    blockedReason: null,
    latencyMs,
  };
}

async function chatCompletion(
  messages: Array<{ role: string; content: string }>,
  jsonMode: boolean,
): Promise<{ ok: true; text: string; model: string | null; status: number } | { ok: false; reason: string; status: number | null }> {
  const { routerUrl, apiKey, model, timeoutMs } = computeEnv();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const body: Record<string, unknown> = {
      model,
      temperature: 0,
      max_tokens: 1600,
      reasoning_effort: 'low',
      messages,
    };
    if (jsonMode) body.response_format = { type: 'json_object' };

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

    const payload = (await response.json()) as {
      model?: string;
      choices?: Array<{
        message?: { content?: string | null; reasoning_content?: string | null };
      }>;
    };
    const text = payload.choices?.[0] ? completionTextFromChoice(payload.choices[0]) : '';
    if (!text) {
      return { ok: false, reason: '0G Compute returned an empty completion', status: response.status };
    }
    return { ok: true, text, model: payload.model ?? model, status: response.status };
  } catch (error) {
    const reason =
      error instanceof Error && error.name === 'AbortError'
        ? `0G Compute did not respond within ${timeoutMs}ms`
        : error instanceof Error
          ? error.message
          : String(error);
    return { ok: false, reason, status: null };
  } finally {
    clearTimeout(timer);
  }
}

export interface ComputeProbe {
  reachable: boolean;
  configured: boolean;
  blockedReason: string | null;
  models: number | null;
  error: string | null;
}

/** GET /v1/models needs no auth, so reachability is testable without a key. */
export async function probeCompute(): Promise<ComputeProbe> {
  const capability = computeCapability();

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    const response = await fetch(`${computeEnv().routerUrl}/models`, { signal: controller.signal });
    clearTimeout(timer);

    if (!response.ok) {
      return {
        reachable: false,
        configured: capability.available,
        blockedReason: capability.blockedReason,
        models: null,
        error: `Router responded ${response.status}`,
      };
    }

    const payload = (await response.json()) as { data?: unknown[] };

    return {
      reachable: true,
      configured: capability.available,
      blockedReason: capability.blockedReason,
      models: Array.isArray(payload.data) ? payload.data.length : null,
      error: null,
    };
  } catch (error) {
    return {
      reachable: false,
      configured: capability.available,
      blockedReason: capability.blockedReason,
      models: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
