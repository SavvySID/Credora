import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';
import { completionTextFromChoice, parseAiRiskJson } from '../../frontend/api/_lib/riskSchema';

/**
 * Live 0G Compute proof. Never mocks a successful inference.
 * Exit 0 PASS, 2 BLOCKED, 1 FAIL.
 */
const EXIT_BLOCKED = 2;

loadEnv({ path: resolve(process.cwd(), '.env') });
loadEnv({ path: resolve(process.cwd(), '../frontend/.env.local') });
loadEnv({ path: resolve(process.cwd(), '../frontend/.env') });

const ROUTER = process.env.ZG_COMPUTE_ROUTER_URL ?? 'https://router-api.0g.ai/v1';
const KEY = process.env.ZG_COMPUTE_API_KEY ?? '';
const MODEL = process.env.ZG_COMPUTE_MODEL ?? '';
const TIMEOUT_MS = Number.parseInt(process.env.ZG_COMPUTE_TIMEOUT_MS ?? '45000', 10);

function blocked(reason: string): never {
  console.log('\nBLOCKED 0G Compute E2E');
  console.log(reason);
  console.log('\nTo unblock:');
  console.log('  1. Create an inference key at https://pc.0g.ai');
  console.log('  2. Set ZG_COMPUTE_API_KEY and ZG_COMPUTE_MODEL in frontend/.env.local');
  console.log('  3. Fund the 0G Compute unified balance');
  console.log('\nNo inference was attempted as a success. No mock result was generated.\n');
  process.exitCode = EXIT_BLOCKED;
  return undefined as never;
}

function fail(reason: string, extra?: string): never {
  console.error(`FAIL  ${reason}`);
  if (extra) console.error(`         ${extra}`);
  process.exitCode = 1;
  return undefined as never;
}

async function main() {
  console.log('\nCredora 0G Compute end-to-end proof');
  console.log('='.repeat(60));

  if (!KEY) return blocked('ZG_COMPUTE_API_KEY is not set.');
  if (!MODEL) {
    return blocked('ZG_COMPUTE_MODEL is not set. Pick an id from GET https://router-api.0g.ai/v1/models');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const user = JSON.stringify({
    deterministicScore: 387,
    creditBand: 'Building',
    transactionCount: 14,
    overdue: false,
    repaidLoanCount: 0,
    instructions: ['Do not invent loans.', 'riskScore higher means more risk.', 'JSON only.'],
  });

  let response: Response;
  try {
    response = await fetch(`${ROUTER}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0,
        max_tokens: 1600,
        reasoning_effort: 'low',
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'Return JSON with riskLevel (Low|Medium|High), riskScore (0-1000, higher=more risk), keyRiskFactors, positiveFactors, assessmentSummary, confidence (0-1). Do not invent facts. JSON object only.',
          },
          { role: 'user', content: user },
        ],
      }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (error instanceof Error && error.name === 'AbortError') {
      return fail(`timeout after ${TIMEOUT_MS}ms`);
    }
    return blocked(`Router request failed: ${message}`);
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 401 || response.status === 403) {
    return blocked(`Router rejected the key (${response.status}).`);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    return fail(`router ${response.status}`, body.slice(0, 400));
  }

  const payload = (await response.json()) as {
    model?: string;
    choices?: Array<{
      finish_reason?: string;
      message?: { content?: string | null; reasoning_content?: string | null };
    }>;
  };
  const choice = payload.choices?.[0];
  const text = choice ? completionTextFromChoice(choice) : '';
  const parsed = parseAiRiskJson(text);
  if (!parsed.ok) {
    return fail(
      parsed.reason,
      `model ${payload.model ?? MODEL} finish=${choice?.finish_reason ?? 'n/a'} preview=${text.slice(0, 300) || '(empty)'}`,
    );
  }

  console.log('PASS    0G Compute structured risk JSON');
  console.log(`         model ${payload.model ?? MODEL}`);
  console.log(`         riskLevel ${parsed.value.riskLevel} riskScore ${parsed.value.riskScore}`);
  console.log('\nResult\n------\n1 passed, 0 failed, 0 blocked\n');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
