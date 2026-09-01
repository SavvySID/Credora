import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { config } from '../config';
import { createLogger } from '../logger';

const log = createLogger('store:db');

/**
 * IMPORTANT: this database is a derived index and cache only.
 *
 * Authoritative sources are:
 *   - 0G Chain  for loan state and wallet balances/nonces
 *   - 0G Storage for Credora records (addressed by root hash)
 *
 * Every row here can be rebuilt by replaying chain logs and re-reading 0G
 * Storage. Nothing is written here that does not already exist upstream, and
 * deleting this file must never lose user data.
 */
const SCHEMA = `
CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Mirror of Credora records. root_hash is the 0G Storage address; a row with a
-- NULL root_hash has been observed on-chain but not yet persisted to 0G.
CREATE TABLE IF NOT EXISTS records (
  record_id            TEXT PRIMARY KEY,
  wallet               TEXT NOT NULL,
  event_type           TEXT NOT NULL,
  loan_id              TEXT,
  tx_hash              TEXT,
  block_number         INTEGER,
  log_index            INTEGER,
  timestamp            TEXT NOT NULL,
  chain_id             INTEGER NOT NULL,
  source               TEXT NOT NULL,
  document             TEXT NOT NULL,
  root_hash            TEXT,
  storage_tx_hash      TEXT,
  verification_status  TEXT NOT NULL DEFAULT 'unverified',
  verification_detail  TEXT,
  verified_at          TEXT,
  write_attempts       INTEGER NOT NULL DEFAULT 0,
  last_write_error     TEXT,
  created_at           TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_records_wallet_ts ON records (wallet, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_records_loan      ON records (loan_id);
CREATE INDEX IF NOT EXISTS idx_records_pending   ON records (root_hash) WHERE root_hash IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_records_chain_event
  ON records (tx_hash, log_index) WHERE tx_hash IS NOT NULL AND log_index IS NOT NULL;

-- Cache of wallet snapshots. Always re-fetched once the TTL expires.
CREATE TABLE IF NOT EXISTS wallet_cache (
  wallet     TEXT PRIMARY KEY,
  snapshot   TEXT NOT NULL,
  fetched_at INTEGER NOT NULL
);

-- Derived loan view assembled from indexed events. On-chain state always wins.
CREATE TABLE IF NOT EXISTS loans (
  loan_id           TEXT PRIMARY KEY,
  wallet            TEXT NOT NULL,
  amount_wei        TEXT NOT NULL,
  interest_rate_bps INTEGER NOT NULL,
  status            TEXT NOT NULL,
  origin_tx_hash    TEXT,
  origin_block      INTEGER,
  created_at        TEXT NOT NULL,
  due_at            TEXT,
  repaid_at         TEXT,
  repaid_tx_hash    TEXT,
  interest_wei      TEXT
);

CREATE INDEX IF NOT EXISTS idx_loans_wallet ON loans (wallet, created_at DESC);

-- Derived AI / deterministic assessment reuse. Safe to wipe with the DB.
CREATE TABLE IF NOT EXISTS assessment_cache (
  cache_key         TEXT PRIMARY KEY,
  wallet            TEXT NOT NULL,
  source_data_hash  TEXT NOT NULL,
  event_type        TEXT NOT NULL,
  model             TEXT NOT NULL,
  record_id         TEXT NOT NULL,
  created_at        TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_assessment_cache_wallet ON assessment_cache (wallet, event_type);
`;

let database: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (database) return database;

  const path = resolve(config.store.path);
  mkdirSync(dirname(path), { recursive: true });

  database = new DatabaseSync(path);
  database.exec('PRAGMA journal_mode = WAL;');
  database.exec('PRAGMA foreign_keys = ON;');
  database.exec(SCHEMA);

  log.info(`Index opened at ${path}`);
  return database;
}

export function closeDb(): void {
  database?.close();
  database = null;
}

export function getMeta(key: string): string | null {
  const row = getDb().prepare('SELECT value FROM meta WHERE key = ?').get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

export function setMeta(key: string, value: string): void {
  getDb()
    .prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?')
    .run(key, value, value);
}

const CURSOR_KEY = 'loan_events_cursor_block';

/** Last fully-scanned block. Null until the first successful scan. */
export function getCursor(): number | null {
  const raw = getMeta(CURSOR_KEY);
  if (raw === null) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function setCursor(blockNumber: number): void {
  setMeta(CURSOR_KEY, String(blockNumber));
}
