import { readLoanState } from '../chain/loanEvents';
import { getLoanContract } from '../chain/provider';
import { listLoansByWallet, upsertLoan, type LoanIndexRow } from '../store/repositories';
import { createLogger } from '../logger';

const log = createLogger('service:loans');

export interface LoanView extends LoanIndexRow {
  /** True when the index row was confirmed against live contract state. */
  reconciled: boolean;
  overdue: boolean;
}

/**
 * Loans for a wallet.
 *
 * The SQLite rows are a projection of past events; live contract state wins on
 * any disagreement. Loan.sol keeps at most one loan per borrower, so the open
 * row is the only one that can drift, and it is reconciled on every read.
 */
export async function getLoansForWallet(wallet: string): Promise<{
  loans: LoanView[];
  reconciled: boolean;
  reason: string | null;
}> {
  const indexed = listLoansByWallet(wallet);

  if (!getLoanContract()) {
    return {
      loans: indexed.map((loan) => ({ ...loan, reconciled: false, overdue: isOverdue(loan) })),
      reconciled: false,
      reason: 'Loan contract is not deployed or configured',
    };
  }

  let onChain: Awaited<ReturnType<typeof readLoanState>> = null;

  try {
    onChain = await readLoanState(wallet);
  } catch (error) {
    log.warn(`Could not read on-chain loan state for ${wallet}`, error);
    return {
      loans: indexed.map((loan) => ({ ...loan, reconciled: false, overdue: isOverdue(loan) })),
      reconciled: false,
      reason: error instanceof Error ? error.message : String(error),
    };
  }

  const openRow = indexed.find((loan) => loan.status === 'active') ?? null;

  // Contract says the loan is gone but the index still shows it open: the
  // settlement event has not been indexed yet. Trust the chain.
  if (openRow && (!onChain || !onChain.exists)) {
    const corrected: LoanIndexRow = { ...openRow, status: 'repaid' };
    upsertLoan(corrected);
    const position = indexed.indexOf(openRow);
    indexed[position] = corrected;
  }

  // When the loan is still active on-chain, prefer getLoanInfo for amount,
  // rate, and dueTime rather than the hardcoded 30-day projection.
  if (openRow && onChain && onChain.exists) {
    const dueAt = new Date(Number(onChain.dueTime) * 1000).toISOString();
    const reconciledRow: LoanIndexRow = {
      ...openRow,
      amountWei: onChain.amountWei.toString(),
      interestRateBps: onChain.interestRateBps,
      dueAt,
    };
    if (
      reconciledRow.amountWei !== openRow.amountWei ||
      reconciledRow.interestRateBps !== openRow.interestRateBps ||
      reconciledRow.dueAt !== openRow.dueAt
    ) {
      upsertLoan(reconciledRow);
      const position = indexed.indexOf(openRow);
      indexed[position] = reconciledRow;
    }
  }

  return {
    loans: indexed.map((loan) => ({ ...loan, reconciled: true, overdue: isOverdue(loan) })),
    reconciled: true,
    reason: null,
  };
}

function isOverdue(loan: LoanIndexRow): boolean {
  if (loan.status !== 'active' || !loan.dueAt) return false;
  return new Date(loan.dueAt).getTime() < Date.now();
}

/**
 * Repayment behaviour used as a credit scoring feature.
 * Derived purely from indexed on-chain events.
 */
export function getRepaymentStats(wallet: string): {
  total: number;
  repaid: number;
  active: number;
  defaulted: number;
  overdue: number;
  repaymentRate: number | null;
} {
  const loans = listLoansByWallet(wallet);

  const repaid = loans.filter((loan) => loan.status === 'repaid').length;
  const active = loans.filter((loan) => loan.status === 'active').length;
  const defaulted = loans.filter((loan) => loan.status === 'defaulted').length;
  const overdue = loans.filter(isOverdue).length;
  const settled = repaid + defaulted;

  return {
    total: loans.length,
    repaid,
    active,
    defaulted,
    overdue,
    repaymentRate: settled === 0 ? null : repaid / settled,
  };
}
