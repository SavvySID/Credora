import { keccak256, solidityPacked } from 'ethers';
import { config } from '../config';
import type { DecodedLoanEvent } from '../chain/loanEvents';
import { getLoanContract } from '../chain/provider';
import { streamBus } from '../events/bus';
import { createLogger } from '../logger';
import { buildStoredRecord, type CredoraRecordBody, type StoredCredoraRecord } from '../records/schema';
import { OgBlockedError, uploadRecord } from '../og/storage';
import {
  findOpenLoan,
  getRecordById,
  insertRecord,
  listPendingWrites,
  markRecordStored,
  markWriteFailure,
  upsertLoan,
  type LoanIndexRow,
} from '../store/repositories';
import { UNVERIFIED, type CredoraEventType, type CredoraRecord, type RecordSource } from '../records/schema';
import { verifyStoredRecord } from './verifyService';

const log = createLogger('service:records');

const EVENT_TYPE_MAP = {
  LoanRequested: 'loan_requested',
  LoanApproved: 'loan_approved',
  LoanRepaid: 'loan_repaid',
  LoanDefaulted: 'loan_defaulted',
} as const;

/**
 * Loan.sol does not emit a loan id, so one is derived deterministically from
 * the origination log. Re-indexing the same chain always yields the same id.
 * A real on-chain id belongs in the next contract revision.
 */
export function deriveLoanId(borrower: string, txHash: string, logIndex: number): string {
  return keccak256(solidityPacked(['address', 'bytes32', 'uint256'], [borrower, txHash, logIndex]));
}

function isoFromSeconds(seconds: bigint): string {
  return new Date(Number(seconds) * 1000).toISOString();
}

/** Loan.sol INTEREST_RATE is a whole percent (5 == 5%). */
function interestOn(amountWei: bigint): bigint {
  return (amountWei * 5n) / 100n;
}

/**
 * Loan.sol deletes storage before emitting LoanRepaid, so the log often
 * carries amount=0 / interest=0. Prefer the open indexed loan (chain-origin
 * accounting data) over the broken event fields. Never invent a principal.
 */
function repaymentAccounting(event: DecodedLoanEvent): {
  amountWei: bigint;
  interestWei: bigint | null;
} {
  if (event.eventName !== 'LoanRepaid') {
    return { amountWei: event.amountWei, interestWei: event.interestWei };
  }

  const open = findOpenLoan(event.borrower);
  const amountWei = event.amountWei > 0n ? event.amountWei : open ? BigInt(open.amountWei) : 0n;
  const interestWei =
    event.interestWei !== null && event.interestWei > 0n
      ? event.interestWei
      : amountWei > 0n
        ? interestOn(amountWei)
        : event.interestWei;

  return { amountWei, interestWei };
}

/**
 * Maps a decoded log to a Credora record.
 *
 * LoanRepaid carries no loan id, so it is correlated to the borrower's open
 * loan. Loan.sol permits only one loan per address at a time, which makes the
 * correlation unambiguous for the current contract.
 */
export function recordFromLoanEvent(event: DecodedLoanEvent): StoredCredoraRecord {
  const eventType = EVENT_TYPE_MAP[event.eventName];
  const timestamp = isoFromSeconds(event.contractTimestamp);
  const accounting = repaymentAccounting(event);
  const contractAddress = getLoanContract()?.address ?? null;

  let loanId: string | null = null;

  if (event.eventName === 'LoanApproved') {
    loanId = deriveLoanId(event.borrower, event.txHash, event.logIndex);
  } else if (event.eventName === 'LoanRepaid' || event.eventName === 'LoanDefaulted') {
    loanId = findOpenLoan(event.borrower)?.loanId ?? null;
  }

  const body: CredoraRecordBody = {
    schemaVersion: 1,
    wallet: event.borrower,
    eventType,
    loanId,
    txHash: event.txHash,
    blockNumber: event.blockNumber,
    logIndex: event.logIndex,
    timestamp,
    chainId: config.chain.chainId,
    source: 'chain',
    values: {
      amountWei: accounting.amountWei.toString(),
      ...(accounting.interestWei !== null
        ? {
            interestWei: accounting.interestWei.toString(),
            totalRepaymentWei: (accounting.amountWei + accounting.interestWei).toString(),
          }
        : {}),
    },
    meta: {
      contract: 'Loan',
      event: event.eventName,
      ...(contractAddress ? { contractAddress } : {}),
    },
  };

  return buildStoredRecord(body);
}

