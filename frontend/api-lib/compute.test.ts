import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { assessBorrowerRisk, computeCapability } from './compute';

const originalFetch = globalThis.fetch;
const originalKey = process.env.ZG_COMPUTE_API_KEY;
const originalModel = process.env.ZG_COMPUTE_MODEL;
const originalTimeout = process.env.ZG_COMPUTE_TIMEOUT_MS;

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.ZG_COMPUTE_API_KEY;
  else process.env.ZG_COMPUTE_API_KEY = originalKey;
  if (originalModel === undefined) delete process.env.ZG_COMPUTE_MODEL;
  else process.env.ZG_COMPUTE_MODEL = originalModel;
  if (originalTimeout === undefined) delete process.env.ZG_COMPUTE_TIMEOUT_MS;
  else process.env.ZG_COMPUTE_TIMEOUT_MS = originalTimeout;
});

test('Compute unavailable when credentials are missing', async () => {
  delete process.env.ZG_COMPUTE_API_KEY;
  delete process.env.ZG_COMPUTE_MODEL;

  const capability = computeCapability();
  assert.equal(capability.available, false);
  assert.match(capability.blockedReason ?? '', /ZG_COMPUTE_API_KEY/);

  const inference = await assessBorrowerRisk(JSON.stringify({ deterministicScore: 400 }));
  assert.equal(inference.available, false);
  assert.equal(inference.output, null);
  assert.match(inference.blockedReason ?? '', /ZG_COMPUTE_API_KEY/);
});

test('Compute timeout returns unavailable, never a fabricated assessment', async () => {
  process.env.ZG_COMPUTE_API_KEY = 'sk-test';
  process.env.ZG_COMPUTE_MODEL = 'demo-model';
  process.env.ZG_COMPUTE_TIMEOUT_MS = '40';

  globalThis.fetch = ((_url, init) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        const error = new Error('aborted');
        error.name = 'AbortError';
        reject(error);
      });
    })) as typeof fetch;

  const inference = await assessBorrowerRisk(JSON.stringify({ deterministicScore: 400 }));
  assert.equal(inference.available, false);
  assert.equal(inference.output, null);
  assert.match(inference.blockedReason ?? '', /did not respond within 40ms/);
});

test('uses reasoning_content when message content is empty', async () => {
  process.env.ZG_COMPUTE_API_KEY = 'sk-test';
  process.env.ZG_COMPUTE_MODEL = 'demo-model';

  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        model: 'demo-model',
        choices: [
          {
            message: {
              content: '',
              reasoning_content:
                'Let me think.\n{"riskLevel":"Medium","riskScore":430,"keyRiskFactors":["Thin file"],"positiveFactors":["No overdue"],"assessmentSummary":"Unproven but clean.","confidence":0.6}',
            },
          },
        ],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )) as typeof fetch;

  const inference = await assessBorrowerRisk(JSON.stringify({ deterministicScore: 400 }));
  assert.equal(inference.available, true);
  assert.equal(inference.output?.riskScore, 430);
});

test('malformed Compute JSON is unavailable fallback, not a fake score', async () => {
  process.env.ZG_COMPUTE_API_KEY = 'sk-test';
  process.env.ZG_COMPUTE_MODEL = 'demo-model';

  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        model: 'demo-model',
        choices: [{ message: { content: 'sorry, here is prose instead of JSON' } }],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )) as typeof fetch;

  const inference = await assessBorrowerRisk(JSON.stringify({ deterministicScore: 400 }));
  assert.equal(inference.available, false);
  assert.equal(inference.output, null);
  assert.match(inference.blockedReason ?? '', /JSON/);
});

