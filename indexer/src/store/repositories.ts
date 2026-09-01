import { config } from '../config';
import { getDb } from './db';
import {
  UNVERIFIED,
  type CredoraEventType,
  type CredoraRecord,
  type RecordVerification,
  type StoredCredoraRecord,
  type VerificationStatus,
} from '../records/schema';
import type { WalletSnapshot } from '../chain/walletActivity';

interface RecordRow {
  record_id: string;
  wallet: string;
  event_type: string;
  loan_id: string | null;
  tx_hash: string | null;
  block_number: number | null;
  log_index: number | null;
  timestamp: string;
  chain_id: number;
  source: string;
  document: string;
  root_hash: string | null;
  storage_tx_hash: string | null;
  verification_status: string;
  verification_detail: string | null;
  verified_at: string | null;
  write_attempts: number;
  last_write_error: string | null;
}

function toRecord(row: RecordRow): CredoraRecord {
  const document = JSON.parse(row.document) as StoredCredoraRecord;

  const verification: RecordVerification = {
    status: row.verification_status as VerificationStatus,
    rootHash: row.root_hash,
    storageTxHash: row.storage_tx_hash,
    verifiedAt: row.verified_at,
    detail: row.verification_detail,
  };

  return { ...document, verification };
}

/**
 * Inserts a record if it is new. Chain events are deduplicated on
 * (tx_hash, log_index) so a re-scan after a restart is idempotent.
 * Returns true when a new row was created.
 */
export function insertRecord(record: StoredCredoraRecord): boolean {
  const result = getDb()
    .prepare(
      `INSERT INTO records (
         record_id, wallet, event_type, loan_id, tx_hash, block_number, log_index,
         timestamp, chain_id, source, document, verification_status, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(record_id) DO NOTHING`,
    )
    .run(
      record.recordId,
      record.wallet.toLowerCase(),
      record.eventType,
      record.loanId,
      record.txHash,
      record.blockNumber,
      record.logIndex,
      record.timestamp,
      record.chainId,
      record.source,
      JSON.stringify(record),
      UNVERIFIED.status,
      new Date().toISOString(),
    );

  return Number(result.changes) > 0;
}

export function markRecordStored(
  recordId: string,
  rootHash: string,
  storageTxHash: string | null,
): void {
  getDb()
    .prepare(
      `UPDATE records
          SET root_hash = ?, storage_tx_hash = ?, verification_status = 'pending',
              last_write_error = NULL
        WHERE record_id = ?`,
    )
    .run(rootHash, storageTxHash, recordId);
}

export function markRecordVerification(
  recordId: string,
  status: VerificationStatus,
  detail: string | null,
): void {
  getDb()
    .prepare(
      `UPDATE records
          SET verification_status = ?, verification_detail = ?, verified_at = ?
        WHERE record_id = ?`,
    )
    .run(status, detail, status === 'verified' ? new Date().toISOString() : null, recordId);
}

export function markWriteFailure(recordId: string, error: string): void {
  getDb()
    .prepare(
      `UPDATE records
          SET write_attempts = write_attempts + 1, last_write_error = ?
        WHERE record_id = ?`,
    )
    .run(error, recordId);
}

/** Records observed on-chain but not yet persisted to 0G Storage. */
export function listPendingWrites(limit = 25, maxAttempts = 5): CredoraRecord[] {
  const rows = getDb()
    .prepare(
      `SELECT * FROM records
        WHERE root_hash IS NULL AND write_attempts < ?
        ORDER BY timestamp ASC
        LIMIT ?`,
    )
    .all(maxAttempts, limit) as unknown as RecordRow[];

  return rows.map(toRecord);
}

export interface ListRecordsOptions {
  eventTypes?: CredoraEventType[];
  limit?: number;
  before?: string;
}

export function listRecordsByWallet(
  wallet: string,
  options: ListRecordsOptions = {},
): CredoraRecord[] {
  const { eventTypes, limit = 100, before } = options;

  const clauses = ['wallet = ?'];
  const params: Array<string | number> = [wallet.toLowerCase()];

  if (eventTypes && eventTypes.length > 0) {
    clauses.push(`event_type IN (${eventTypes.map(() => '?').join(',')})`);
    params.push(...eventTypes);
  }

  if (before) {
    clauses.push('timestamp < ?');
    params.push(before);
  }

  params.push(limit);

  const rows = getDb()
    .prepare(
      `SELECT * FROM records
        WHERE ${clauses.join(' AND ')}
        ORDER BY timestamp DESC
        LIMIT ?`,
    )
    .all(...params) as unknown as RecordRow[];

  return rows.map(toRecord);
}