/** Keeps the derived loans table in step with the events just ingested. */
function applyLoanProjection(event: DecodedLoanEvent, record: StoredCredoraRecord): void {
  if (event.eventName === 'LoanApproved' && record.loanId) {
    const createdAt = isoFromSeconds(event.contractTimestamp);
    // LOAN_DURATION is a 30 day constant in Loan.sol.
    const dueAt = new Date(new Date(createdAt).getTime() + 30 * 86_400_000).toISOString();

    const loan: LoanIndexRow = {
      loanId: record.loanId,
      wallet: event.borrower,
      amountWei: event.amountWei.toString(),
      interestRateBps: 500,
      status: 'active',
      originTxHash: event.txHash,
      originBlock: event.blockNumber,
      createdAt,
      dueAt,
      repaidAt: null,
      repaidTxHash: null,
      interestWei: null,
    };

    upsertLoan(loan);
    return;
  }

  if (event.eventName === 'LoanRepaid' && record.loanId) {
    const existing = findOpenLoan(event.borrower);
    if (!existing) return;

    const interestWei =
      event.interestWei !== null && event.interestWei > 0n
        ? event.interestWei.toString()
        : interestOn(BigInt(existing.amountWei)).toString();

    upsertLoan({
      ...existing,
      status: 'repaid',
      repaidAt: isoFromSeconds(event.contractTimestamp),
      repaidTxHash: event.txHash,
      interestWei,
    });
    return;
  }

  if (event.eventName === 'LoanDefaulted' && record.loanId) {
    const existing = findOpenLoan(event.borrower);
    if (existing) upsertLoan({ ...existing, status: 'defaulted' });
  }
}

export interface IngestSummary {
  seen: number;
  inserted: number;
}

export function ingestLoanEvents(events: DecodedLoanEvent[]): IngestSummary {
  let inserted = 0;

  for (const event of events) {
    const record = recordFromLoanEvent(event);

    if (insertRecord(record)) {
      inserted += 1;
      applyLoanProjection(event, record);
      streamBus.publishRecord({ ...record, verification: {
        status: 'unverified',
        rootHash: null,
        storageTxHash: null,
        verifiedAt: null,
        detail: null,
      } });
    }
  }

  return { seen: events.length, inserted };
}

/**
 * Records a deterministic or AI assessment.
 * `source` must be `derived` for credit_assessment and `compute` for ai_risk_assessment.
 */
