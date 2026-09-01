import { contentHash } from '../records/canonical';

/**
 * Fields that identify the borrower state used for scoring and AI risk.
 * Wall-clock (`fetchedAt`) is excluded so identical chain state hashes the same.
 */
export interface HashableFeatures {
  wallet: string;
  chainId: number;
  balanceWei: string;
  transactionCount: number;
  observedTransactions: number;
  firstSeen: string | null;
  lastActivity: string | null;
  repayment: {
    total: number;
    repaid: number;
    active: number;
    defaulted: number;
    overdue: number;
    repaymentRate: number | null;
  };
  outstandingWei: string;
  overdue: boolean;
  activeLoanCount: number;
  repaidLoanCount: number;
  txMix: {
    inbound: number;
    outbound: number;
    self: number;
  };
  degraded: boolean;
}

export function sourceDataHash(features: HashableFeatures): string {
  return contentHash({
    wallet: features.wallet.toLowerCase(),
    chainId: features.chainId,
    balanceWei: features.balanceWei,
    transactionCount: features.transactionCount,
    observedTransactions: features.observedTransactions,
    firstSeen: features.firstSeen,
    lastActivity: features.lastActivity,
    repayment: features.repayment,
    outstandingWei: features.outstandingWei,
    overdue: features.overdue,
    activeLoanCount: features.activeLoanCount,
    repaidLoanCount: features.repaidLoanCount,
    txMix: features.txMix,
    degraded: features.degraded,
  });
}

export function assessmentCacheKey(
  wallet: string,
  hash: string,
  eventType: string,
  model: string,
): string {
  return `${wallet.toLowerCase()}:${hash}:${eventType}:${model}`;
}
