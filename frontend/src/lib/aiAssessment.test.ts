import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isAwaitingComputeRun, isPendingAi, copiesCreditScore } from './aiAssessment';

test('a missing analysis slot is idle, not a failed run', () => {
  assert.equal(isPendingAi(null), true);
  assert.equal(isPendingAi(undefined), true);
  assert.equal(isAwaitingComputeRun(null, false), true);
});

test('selecting a type without clicking Run stays idle even if a leftover error exists', () => {
  const leftover = {
    available: false,
    blockedReason: '0G Compute did not return a result. Try again.',
  };
  assert.equal(isAwaitingComputeRun(leftover, false), true);
  assert.equal(isAwaitingComputeRun(leftover, true), false);
});

test('a successful cached result is not idle', () => {
  assert.equal(isAwaitingComputeRun({ available: true, blockedReason: null }, false), false);
});

test('detects a Compute riskScore that copied the Credora credit score', () => {
  assert.equal(copiesCreditScore({ available: true, riskScore: 469 }, 469), true);
  assert.equal(copiesCreditScore({ available: true, riskScore: 720 }, 469), false);
  assert.equal(copiesCreditScore({ available: false, riskScore: 469 }, 469), false);
});
