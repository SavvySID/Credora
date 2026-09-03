import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseAiRiskJson } from './riskSchema';

test('parses optional riskOutlook without changing riskScore semantics', () => {
  const result = parseAiRiskJson(
    JSON.stringify({
      riskLevel: 'Medium',
      riskScore: 410,
      keyRiskFactors: ['Thin file'],
      positiveFactors: ['Recent activity'],
      assessmentSummary: 'Stable on the available facts.',
      confidence: 0.6,
      riskOutlook: 'Stable',
    }),
  );
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.riskScore, 410);
    assert.equal(result.value.riskOutlook, 'Stable');
  }
});

test('parses valid AI risk JSON', () => {
  const result = parseAiRiskJson(
    JSON.stringify({
      riskLevel: 'Medium',
      riskScore: 410,
      keyRiskFactors: ['No repayment history'],
      positiveFactors: ['Recent activity'],
      assessmentSummary: 'Thin credit file with recent on-chain activity.',
      confidence: 0.6,
    }),
  );
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.value.riskScore, 410);
});

test('rejects malformed JSON', () => {
  const result = parseAiRiskJson('not json');
  assert.equal(result.ok, false);
});

test('rejects out-of-range riskScore', () => {
  const result = parseAiRiskJson(
    JSON.stringify({
      riskLevel: 'High',
      riskScore: 1500,
      keyRiskFactors: [],
      positiveFactors: [],
      assessmentSummary: 'x',
      confidence: 0.5,
    }),
  );
  assert.equal(result.ok, false);
});

test('normalizes "Medium risk" and percent confidence', () => {
  const result = parseAiRiskJson(
    JSON.stringify({
      riskLevel: 'Medium risk',
      riskScore: 410.4,
      keyRiskFactors: ['Thin file'],
      positiveFactors: ['Recent activity'],
      assessmentSummary: 'Independent AI risk, not the Credora score.',
      confidence: 62,
    }),
  );
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.riskLevel, 'Medium');
    assert.equal(result.value.riskScore, 410);
    assert.equal(result.value.confidence, 0.62);
  }
});

test('normalizes lowercase riskLevel and ignores extra keys', () => {
  const result = parseAiRiskJson(
    JSON.stringify({
      riskLevel: 'medium',
      riskScore: 410,
      keyRiskFactors: ['Thin file'],
      positiveFactors: ['Recent activity'],
      assessmentSummary: 'Independent AI risk, not the Credora score.',
      confidence: 0.6,
      extraModelField: true,
    }),
  );
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.value.riskLevel, 'Medium');
});

test('unwraps answer wrapper and maps rationale to summary', () => {
  const result = parseAiRiskJson(
    JSON.stringify({
      answer: {
        wallet: '0xabc',
        riskScore: 620,
        riskLevel: 'High',
        creditBand: 'Established',
        rationale: 'Thin file and low balance.',
        missingInputs: ['repayment history'],
      },
    }),
  );
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.riskLevel, 'High');
    assert.equal(result.value.riskScore, 620);
    assert.equal(result.value.assessmentSummary, 'Thin file and low balance.');
  }
});

test('rejects invalid riskLevel', () => {
  const result = parseAiRiskJson(
    JSON.stringify({
      riskLevel: 'Critical',
      riskScore: 10,
      keyRiskFactors: [],
      positiveFactors: [],
      assessmentSummary: 'x',
      confidence: 0.5,
    }),
  );
  assert.equal(result.ok, false);
});

test('extracts fenced JSON', () => {
  const result = parseAiRiskJson(`\`\`\`json
{"riskLevel":"Low","riskScore":120,"keyRiskFactors":[],"positiveFactors":["Active wallet"],"assessmentSummary":"Low risk given facts.","confidence":0.7}
\`\`\``);
  assert.equal(result.ok, true);
});

test('prefers the longest JSON object when reasoning includes fragments', () => {
  const result = parseAiRiskJson(`scratch { "riskLevel": "nope" }
{"riskLevel":"Low","riskScore":120,"keyRiskFactors":[],"positiveFactors":["Active wallet"],"assessmentSummary":"Low risk given facts.","confidence":0.7}`);
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.value.riskScore, 120);
});

test('extracts JSON from reasoning_content when content is empty', () => {
  const result = parseAiRiskJson(`thinking...
{
  "riskLevel": "Medium",
  "riskScore": 430,
  "keyRiskFactors": ["Thin file"],
  "positiveFactors": ["No overdue"],
  "assessmentSummary": "Unproven but clean.",
  "confidence": 0.6
}`);
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.value.riskScore, 430);
});

test('rejects invalid confidence', () => {
  const result = parseAiRiskJson(
    JSON.stringify({
      riskLevel: 'Low',
      riskScore: 10,
      keyRiskFactors: [],
      positiveFactors: [],
      assessmentSummary: 'x',
      confidence: 1.4,
    }),
  );
  assert.equal(result.ok, false);
});

test('rejects oversized factor lists', () => {
  const result = parseAiRiskJson(
    JSON.stringify({
      riskLevel: 'Low',
      riskScore: 10,
      keyRiskFactors: Array.from({ length: 9 }, (_, i) => `factor ${i}`),
      positiveFactors: [],
      assessmentSummary: 'x',
      confidence: 0.5,
    }),
  );
  assert.equal(result.ok, false);
});

test('maps specialized analysis text when assessmentSummary is omitted', () => {
  const result = parseAiRiskJson(
    JSON.stringify({
      riskLevel: 'High',
      riskScore: 620,
      analysis: 'Thin file and low liquid balance raise borrower risk.',
      keyRiskFactors: ['Thin file'],
      positiveFactors: ['No overdue loans'],
    }),
  );
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.riskLevel, 'High');
    assert.equal(result.value.assessmentSummary, 'Thin file and low liquid balance raise borrower risk.');
  }
});

test('maps string answer wrapper used by specialized glm completions', () => {
  const result = parseAiRiskJson(
    JSON.stringify({
      riskLevel: 'High',
      riskScore: 580,
      answer: 'Repayment history is unproven; no settled loans observed.',
    }),
  );
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(
      result.value.assessmentSummary,
      'Repayment history is unproven; no settled loans observed.',
    );
  }
});

test('uses the model factor lists when no prose field is present', () => {
  const result = parseAiRiskJson(
    JSON.stringify({
      riskLevel: 'High',
      riskScore: 700,
      keyRiskFactors: ['No repayment history', 'Low balance'],
      positiveFactors: ['Recent inbound activity'],
    }),
  );
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.match(result.value.assessmentSummary, /No repayment history/);
    assert.match(result.value.assessmentSummary, /Recent inbound activity/);
  }
});

test('extracts JSON from think tags and surrounding prose', () => {
  const result = parseAiRiskJson(
    '<think>ok</think> Here is the result\n{"riskLevel":"Low","riskScore":210,"keyRiskFactors":["Thin file"],"positiveFactors":["Active"],"assessmentSummary":"Limited history."}',
  );
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.value.riskScore, 210);
});