test('specialized analysis changes the system focus, not the score contract', async () => {
  process.env.ZG_COMPUTE_API_KEY = 'sk-test';
  process.env.ZG_COMPUTE_MODEL = 'demo-model';
  let body: { messages?: Array<{ role: string; content: string }> } | null = null;

  globalThis.fetch = (async (_url, init) => {
    body = JSON.parse(String(init?.body ?? '{}'));
    return new Response(
      JSON.stringify({
        model: 'demo-model',
        choices: [
          {
            message: {
              content:
                '{"riskLevel":"Low","riskScore":210,"keyRiskFactors":[],"positiveFactors":["Recent activity"],"assessmentSummary":"Repayment-focused view of the same facts.","confidence":0.5}',
            },
          },
        ],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }) as typeof fetch;

  const inference = await assessBorrowerRisk(
    JSON.stringify({ deterministicScore: 400, creditBand: 'Established' }),
    'repayment-behavior',
  );
  assert.equal(inference.available, true);
  assert.equal(inference.output?.riskScore, 210);
  assert.match(body?.messages?.[0]?.content ?? '', /repayment/i);
  assert.match(body?.messages?.[0]?.content ?? '', /assessmentSummary/);
  assert.doesNotMatch(body?.messages?.[0]?.content ?? '', /credora-onchain-v1/);
});

test('always requests json_object and low reasoning effort', async () => {
  process.env.ZG_COMPUTE_API_KEY = 'sk-test';
  process.env.ZG_COMPUTE_MODEL = 'demo-model';
  let body: {
    max_tokens?: number;
    reasoning_effort?: string;
    response_format?: { type: string };
  } | null = null;

  globalThis.fetch = (async (_url, init) => {
    body = JSON.parse(String(init?.body ?? '{}'));
    return new Response(
      JSON.stringify({
        model: 'demo-model',
        choices: [
          {
            message: {
              content:
                '{"riskLevel":"Low","riskScore":120,"keyRiskFactors":[],"positiveFactors":[],"assessmentSummary":"General view.","confidence":0.5}',
            },
          },
        ],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }) as typeof fetch;

  await assessBorrowerRisk(JSON.stringify({ deterministicScore: 400 }), 'general');
  assert.equal(body?.response_format?.type, 'json_object');
  assert.equal(body?.reasoning_effort, 'low');
  assert.ok((body?.max_tokens ?? 0) >= 500);
});

test('general prompt always includes the JSON shape', async () => {
  process.env.ZG_COMPUTE_API_KEY = 'sk-test';
  process.env.ZG_COMPUTE_MODEL = 'demo-model';
  let body: { messages?: Array<{ role: string; content: string }> } | null = null;

  globalThis.fetch = (async (_url, init) => {
    body = JSON.parse(String(init?.body ?? '{}'));
    return new Response(
      JSON.stringify({
        model: 'demo-model',
        choices: [
          {
            message: {
              content:
                '{"riskLevel":"Low","riskScore":120,"keyRiskFactors":[],"positiveFactors":[],"assessmentSummary":"General view.","confidence":0.5}',
            },
          },
        ],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }) as typeof fetch;

  await assessBorrowerRisk(JSON.stringify({ deterministicScore: 400 }), 'general');
  assert.match(body?.messages?.[0]?.content ?? '', /Required JSON keys/);
});

test('repairs a prose Compute reply into JSON on a second json_object call', async () => {
  process.env.ZG_COMPUTE_API_KEY = 'sk-test';
  process.env.ZG_COMPUTE_MODEL = 'demo-model';
  let calls = 0;

  globalThis.fetch = (async () => {
    calls += 1;
    if (calls === 1) {
      return new Response(
        JSON.stringify({
          model: 'demo-model',
          choices: [{ message: { content: 'The wallet looks medium risk overall.' } }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }
    return new Response(
      JSON.stringify({
        model: 'demo-model',
        choices: [
          {
            message: {
              content:
                '{"riskLevel":"Medium","riskScore":400,"keyRiskFactors":["Thin file"],"positiveFactors":[],"assessmentSummary":"Unproven file."}',
            },
          },
        ],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }) as typeof fetch;

  const inference = await assessBorrowerRisk(JSON.stringify({ deterministicScore: 400 }));
  assert.equal(calls, 2);
  assert.equal(inference.available, true);
  assert.equal(inference.output?.riskScore, 400);
});
