import { config as loadEnv } from 'dotenv';

loadEnv();

/**
 * A capability is either available or BLOCKED with a reason. Nothing in this
 * service falls back to synthetic data when a capability is blocked - callers
 * must surface the blocked state instead.
 */
export interface Capability {
  available: boolean;
  blockedReason: string | null;
}

function blocked(reason: string): Capability {
  return { available: false, blockedReason: reason };
}

const available: Capability = { available: true, blockedReason: null };

function str(key: string, fallback?: string): string | null {
  const raw = process.env[key];
  if (raw === undefined || raw.trim() === '') return fallback ?? null;
  return raw.trim();
}

function int(key: string, fallback: number): number {
  const raw = str(key);
  if (raw === null) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const loanAddress = str('LOAN_CONTRACT_ADDRESS');
const loanDeployBlockRaw = str('LOAN_DEPLOY_BLOCK');
const ogPrivateKey = str('OG_STORAGE_PRIVATE_KEY');
const sharedSecret = str('INDEXER_SHARED_SECRET');

export const config = {
  chain: {
    rpcUrl: str('OG_RPC_URL', 'https://evmrpc-testnet.0g.ai')!,
    chainId: int('OG_CHAIN_ID', 16602),
    /** Blocks to stay behind head so a shallow reorg cannot poison the index. */
    confirmations: int('CONFIRMATIONS', 5),
    /** eth_getLogs window. 0G public RPC rejects very wide ranges. */
    logRange: int('LOG_BLOCK_RANGE', 2000),
  },

  loan: {
    address: loanAddress,
    deployBlock: loanDeployBlockRaw === null ? null : Number.parseInt(loanDeployBlockRaw, 10),
  },

  og: {
    storageIndexer: str('OG_STORAGE_INDEXER', 'https://indexer-storage-testnet-turbo.0g.ai')!,
    /** Server-only. Pays 0G Storage upload fees. Never sent to a client. */
    privateKey: ogPrivateKey,
    uploadTimeoutMs: int('OG_UPLOAD_TIMEOUT_MS', 120_000),
    downloadTimeoutMs: int('OG_DOWNLOAD_TIMEOUT_MS', 30_000),
  },

  explorer: {
    apiUrl: str('CHAINSCAN_API_URL', 'https://chainscan-galileo.0g.ai/open/api')!,
    apiKey: str('CHAINSCAN_API_KEY'),
    browserUrl: str('CHAINSCAN_BROWSER_URL', 'https://chainscan-galileo.0g.ai')!,
    pageSize: int('CHAINSCAN_PAGE_SIZE', 100),
    timeoutMs: int('CHAINSCAN_TIMEOUT_MS', 15_000),
  },

  server: {
    port: int('INDEXER_PORT', 3200),
    sharedSecret,
    corsOrigins: (str('INDEXER_CORS_ORIGINS', 'http://localhost:3100') ?? '')
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean),
  },

  store: {
    /** Derived index and cache only. Never the authoritative source. */
    path: str('DATABASE_PATH', './data/credora-index.db')!,
    walletActivityTtlMs: int('WALLET_ACTIVITY_TTL_MS', 60_000),
  },

  worker: {
    pollIntervalMs: int('POLL_INTERVAL_MS', 15_000),
    enabled: str('WORKER_ENABLED', 'true') !== 'false',
  },
} as const;

/** Reading chain state needs no credential. */
export const chainReadCapability: Capability = available;

/** Reading 0G Storage by root hash goes through the public gateway, no key. */
export const ogReadCapability: Capability = available;

/**
 * Writing to 0G Storage costs an on-chain fee, so it needs a funded key.
 * Without it every write is BLOCKED - we do not pretend a write succeeded.
 */
export const ogWriteCapability: Capability = ogPrivateKey
  ? available
  : blocked(
      'OG_STORAGE_PRIVATE_KEY is not set. 0G Storage writes require a Galileo key funded from https://faucet.0g.ai',
    );

/** Indexing loan events is impossible until Loan.sol is actually deployed. */
export const loanIndexingCapability: Capability =
  loanAddress && config.loan.deployBlock !== null && Number.isFinite(config.loan.deployBlock)
    ? available
    : blocked(
        'LOAN_CONTRACT_ADDRESS / LOAN_DEPLOY_BLOCK are not set. Deploy Loan.sol to 0G Galileo with `npm run deploy:galileo` in contracts/.',
      );

export function assertServerConfig(): void {
  if (!config.server.sharedSecret) {
    throw new Error(
      'INDEXER_SHARED_SECRET is required so only the Credora API layer can read the index.',
    );
  }
}

export function capabilitySummary() {
  return {
    chainRead: chainReadCapability,
    ogRead: ogReadCapability,
    ogWrite: ogWriteCapability,
    loanIndexing: loanIndexingCapability,
  };
}
