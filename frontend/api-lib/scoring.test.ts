import assert from 'node:assert/strict';
import { test } from 'node:test';
import { creditBandFor, scoreWallet } from './scoring';
import type { FeaturesDto } from './indexer';

const features = (overrides: Partial<FeaturesDto> = {}): FeaturesDto => ({
  wallet: '0xa059c12e1cf7e24311c035e76f90d9b16801095f',
  chainId: 16602,
  balanceWei: '581167763023116706',
  balanceFormatted: '0.581167763023116706',
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
  sourceDataHash: '0x' + 'ab'.repeat(32),
  degraded: false,
  degradedReason: null,
  loanIndexing: { available: true, blockedReason: null },
  fetchedAt: '2026-09-01T12:00:00.000Z',
  ...overrides,
});

test('creditBandFor maps score ranges', () => {
  assert.equal(creditBandFor(0), 'Building');
  assert.equal(creditBandFor(399), 'Building');
  assert.equal(creditBandFor(400), 'Established');
  assert.equal(creditBandFor(700), 'Excellent');
});

test('scoreWallet stays deterministic for identical features', () => {
  const a = scoreWallet(features(), Date.parse('2026-09-01T12:00:00.000Z'));
  const b = scoreWallet(features(), Date.parse('2026-09-01T12:00:00.000Z'));
  assert.equal(a.creditScore, b.creditScore);
  assert.equal(a.creditBand, b.creditBand);
  assert.equal(a.riskLevel, 'Low');
});
