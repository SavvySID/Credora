/**
 * Loan.sol Phase 1 limitations (contract is used as-is; do not paper over these):
 * - Events have no loanId. The indexer synthesises keccak256(borrower, txHash, logIndex).
 * - One loan per borrower. Repayments are correlated to the open loan for that address.
 * - LoanDefaulted is declared but never emitted. Overdue is derived from dueTime.
 * - There is no extension, lender role, or fund disbursement. requestLoan
 *   records accounting principal only; the 0.5 0G msg.value is an origination deposit.
 * These belong in a later contract revision, not this indexer.
 */
import { Interface, type Log } from 'ethers';
import { config } from '../config';
import { LOAN_ABI } from './abi';
import { getLoanContract, getProvider } from './provider';
import { createLogger } from '../logger';

const log = createLogger('chain:loanEvents');

const iface = new Interface(LOAN_ABI as unknown as string[]);

export const LOAN_EVENT_NAMES = [
  'LoanRequested',
  'LoanApproved',
  'LoanRepaid',
  'LoanDefaulted',
] as const;

export type LoanEventName = (typeof LOAN_EVENT_NAMES)[number];

const TOPIC_BY_NAME = new Map<string, LoanEventName>(
  LOAN_EVENT_NAMES.map((name) => [iface.getEvent(name)!.topicHash, name]),
);

const ALL_TOPICS = [...TOPIC_BY_NAME.keys()];

export interface DecodedLoanEvent {
  eventName: LoanEventName;
  borrower: string;
  amountWei: bigint;
  /** Only LoanRepaid carries interest. */
  interestWei: bigint | null;
  /** block.timestamp as emitted by the contract, in seconds. */
  contractTimestamp: bigint;
  blockNumber: number;
  logIndex: number;
  txHash: string;
}

function decode(entry: Log): DecodedLoanEvent | null {
  const eventName = TOPIC_BY_NAME.get(entry.topics[0] ?? '');
  if (!eventName) return null;

  const parsed = iface.parseLog({ topics: [...entry.topics], data: entry.data });
  if (!parsed) return null;

  return {
    eventName,
    borrower: (parsed.args.borrower as string).toLowerCase(),
    amountWei: parsed.args.amount as bigint,
    interestWei: eventName === 'LoanRepaid' ? (parsed.args.interest as bigint) : null,
    contractTimestamp: parsed.args.timestamp as bigint,
    blockNumber: entry.blockNumber,
    logIndex: entry.index,
    txHash: entry.transactionHash,
  };
}

export interface ScanResult {
  events: DecodedLoanEvent[];
  fromBlock: number;
  toBlock: number;
}

/**
 * Reads Loan.sol logs for a bounded block window.
 * Throws on RPC failure - the caller must not advance its cursor on error.
 */
export async function scanLoanEvents(fromBlock: number, toBlock: number): Promise<ScanResult> {
  const resolved = getLoanContract();
  if (!resolved) {
    throw new Error('Loan contract is not deployed or configured');
  }

  if (toBlock < fromBlock) {
    return { events: [], fromBlock, toBlock };
  }

  const logs = await getProvider().getLogs({
    address: resolved.address,
    fromBlock,
    toBlock,
    topics: [ALL_TOPICS],
  });

  const events = logs
    .map(decode)
    .filter((entry): entry is DecodedLoanEvent => entry !== null)
    .sort((a, b) => a.blockNumber - b.blockNumber || a.logIndex - b.logIndex);

  if (events.length > 0) {
    log.info(`Decoded ${events.length} loan event(s) in blocks ${fromBlock}-${toBlock}`);
  }

  return { events, fromBlock, toBlock };
}

/** Splits a large catch-up range into RPC-friendly windows. */
export function planScanWindows(fromBlock: number, headBlock: number): Array<[number, number]> {
  const safeHead = headBlock - config.chain.confirmations;
  if (safeHead < fromBlock) return [];

  const windows: Array<[number, number]> = [];
  for (let start = fromBlock; start <= safeHead; start += config.chain.logRange) {
    windows.push([start, Math.min(start + config.chain.logRange - 1, safeHead)]);
  }
  return windows;
}

/**
 * Live on-chain loan state for a borrower. This is authoritative - the SQLite
 * index is only a cache of past events.
 */
export interface OnChainLoanState {
  exists: boolean;
  state: number;
  amountWei: bigint;
  interestRateBps: number;
  startTime: bigint;
  dueTime: bigint;
}

export async function readLoanState(borrower: string): Promise<OnChainLoanState | null> {
  const resolved = getLoanContract();
  if (!resolved) return null;

  const info = await resolved.contract.getLoanInfo(borrower);

  return {
    exists: Boolean(info.exists),
    state: Number(info.state),
    amountWei: info.amount as bigint,
    // Loan.sol stores INTEREST_RATE as whole percent (5 == 5%).
    interestRateBps: Number(info.interestRate) * 100,
    startTime: info.startTime as bigint,
    dueTime: info.dueTime as bigint,
  };
}
