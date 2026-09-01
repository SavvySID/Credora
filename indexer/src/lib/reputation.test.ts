import assert from 'node:assert/strict';
import { test } from 'node:test';
import { earnedBadges, evaluateReputation, BADGE_IDS } from './reputation';

const now = Date.parse('2026-09-01T12:00:00.000Z');

test('new wallet earns no badges', () => {
  const badges = earnedBadges(
    {
      lastActivity: null,
      firstSeen: null,
      transactionCount: 0,
      repaid: 0,
      repaymentRate: null,
      overdue: 0,
      latestAssessmentVerified: false,
      anyVerifiedRecord: false,
    },
    now,
  );
  assert.equal(badges.length, 0);
});

test('verified credit record and profile badges', () => {
  const all = evaluateReputation(
    {
      lastActivity: '2026-09-01T08:00:00.000Z',
      firstSeen: '2026-08-20T00:00:00.000Z',
      transactionCount: 14,
      repaid: 0,
      repaymentRate: null,
      overdue: 0,
      latestAssessmentVerified: true,
      anyVerifiedRecord: true,
    },
    now,
  );
  const earned = all.filter((badge) => badge.earned).map((badge) => badge.id);
  assert.deepEqual(earned, [
    'verified_credit_record',
    'on_chain_active',
    'verified_profile',
  ]);
  assert.equal(all.find((badge) => badge.id === 'established_wallet')?.earned, false);
  assert.equal(all.find((badge) => badge.id === 'consistent_repayer')?.earned, false);
});

test('established wallet requires age and nonce', () => {
  const young = evaluateReputation(
    {
      lastActivity: '2026-09-01T08:00:00.000Z',
      firstSeen: '2026-08-20T00:00:00.000Z',
      transactionCount: 14,
      repaid: 0,
      repaymentRate: null,
      overdue: 0,
      latestAssessmentVerified: false,
      anyVerifiedRecord: false,
    },
    now,
  );
  assert.equal(young.find((badge) => badge.id === 'established_wallet')?.earned, false);

  const established = evaluateReputation(
    {
      lastActivity: '2026-09-01T08:00:00.000Z',
      firstSeen: '2026-07-01T00:00:00.000Z',
      transactionCount: 10,
      repaid: 0,
      repaymentRate: null,
      overdue: 0,
      latestAssessmentVerified: false,
      anyVerifiedRecord: false,
    },
    now,
  );
  assert.equal(established.find((badge) => badge.id === 'established_wallet')?.earned, true);
});

test('consistent repayer requires repaid loan, full rate, no overdue', () => {
  const overdue = evaluateReputation(
    {
      lastActivity: '2026-09-01T08:00:00.000Z',
      firstSeen: '2026-01-01T00:00:00.000Z',
      transactionCount: 20,
      repaid: 1,
      repaymentRate: 1,
      overdue: 1,
      latestAssessmentVerified: false,
      anyVerifiedRecord: false,
    },
    now,
  );
  assert.equal(overdue.find((badge) => badge.id === 'consistent_repayer')?.earned, false);

  const repaid = evaluateReputation(
    {
      lastActivity: '2026-09-01T08:00:00.000Z',
      firstSeen: '2026-01-01T00:00:00.000Z',
      transactionCount: 20,
      repaid: 1,
      repaymentRate: 1,
      overdue: 0,
      latestAssessmentVerified: false,
      anyVerifiedRecord: false,
    },
    now,
  );
  assert.equal(repaid.find((badge) => badge.id === 'consistent_repayer')?.earned, true);
});

test('no AI Approved badge exists', () => {
  assert.equal((BADGE_IDS as readonly string[]).includes('ai_approved'), false);
});