export function getRecordById(recordId: string): CredoraRecord | null {
  const row = getDb().prepare('SELECT * FROM records WHERE record_id = ?').get(recordId) as
    | RecordRow
    | undefined;
  return row ? toRecord(row) : null;
}

export function getRecordByRootHash(rootHash: string): CredoraRecord | null {
  const row = getDb().prepare('SELECT * FROM records WHERE root_hash = ?').get(rootHash) as
    | RecordRow
    | undefined;
  return row ? toRecord(row) : null;
}

export function countRecords(): { total: number; stored: number; verified: number } {
  const row = getDb()
    .prepare(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN root_hash IS NOT NULL THEN 1 ELSE 0 END) AS stored,
         SUM(CASE WHEN verification_status = 'verified' THEN 1 ELSE 0 END) AS verified
       FROM records`,
    )
    .get() as { total: number; stored: number | null; verified: number | null };

  return {
    total: Number(row.total ?? 0),
    stored: Number(row.stored ?? 0),
    verified: Number(row.verified ?? 0),
  };
}

/* ---------------------------------------------------------------- wallet cache */

export function readWalletCache(wallet: string): WalletSnapshot | null {
  const row = getDb()
    .prepare('SELECT snapshot, fetched_at FROM wallet_cache WHERE wallet = ?')
    .get(wallet.toLowerCase()) as { snapshot: string; fetched_at: number } | undefined;

  if (!row) return null;
  if (Date.now() - row.fetched_at > config.store.walletActivityTtlMs) return null;

  return JSON.parse(row.snapshot) as WalletSnapshot;
}

export function writeWalletCache(snapshot: WalletSnapshot): void {
  getDb()
    .prepare(
      `INSERT INTO wallet_cache (wallet, snapshot, fetched_at) VALUES (?, ?, ?)
       ON CONFLICT(wallet) DO UPDATE SET snapshot = excluded.snapshot, fetched_at = excluded.fetched_at`,
    )
    .run(snapshot.address.toLowerCase(), JSON.stringify(snapshot), Date.now());
}

/* ---------------------------------------------------------------------- loans */

export interface LoanIndexRow {
  loanId: string;
  wallet: string;
  amountWei: string;
  interestRateBps: number;
  status: 'active' | 'repaid' | 'defaulted';
  originTxHash: string | null;
  originBlock: number | null;
  createdAt: string;
  dueAt: string | null;
  repaidAt: string | null;
  repaidTxHash: string | null;
  interestWei: string | null;
}

interface LoanRow {
  loan_id: string;
  wallet: string;
  amount_wei: string;
  interest_rate_bps: number;
  status: string;
  origin_tx_hash: string | null;
  origin_block: number | null;
  created_at: string;
  due_at: string | null;
  repaid_at: string | null;
  repaid_tx_hash: string | null;
  interest_wei: string | null;
}

function toLoan(row: LoanRow): LoanIndexRow {
  return {
    loanId: row.loan_id,
    wallet: row.wallet,
    amountWei: row.amount_wei,
    interestRateBps: row.interest_rate_bps,
    status: row.status as LoanIndexRow['status'],
    originTxHash: row.origin_tx_hash,
    originBlock: row.origin_block,
    createdAt: row.created_at,
    dueAt: row.due_at,
    repaidAt: row.repaid_at,
    repaidTxHash: row.repaid_tx_hash,
    interestWei: row.interest_wei,
  };
}

export function upsertLoan(loan: LoanIndexRow): void {
  getDb()
    .prepare(
      `INSERT INTO loans (
         loan_id, wallet, amount_wei, interest_rate_bps, status,
         origin_tx_hash, origin_block, created_at, due_at, repaid_at, repaid_tx_hash, interest_wei
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(loan_id) DO UPDATE SET
         status = excluded.status,
         due_at = COALESCE(excluded.due_at, loans.due_at),
         repaid_at = COALESCE(excluded.repaid_at, loans.repaid_at),
         repaid_tx_hash = COALESCE(excluded.repaid_tx_hash, loans.repaid_tx_hash),
         interest_wei = COALESCE(excluded.interest_wei, loans.interest_wei)`,
    )
    .run(
      loan.loanId,
      loan.wallet.toLowerCase(),
      loan.amountWei,
      loan.interestRateBps,
      loan.status,
      loan.originTxHash,
      loan.originBlock,
      loan.createdAt,
      loan.dueAt,
      loan.repaidAt,
      loan.repaidTxHash,
      loan.interestWei,
    );
}

export function listLoansByWallet(wallet: string): LoanIndexRow[] {
  const rows = getDb()
    .prepare('SELECT * FROM loans WHERE wallet = ? ORDER BY created_at DESC')
    .all(wallet.toLowerCase()) as unknown as LoanRow[];
  return rows.map(toLoan);
}

export function getLoanById(loanId: string): LoanIndexRow | null {
  const row = getDb().prepare('SELECT * FROM loans WHERE loan_id = ?').get(loanId) as
    | LoanRow
    | undefined;
  return row ? toLoan(row) : null;
}

/** The borrower's currently open loan, used to correlate a LoanRepaid event. */
export function findOpenLoan(wallet: string): LoanIndexRow | null {
  const row = getDb()
    .prepare(
      `SELECT * FROM loans WHERE wallet = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1`,
    )
    .get(wallet.toLowerCase()) as LoanRow | undefined;
  return row ? toLoan(row) : null;
}

export function listAllLoans(): LoanIndexRow[] {
  const rows = getDb()
    .prepare('SELECT * FROM loans ORDER BY created_at DESC')
    .all() as unknown as LoanRow[];
  return rows.map(toLoan);
}

export function countVerifiedRecordsForWallet(wallet: string): number {
  const row = getDb()
    .prepare(
      `SELECT COUNT(*) AS n FROM records WHERE wallet = ? AND verification_status = 'verified'`,
    )
    .get(wallet.toLowerCase()) as { n: number };
  return Number(row.n ?? 0);
}

export function latestAssessmentForWallet(
  wallet: string,
  eventType: CredoraEventType,
): CredoraRecord | null {
  const row = getDb()
    .prepare(
      `SELECT * FROM records
        WHERE wallet = ? AND event_type = ?
        ORDER BY timestamp DESC
        LIMIT 1`,
    )
    .get(wallet.toLowerCase(), eventType) as RecordRow | undefined;
  return row ? toRecord(row) : null;
}

/* ---------------------------------------------------------- assessment cache */

export interface AssessmentCacheRow {
  cacheKey: string;
  wallet: string;
  sourceDataHash: string;
  eventType: string;
  model: string;
  recordId: string;
  createdAt: string;
}

export function getAssessmentCache(cacheKey: string): AssessmentCacheRow | null {
  const row = getDb()
    .prepare(
      `SELECT cache_key, wallet, source_data_hash, event_type, model, record_id, created_at
         FROM assessment_cache WHERE cache_key = ?`,
    )
    .get(cacheKey) as
    | {
        cache_key: string;
        wallet: string;
        source_data_hash: string;
        event_type: string;
        model: string;
        record_id: string;
        created_at: string;
      }
    | undefined;

  if (!row) return null;
  return {
    cacheKey: row.cache_key,
    wallet: row.wallet,
    sourceDataHash: row.source_data_hash,
    eventType: row.event_type,
    model: row.model,
    recordId: row.record_id,
    createdAt: row.created_at,
  };
}

export function putAssessmentCache(row: AssessmentCacheRow): void {
  getDb()
    .prepare(
      `INSERT INTO assessment_cache (
         cache_key, wallet, source_data_hash, event_type, model, record_id, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(cache_key) DO UPDATE SET
         record_id = excluded.record_id,
         created_at = excluded.created_at`,
    )
    .run(
      row.cacheKey,
      row.wallet.toLowerCase(),
      row.sourceDataHash,
      row.eventType,
      row.model,
      row.recordId,
      row.createdAt,
    );
}

export interface IndexedBorrowerRow {
  wallet: string;
  lastDeterministicScore: number | null;
  lastAiRiskScore: number | null;
  lastAiRiskLevel: string | null;
  hasActiveLoan: boolean;
  overdue: boolean;
  latestVerification: VerificationStatus | null;
  lastAssessmentAt: string | null;
}

export function listIndexedBorrowers(limit = 50): IndexedBorrowerRow[] {
  const capped = Math.min(Math.max(limit, 1), 200);
  const wallets = getDb()
    .prepare(
      `SELECT wallet FROM (
         SELECT wallet FROM loans
         UNION
         SELECT wallet FROM records
          WHERE event_type IN ('credit_assessment', 'ai_risk_assessment', 'loan_approved', 'loan_repaid')
       )
       ORDER BY wallet
       LIMIT ?`,
    )
    .all(capped) as Array<{ wallet: string }>;

  return wallets.map((entry) => {
    const credit = latestAssessmentForWallet(entry.wallet, 'credit_assessment');
    const ai = latestAssessmentForWallet(entry.wallet, 'ai_risk_assessment');
    const loans = listLoansByWallet(entry.wallet);
    const active = loans.find((loan) => loan.status === 'active') ?? null;
    const latest = [credit, ai]
      .filter((record): record is CredoraRecord => record !== null)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];

    return {
      wallet: entry.wallet,
      lastDeterministicScore:
        typeof credit?.values.creditScore === 'number' ? credit.values.creditScore : null,
      lastAiRiskScore: typeof ai?.values.aiRiskScore === 'number' ? ai.values.aiRiskScore : null,
      lastAiRiskLevel: typeof ai?.values.aiRiskLevel === 'string' ? ai.values.aiRiskLevel : null,
      hasActiveLoan: active !== null,
      overdue: Boolean(
        active?.dueAt &&
          active.status === 'active' &&
          new Date(active.dueAt).getTime() < Date.now(),
      ),
      latestVerification: latest?.verification.status ?? null,
      lastAssessmentAt: latest?.timestamp ?? null,
    };
  });
}

export interface AnalyticsSummary {
  loans: {
    total: number;
    active: number;
    repaid: number;
    overdue: number;
    defaulted: number;
    repaymentRate: number | null;
  };
  assessments: {
    total: number;
    credit: number;
    ai: number;
    verified: number;
  };
  borrowers: { indexed: number };
  limitations: {
    loanDefaultedUnsupported: true;
    oneLoanPerBorrower: true;
  };
}

function countByEventType(eventType: CredoraEventType): number {
  const row = getDb()
    .prepare('SELECT COUNT(*) AS n FROM records WHERE event_type = ?')
    .get(eventType) as { n: number };
  return Number(row.n ?? 0);
}

export function getAnalyticsSummary(): AnalyticsSummary {
  const loans = listAllLoans();
  const repaid = loans.filter((loan) => loan.status === 'repaid').length;
  const active = loans.filter((loan) => loan.status === 'active').length;
  const defaulted = loans.filter((loan) => loan.status === 'defaulted').length;
  const overdue = loans.filter(
    (loan) =>
      loan.status === 'active' && loan.dueAt !== null && new Date(loan.dueAt).getTime() < Date.now(),
  ).length;
  const settled = repaid + defaulted;

  const credit = countByEventType('credit_assessment');
  const ai = countByEventType('ai_risk_assessment');
  const verifiedRow = getDb()
    .prepare(
      `SELECT COUNT(*) AS n FROM records
        WHERE verification_status = 'verified'
          AND event_type IN ('credit_assessment', 'ai_risk_assessment')`,
    )
    .get() as { n: number };

  const borrowerRow = getDb()
    .prepare(
      `SELECT COUNT(*) AS n FROM (
         SELECT wallet FROM loans
         UNION
         SELECT wallet FROM records
          WHERE event_type IN ('credit_assessment', 'ai_risk_assessment', 'loan_approved', 'loan_repaid')
       )`,
    )
    .get() as { n: number };

  return {
    loans: {
      total: loans.length,
      active,
      repaid,
      overdue,
      defaulted,
      repaymentRate: settled === 0 ? null : repaid / settled,
    },
    assessments: {
      total: credit + ai,
      credit,
      ai,
      verified: Number(verifiedRow.n ?? 0),
    },
    borrowers: { indexed: Number(borrowerRow.n ?? 0) },
    limitations: {
      loanDefaultedUnsupported: true,
      oneLoanPerBorrower: true,
    },
  };
}

export function walletsSharingRecordId(recordId: string): string[] {
  const rows = getDb()
    .prepare('SELECT DISTINCT wallet FROM records WHERE record_id = ?')
    .all(recordId) as Array<{ wallet: string }>;
  return rows.map((row) => row.wallet);
}

