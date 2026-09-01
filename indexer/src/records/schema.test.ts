import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkRecordIntegrity, recordBodySchema, storedRecordSchema } from './schema';

const oldAssessment = {
  schemaVersion: 1 as const,
  wallet: '0xa059c12e1cf7e24311c035e76f90d9b16801095f',
  eventType: 'credit_assessment' as const,
  loanId: null,
  txHash: null,
  blockNumber: null,
  logIndex: null,
  timestamp: '2026-09-01T06:09:52.764Z',
  chainId: 16602,
  source: 'compute' as const,
  values: {
    creditScore: 376,
    riskLevel: 'Low' as const,
    confidence: 0.85,
  },
  meta: {
    model: 'credora-onchain-v1',
    methodology: 'credora-onchain-v1@1.0.0 deterministic weighted sum',
  },
};

test('legacy credit_assessment bodies still parse', () => {
  const parsed = recordBodySchema.safeParse(oldAssessment);
  assert.equal(parsed.success, true);
});

test('new ai_risk_assessment optional fields parse', () => {
  const parsed = recordBodySchema.safeParse({
    ...oldAssessment,
    eventType: 'ai_risk_assessment',
    source: 'compute',
    values: {
      confidence: 0.7,
      deterministicScore: 387,
      aiRiskScore: 410,
      aiRiskLevel: 'Medium',
      sourceDataHash: '0x' + 'ab'.repeat(32),
      riskFactors: ['Thin repayment history'],
      positiveFactors: ['Recent on-chain activity'],
      assessmentSummary: 'Limited lending history; activity is recent.',
      modelVersion: 'demo-1',
      analysisType: 'repayment-behavior',
      analysisLabel: 'Repayment Behavior',
    },
  });
  assert.equal(parsed.success, true);
});

test('integrity check rejects a tampered recordId', () => {
  const body = recordBodySchema.parse(oldAssessment);
  const stored = storedRecordSchema.parse({
    ...body,
    recordId: '0x' + '11'.repeat(32),
  });
  const result = checkRecordIntegrity(stored);
  assert.equal(result.ok, false);
  assert.match(result.detail ?? '', /Content hash mismatch/);
});

test('new credit_assessment uses derived source; ai_risk_assessment uses compute', () => {
  const credit = recordBodySchema.safeParse({
    ...oldAssessment,
    source: 'derived',
  });
  const ai = recordBodySchema.safeParse({
    ...oldAssessment,
    eventType: 'ai_risk_assessment',
    source: 'compute',
    values: {
      confidence: 0.7,
      aiRiskScore: 200,
      aiRiskLevel: 'Low',
    },
  });
  assert.equal(credit.success, true);
  assert.equal(ai.success, true);
});
