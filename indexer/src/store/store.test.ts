import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';

process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), 'credora-idx-')), 'test.db');

const { closeDb } = await import('./db');
const { buildStoredRecord } = await import('../records/schema');
const { assessmentCacheKey } = await import('../lib/sourceHash');
const {
  getAnalyticsSummary,
  getAssessmentCache,
  getRecordById,
  insertRecord,
  listIndexedBorrowers,
  listRecordsByWallet,
  markRecordStored,
  putAssessmentCache,
  upsertLoan,
} = await import('./repositories');
const { verifyStoredRecord } = await import('../services/verifyService');

const WALLET_A = '0xa059c12e1cf7e24311c035e76f90d9b16801095f';
const WALLET_B = '0xb059c12e1cf7e24311c035e76f90d9b16801095f';
const HASH_A = '0x' + 'ab'.repeat(32);
const HASH_B = '0x' + 'cd'.repeat(32);

function assessment(wallet: string, eventType: 'credit_assessment' | 'ai_risk_assessment') {
  return buildStoredRecord({
    schemaVersion: 1,
    wallet,
    eventType,
    loanId: null,
    txHash: null,
    blockNumber: null,
    logIndex: null,
    timestamp: '2026-09-01T12:00:00.000Z',
    chainId: 16602,
    source: eventType === 'ai_risk_assessment' ? 'compute' : 'derived',
    values: {
      confidence: 0.8,
      ...(eventType === 'credit_assessment'
        ? { creditScore: 410, riskLevel: 'Medium' as const, deterministicScore: 410 }
        : { aiRiskScore: 220, aiRiskLevel: 'Low' as const, deterministicScore: 410 }),
    },
    meta: { model: eventType === 'ai_risk_assessment' ? 'demo@router' : 'credora-onchain-v1' },
  });
}

describe('derived index store', { concurrency: false }, () => {
  before(() => {
    closeDb();
  });

  after(() => {
    closeDb();
  });

  test('analytics summary is empty on a fresh index', () => {
  const summary = getAnalyticsSummary();
  assert.equal(summary.loans.total, 0);
  assert.equal(summary.loans.repaymentRate, null);
  assert.equal(summary.assessments.total, 0);
  assert.equal(summary.borrowers.indexed, 0);
  assert.equal(summary.limitations.loanDefaultedUnsupported, true);
});

test('borrower roster stays empty until a loan or assessment exists', () => {
  assert.deepEqual(listIndexedBorrowers(), []);
});

test('wallet isolation: records for A are not returned for B', () => {
  const recordA = assessment(WALLET_A, 'credit_assessment');
  const recordB = assessment(WALLET_B, 'credit_assessment');
  assert.equal(insertRecord(recordA), true);
  assert.equal(insertRecord(recordB), true);

  const onlyA = listRecordsByWallet(WALLET_A);
  const onlyB = listRecordsByWallet(WALLET_B);
  assert.equal(onlyA.length, 1);
  assert.equal(onlyB.length, 1);
  assert.equal(onlyA[0]?.wallet.toLowerCase(), WALLET_A);
  assert.equal(onlyB[0]?.wallet.toLowerCase(), WALLET_B);
  assert.notEqual(onlyA[0]?.recordId, onlyB[0]?.recordId);
});

test('assessment cache hit vs miss when source hash changes', () => {
  const record = assessment(WALLET_A, 'ai_risk_assessment');
  insertRecord(record);

  const hitKey = assessmentCacheKey(WALLET_A, HASH_A, 'ai_risk_assessment', 'demo@router');
  putAssessmentCache({
    cacheKey: hitKey,
    wallet: WALLET_A,
    sourceDataHash: HASH_A,
    eventType: 'ai_risk_assessment',
    model: 'demo@router',
    recordId: record.recordId,
    createdAt: '2026-09-01T12:00:00.000Z',
  });

  const hit = getAssessmentCache(hitKey);
  assert.ok(hit);
  assert.equal(hit?.recordId, record.recordId);

  const missKey = assessmentCacheKey(WALLET_A, HASH_B, 'ai_risk_assessment', 'demo@router');
  assert.equal(getAssessmentCache(missKey), null);
});

test('borrower roster includes wallets with assessments or loans only', () => {
  upsertLoan({
    loanId: '0x' + '11'.repeat(32),
    wallet: WALLET_A,
    amountWei: '1000000000000000000',
    interestRateBps: 500,
    status: 'active',
    originTxHash: '0x' + '22'.repeat(32),
    originBlock: 1,
    createdAt: '2026-09-01T12:00:00.000Z',
    dueAt: '2026-10-01T12:00:00.000Z',
    repaidAt: null,
    repaidTxHash: null,
    interestWei: null,
  });

  const roster = listIndexedBorrowers(50);
  const wallets = roster.map((row) => row.wallet);
  assert.ok(wallets.includes(WALLET_A));
  assert.ok(wallets.includes(WALLET_B));
  assert.equal(
    roster.every((row) => row.wallet === WALLET_A || row.wallet === WALLET_B),
    true,
  );
});

test('verification stays unverified until a 0G Storage round trip', async () => {
  const record = assessment(WALLET_B, 'ai_risk_assessment');
  insertRecord(record);

  const indexed = getRecordById(record.recordId);
  assert.equal(indexed?.verification.status, 'unverified');
  assert.equal(indexed?.verification.rootHash, null);

  const result = await verifyStoredRecord(record.recordId);
  assert.equal(result.status, 'unverified');
  assert.match(result.detail ?? '', /not been written to 0G Storage/);

  markRecordStored(record.recordId, '0x' + 'ee'.repeat(32), null);
  const pending = getRecordById(record.recordId);
  assert.equal(pending?.verification.status, 'pending');
  assert.notEqual(pending?.verification.status, 'verified');
});
});
