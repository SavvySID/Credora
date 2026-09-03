import type { LendingRecord } from '@/services/0g-storage';

/**
 * Terms mirror the deployed Loan.sol constants and the existing loan request flow.
 * INTEREST_RATE = 5, LOAN_DURATION = 30 days, MIN_BALANCE_THRESHOLD = 0.5 ether.
 * The 0.5 0G attached to requestLoan is an origination deposit, not principal
 * disbursement. The requested amount is accounting data on the contract.
 */
export const LOAN_TERMS = {
  interestRate: 0.05,
  durationDays: 30,
  minBalanceEth: 0.5,
  originationDepositEth: 0.5,
  maxBalanceMultiple: 2,
  processingFee: 0,
  earlyRepaymentPenalty: 0,
} as const;

export type LoanStatus = LendingRecord['status'];

export interface LoanView extends LendingRecord {
  interest: number;
  totalRepayment: number;
  daysRemaining: number;
  progress: number;
  overdue: boolean;
}

export function interestFor(amount: number): number {
  return amount * LOAN_TERMS.interestRate;
}

export function totalRepaymentFor(amount: number): number {
  return amount + interestFor(amount);
}

/**
 * Product guideline only — Loan.sol does not enforce a 2× balance cap.
 * Do not use this as the on-chain approval decision.
 */
export function capacityWarning(amount: number, balance: number): string | null {
  if (!(amount > 0)) return 'Enter an amount greater than zero.';
  if (balance > 0 && amount > balance * LOAN_TERMS.maxBalanceMultiple) {
    return `Requested amount is above ${LOAN_TERMS.maxBalanceMultiple}× wallet balance. This is a Credora guideline, not a contract rule.`;
  }
  return null;
}

/** @deprecated Use contract preflight via useLoanEligibility. Kept for call sites during migration. */
export function evaluateEligibility(amount: number, balance: number) {
  const warning = capacityWarning(amount, balance);
  const reasons: string[] = [];
  if (!(amount > 0)) reasons.push('Enter an amount greater than zero.');
  if (warning && amount > 0) reasons.push(warning);
  return { approved: amount > 0, reasons };
}

export function toLoanView(record: LendingRecord): LoanView {
  const interest = record.amount * record.interestRate;
  const created = new Date(record.createdAt).getTime();
  const due = new Date(record.dueDate).getTime();
  const now = Date.now();

  const span = Math.max(due - created, 1);
  const elapsed = Math.min(Math.max(now - created, 0), span);

  const daysRemaining = Math.ceil((due - now) / 86_400_000);
  const settled = record.status !== 'active';
  const overdue = !settled && due < now;

  return {
    ...record,
    interest,
    totalRepayment: record.amount + interest,
    daysRemaining,
    // A settled or overdue term has fully elapsed, regardless of the raw date span.
    progress: settled || overdue ? 1 : elapsed / span,
    overdue,
  };
}

export function statusLabel(status: LoanStatus, overdue = false): string {
  if (status === 'active') return overdue ? 'Overdue' : 'Active';
  if (status === 'repaid') return 'Repaid';
  return 'Defaulted';
}

export type MilestoneState = 'complete' | 'current' | 'upcoming' | 'missed';

export interface LoanMilestone {
  id: string;
  label: string;
  detail: string;
  date: string;
  amount: number | null;
  state: MilestoneState;
}

/**
 * Loan.sol settles in a single repayment at term end, so the schedule is a real
 * milestone timeline rather than an invented instalment plan.
 */
export function loanTimeline(loan: LoanView): LoanMilestone[] {
  const now = Date.now();
  const due = new Date(loan.dueDate).getTime();
  const repaid = loan.status === 'repaid';

  const milestones: LoanMilestone[] = [
    {
      id: `${loan.loanId}-origination`,
      label: 'Loan originated',
      detail: `${loan.amount} 0G principal recorded on Loan.sol (accounting only — the contract does not send this amount to your wallet)`,
      date: loan.createdAt,
      amount: loan.amount,
      state: 'complete',
    },
    {
      id: `${loan.loanId}-accrual`,
      label: 'Interest accrual',
      detail: `Fixed ${(loan.interestRate * 100).toFixed(0)}% over the ${LOAN_TERMS.durationDays}-day term`,
      date: loan.createdAt,
      amount: loan.interest,
      state: repaid || now >= due ? 'complete' : 'current',
    },
    {
      id: `${loan.loanId}-repayment`,
      label: repaid ? 'Repaid in full' : 'Full repayment due',
      detail: repaid
        ? 'Principal and interest settled'
        : 'Single payment of principal plus interest',
      date: repaid && loan.repaidAt ? loan.repaidAt : loan.dueDate,
      amount: loan.totalRepayment,
      state: repaid ? 'complete' : loan.overdue ? 'missed' : 'upcoming',
    },
  ];

  return milestones;
}
