import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assessmentCacheKey, sourceDataHash, type HashableFeatures } from './sourceHash';

const base: HashableFeatures = {
  wallet: '0xA059C12E1cF7E24311C035E76f90d9b16801095f',
  chainId: 16602,
  balanceWei: '581167763023116706',
  transactionCount: 14,
  observedTransactions: 16,
  firstSeen: '2026-09-01T04:52:20.000Z',
  lastActivity: '2026-09-01T07:58:44.000Z',
  repayment: {
    total: 0,
    repaid: 0,
    active: 0,
    defaulted: 0,
    overdue: 0,
    repaymentRate: null,
  },
  outstandingWei: '0',
  overdue: false,
  activeLoanCount: 0,
  repaidLoanCount: 0,
  txMix: { inbound: 2, outbound: 14, self: 0 },
  degraded: false,
};

test('sourceDataHash is stable for identical features', () => {
  const a = sourceDataHash(base);
  const b = sourceDataHash({ ...base });
  assert.equal(a, b);
  assert.match(a, /^0x[0-9a-f]{64}$/);
});

test('sourceDataHash is case-insensitive on wallet', () => {
  const mixed = sourceDataHash(base);
  const lower = sourceDataHash({ ...base, wallet: base.wallet.toLowerCase() });
  assert.equal(mixed, lower);
});

test('sourceDataHash changes when balance changes', () => {
  const original = sourceDataHash(base);
  const changed = sourceDataHash({ ...base, balanceWei: '681167763023116706' });
  assert.notEqual(original, changed);
});

test('assessmentCacheKey isolates wallets and hashes', () => {
  const hashA = sourceDataHash(base);
  const hashB = sourceDataHash({ ...base, balanceWei: '681167763023116706' });
  const walletA = base.wallet;
  const walletB = '0xb059c12e1cf7e24311c035e76f90d9b16801095f';

  const a = assessmentCacheKey(walletA, hashA, 'ai_risk_assessment', 'demo@router');
  const aAgain = assessmentCacheKey(walletA.toLowerCase(), hashA, 'ai_risk_assessment', 'demo@router');
  const otherWallet = assessmentCacheKey(walletB, hashA, 'ai_risk_assessment', 'demo@router');
  const otherHash = assessmentCacheKey(walletA, hashB, 'ai_risk_assessment', 'demo@router');

  assert.equal(a, aAgain);
  assert.notEqual(a, otherWallet);
  assert.notEqual(a, otherHash);
  assert.notEqual(hashA, hashB);

  const general = assessmentCacheKey(walletA, hashA, 'ai_risk_assessment', 'demo@router');
  const repayment = assessmentCacheKey(
    walletA,
    hashA,
    'ai_risk_assessment',
    'demo@router:repayment-behavior',
  );
  assert.notEqual(general, repayment);
});