export function ingestCreditAssessment(input: {
  wallet: string;
  creditScore?: number;
  riskLevel?: 'Low' | 'Medium' | 'High';
  confidence: number;
  model: string;
  methodology: string;
  timestamp?: string;
  eventType?: 'credit_assessment' | 'ai_risk_assessment';
  source?: RecordSource;
  sourceDataHash?: string;
  deterministicScore?: number;
  aiRiskScore?: number;
  aiRiskLevel?: 'Low' | 'Medium' | 'High';
  riskFactors?: string[];
  positiveFactors?: string[];
  assessmentSummary?: string;
  modelVersion?: string;
  analysisType?:
    | 'general'
    | 'borrower-risk'
    | 'repayment-behavior'
    | 'liquidity'
    | 'wallet-activity'
    | 'risk-outlook';
  analysisLabel?: string;
  riskOutlook?: 'Improving' | 'Stable' | 'Deteriorating' | 'Insufficient Data';
}): CredoraRecord {
  const eventType: CredoraEventType = input.eventType ?? 'credit_assessment';
  const source: RecordSource =
    input.source ?? (eventType === 'ai_risk_assessment' ? 'compute' : 'derived');

  const record = buildStoredRecord({
    schemaVersion: 1,
    wallet: input.wallet.toLowerCase(),
    eventType,
    loanId: null,
    txHash: null,
    blockNumber: null,
    logIndex: null,
    timestamp: input.timestamp ?? new Date().toISOString(),
    chainId: config.chain.chainId,
    source,
    values: {
      ...(input.creditScore !== undefined ? { creditScore: input.creditScore } : {}),
      ...(input.riskLevel !== undefined ? { riskLevel: input.riskLevel } : {}),
      confidence: input.confidence,
      ...(input.deterministicScore !== undefined
        ? { deterministicScore: input.deterministicScore }
        : {}),
      ...(input.aiRiskScore !== undefined ? { aiRiskScore: input.aiRiskScore } : {}),
      ...(input.aiRiskLevel !== undefined ? { aiRiskLevel: input.aiRiskLevel } : {}),
      ...(input.sourceDataHash ? { sourceDataHash: input.sourceDataHash } : {}),
      ...(input.riskFactors ? { riskFactors: input.riskFactors } : {}),
      ...(input.positiveFactors ? { positiveFactors: input.positiveFactors } : {}),
      ...(input.assessmentSummary ? { assessmentSummary: input.assessmentSummary } : {}),
      ...(input.modelVersion ? { modelVersion: input.modelVersion } : {}),
      ...(input.analysisType ? { analysisType: input.analysisType } : {}),
      ...(input.analysisLabel ? { analysisLabel: input.analysisLabel } : {}),
      ...(input.riskOutlook ? { riskOutlook: input.riskOutlook } : {}),
    },
    meta: {
      model: input.model,
      methodology: input.methodology,
      ...(input.modelVersion ? { modelVersion: input.modelVersion } : {}),
    },
  });

  insertRecord(record);

  const published: CredoraRecord = {
    ...record,
    verification: { ...UNVERIFIED },
  };
  streamBus.publishRecord(published);
  return getRecordById(record.recordId) ?? published;
}

export interface FlushSummary {
  attempted: number;
  stored: number;
  verified: number;
  failed: number;
  blocked: boolean;
  blockedReason: string | null;
}

/**
 * Persists indexed records to 0G Storage, then immediately reads each one back
 * and verifies it. A record is only marked verified after a real round trip.
 */
export async function flushPendingWrites(limit = 10): Promise<FlushSummary> {
  const pending = listPendingWrites(limit);
  const summary: FlushSummary = {
    attempted: pending.length,
    stored: 0,
    verified: 0,
    failed: 0,
    blocked: false,
    blockedReason: null,
  };

  for (const pendingRecord of pending) {
    const { verification: _verification, ...document } = pendingRecord;

    try {
      const outcome = await uploadRecord(document as StoredCredoraRecord);
      markRecordStored(document.recordId, outcome.rootHash, outcome.storageTxHash);
      summary.stored += 1;

      const result = await verifyStoredRecord(document.recordId);
      if (result.status === 'verified') summary.verified += 1;

      const refreshed = getRecordById(document.recordId);
      if (refreshed) streamBus.publishRecord(refreshed);
    } catch (error) {
      if (error instanceof OgBlockedError) {
        // No funded signer: stop the batch rather than burn retry attempts.
        summary.blocked = true;
        summary.blockedReason = error.message;
        log.warn('0G Storage writes are BLOCKED', error.message);
        break;
      }

      summary.failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      markWriteFailure(document.recordId, message);
      log.error(`Failed to persist record ${document.recordId}`, message);
    }
  }

  return summary;
}
