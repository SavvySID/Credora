import {
  decodeEventLog,
  encodePacked,
  formatEther,
  keccak256,
  parseEther,
  type Address,
  type Hash,
  type TransactionReceipt,
} from 'viem';
import { loanAbi } from '@/abi/loan';
import { publicConfig } from '@/services/0g-config';
import { ogGalileo } from '@/config/wagmi';

/** Origination deposit required by Loan.sol `msg.value >= MIN_BALANCE_THRESHOLD`. */
export const ORIGINATION_DEPOSIT_WEI = parseEther('0.5');

/** Remaining wallet balance Loan.sol checks during `requestLoan`. */
export const MIN_REMAINING_BALANCE_WEI = parseEther('0.5');

export type LoanTxPhase =
  | 'idle'
  | 'wallet'
  | 'pending'
  | 'confirmed'
  | 'indexing'
  | 'available'
  | 'failed';

export type LoanTxCode =
  | 'wrong_network'
  | 'wallet_rejected'
  | 'insufficient_funds'
  | 'reverted'
  | 'contract_unavailable'
  | 'indexer_unavailable'
  | 'expired'
  | 'active_loan'
  | 'eligibility'
  | 'not_connected'
  | 'unknown';

export class LoanTxError extends Error {
  readonly code: LoanTxCode;
  readonly txHash: Hash | null;

  constructor(message: string, code: LoanTxCode, txHash: Hash | null = null) {
    super(message);
    this.name = 'LoanTxError';
    this.code = code;
    this.txHash = txHash;
  }
}

export function loanContractAddress(): Address {
  const address = publicConfig.loanContractAddress;
  if (!address) {
    throw new LoanTxError(
      'VITE_LOAN_CONTRACT_ADDRESS is not set. The UI cannot submit a loan.',
      'contract_unavailable',
    );
  }
  return address as Address;
}

export function explorerTxUrl(txHash: string): string {
  return `${publicConfig.explorerUrl}/tx/${txHash}`;
}

export function originationDepositEth(): string {
  return formatEther(ORIGINATION_DEPOSIT_WEI);
}

export function repaymentWei(principalEth: number): bigint {
  const principal = parseEther(principalEth.toFixed(18));
  return principal + (principal * 5n) / 100n;
}

export function deriveLoanId(borrower: Address, txHash: Hash, logIndex: number): Hash {
  return keccak256(
    encodePacked(['address', 'bytes32', 'uint256'], [borrower, txHash, BigInt(logIndex)]),
  );
}

export function loanApprovedFromReceipt(
  receipt: TransactionReceipt,
  borrower: Address,
): { loanId: Hash; logIndex: number } | null {
  const contract = loanContractAddress().toLowerCase();

  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== contract) continue;
    try {
      const decoded = decodeEventLog({
        abi: loanAbi,
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName !== 'LoanApproved') continue;
      const eventBorrower = (decoded.args.borrower as Address).toLowerCase();
      if (eventBorrower !== borrower.toLowerCase()) continue;
      return {
        loanId: deriveLoanId(borrower, receipt.transactionHash, log.logIndex),
        logIndex: log.logIndex,
      };
    } catch {
      continue;
    }
  }

  return null;
}

export function mapWriteError(error: unknown, txHash: Hash | null = null): LoanTxError {
  if (error instanceof LoanTxError) return error;

  const message =
    error instanceof Error
      ? // wagmi/viem surface the revert string in shortMessage when present
        ('shortMessage' in error && typeof error.shortMessage === 'string'
          ? error.shortMessage
          : error.message)
      : String(error);

  const lower = message.toLowerCase();

  if (lower.includes('user rejected') || lower.includes('rejected the request')) {
    return new LoanTxError('Wallet rejected the transaction.', 'wallet_rejected', txHash);
  }
  if (lower.includes('insufficient funds') || lower.includes('insufficient balance')) {
    return new LoanTxError(
      'Wallet does not have enough 0G for the deposit, repayment, and gas.',
      'insufficient_funds',
      txHash,
    );
  }
  if (lower.includes('active loan already exists')) {
    return new LoanTxError(
      'This wallet already has an active loan (one loan per borrower).',
      'active_loan',
      txHash,
    );
  }
  if (lower.includes('eligibility criteria not met')) {
    return new LoanTxError(
      'The loan contract rejected the request. Remaining wallet balance must be at least 0.5 0G, and the on-chain activity counter must be at least 10 (not your wallet nonce).',
      'eligibility',
      txHash,
    );
  }
  if (lower.includes('loan has expired')) {
    return new LoanTxError(
      'The loan contract will not accept repayment after the due date. Overdue loans cannot be settled on this contract.',
      'expired',
      txHash,
    );
  }
  if (lower.includes('insufficient repayment')) {
    return new LoanTxError(
      'Repayment value is below principal plus 5% interest.',
      'reverted',
      txHash,
    );
  }
  if (lower.includes('no active loan')) {
    return new LoanTxError('There is no active loan for this wallet.', 'reverted', txHash);
  }
  if (lower.includes('chain mismatch') || lower.includes('wrong network')) {
    return new LoanTxError(
      `Switch to 0G Galileo (chain ${ogGalileo.id}) before submitting.`,
      'wrong_network',
      txHash,
    );
  }

  return new LoanTxError(message, 'reverted', txHash);
}

export function phaseLabel(phase: LoanTxPhase): string {
  switch (phase) {
    case 'wallet':
      return 'Confirm in wallet…';
    case 'pending':
      return 'Waiting for confirmation…';
    case 'confirmed':
      return 'Transaction confirmed';
    case 'indexing':
      return 'Waiting for indexer…';
    case 'available':
      return 'On-chain loan recorded';
    case 'failed':
      return 'Transaction failed';
    default:
      return 'Submit';
  }
}
