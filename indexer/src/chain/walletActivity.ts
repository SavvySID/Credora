import { formatEther } from 'ethers';
import { config } from '../config';
import { getProvider } from './provider';
import { createLogger } from '../logger';

const log = createLogger('chain:walletActivity');

export interface WalletTransaction {
  hash: string;
  from: string;
  to: string | null;
  valueWei: string;
  timestamp: string;
  blockNumber: number;
  gasUsed: string;
  gasPrice: string;
  direction: 'in' | 'out' | 'self';
  isError: boolean;
}

export interface WalletSnapshot {
  address: string;
  chainId: number;
  balanceWei: string;
  balanceFormatted: string;
  /** Account nonce: the real number of outbound transactions ever sent. */
  transactionCount: number;
  transactions: WalletTransaction[];
  firstSeen: string | null;
  lastActivity: string | null;
  /**
   * True when the transaction list could not be retrieved. Balance and nonce
   * still come from the RPC. The list is empty because it is unknown, not
   * because the wallet is inactive - the UI must say so.
   */
  degraded: boolean;
  degradedReason: string | null;
  fetchedAt: string;
}

/**
 * 0G Chain Scan is Etherscan-compatible but not identical: it returns
 * `timestamp` rather than `timeStamp`, and encodes gas fields as hex strings.
 * Both conventions are accepted so the same code works against either.
 */
interface ExplorerTx {
  hash: string;
  from: string;
  to: string;
  value: string;
  timestamp?: string;
  timeStamp?: string;
  blockNumber: string;
  gasUsed?: string;
  gasPrice?: string;
  isError?: string;
  txreceipt_status?: string;
}

/** Parses a field that may arrive as decimal or 0x-prefixed hex. */
function toBigInt(raw: string | undefined): bigint {
  if (!raw) return 0n;
  const trimmed = raw.trim();
  if (trimmed === '') return 0n;
  try {
    return trimmed.startsWith('0x') || trimmed.startsWith('0X')
      ? BigInt(trimmed)
      : BigInt(trimmed);
  } catch {
    return 0n;
  }
}

async function fetchExplorerTransactions(address: string): Promise<ExplorerTx[]> {
  const url = new URL(config.explorer.apiUrl);
  url.searchParams.set('module', 'account');
  url.searchParams.set('action', 'txlist');
  url.searchParams.set('address', address);
  url.searchParams.set('startblock', '0');
  url.searchParams.set('endblock', '99999999');
  url.searchParams.set('sort', 'desc');
  url.searchParams.set('page', '1');
  url.searchParams.set('offset', String(config.explorer.pageSize));
  if (config.explorer.apiKey) url.searchParams.set('apikey', config.explorer.apiKey);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.explorer.timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      throw new Error(`Explorer responded ${response.status} ${response.statusText}`);
    }

    const payload = (await response.json()) as {
      status?: string;
      message?: string;
      result?: unknown;
    };

    // Etherscan-compatible: status "0" with "No transactions found" is a valid
    // empty result, not a failure.
    if (payload.status === '0') {
      const message = (payload.message ?? '').toLowerCase();
      if (message.includes('no transactions found') || message.includes('no records found')) {
        return [];
      }
      throw new Error(`Explorer error: ${payload.message ?? 'unknown'}`);
    }

    if (!Array.isArray(payload.result)) {
      throw new Error('Explorer returned an unexpected payload shape');
    }

    return payload.result as ExplorerTx[];
  } finally {
    clearTimeout(timer);
  }
}

function toWalletTransaction(entry: ExplorerTx, address: string): WalletTransaction | null {
  const owner = address.toLowerCase();
  const from = (entry.from ?? '').toLowerCase();
  // An empty `to` means contract creation.
  const to = entry.to && entry.to !== '' ? entry.to.toLowerCase() : null;

  const seconds = Number(toBigInt(entry.timestamp ?? entry.timeStamp));
  if (!Number.isFinite(seconds) || seconds <= 0) return null;

  const direction: WalletTransaction['direction'] =
    from === owner && to === owner ? 'self' : from === owner ? 'out' : 'in';

  return {
    hash: entry.hash,
    from,
    to,
    valueWei: toBigInt(entry.value).toString(),
    timestamp: new Date(seconds * 1000).toISOString(),
    blockNumber: Number(toBigInt(entry.blockNumber)),
    gasUsed: toBigInt(entry.gasUsed).toString(),
    gasPrice: toBigInt(entry.gasPrice).toString(),
    direction,
    isError: entry.isError === '1' || entry.txreceipt_status === '0',
  };
}

/**
 * Real wallet state. Balance and nonce come from the chain RPC; the
 * transaction list comes from 0G Chain Scan. If the explorer is unavailable
 * the snapshot is returned degraded with an empty list - never synthesised.
 */
export async function fetchWalletSnapshot(address: string): Promise<WalletSnapshot> {
  const normalized = address.toLowerCase();
  const rpc = getProvider();

  const [balanceWei, nonce] = await Promise.all([
    rpc.getBalance(normalized),
    rpc.getTransactionCount(normalized),
  ]);

  let transactions: WalletTransaction[] = [];
  let degraded = false;
  let degradedReason: string | null = null;

  try {
    const raw = await fetchExplorerTransactions(normalized);
    transactions = raw
      .map((entry) => toWalletTransaction(entry, normalized))
      .filter((entry): entry is WalletTransaction => entry !== null);
  } catch (error) {
    degraded = true;
    degradedReason = error instanceof Error ? error.message : String(error);
    log.warn(`Transaction history unavailable for ${normalized}`, degradedReason);
  }

  const sorted = [...transactions].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  return {
    address: normalized,
    chainId: config.chain.chainId,
    balanceWei: balanceWei.toString(),
    balanceFormatted: formatEther(balanceWei),
    transactionCount: nonce,
    transactions,
    firstSeen: sorted[0]?.timestamp ?? null,
    lastActivity: sorted[sorted.length - 1]?.timestamp ?? null,
    degraded,
    degradedReason,
    fetchedAt: new Date().toISOString(),
  };
}

export interface ExplorerProbe {
  reachable: boolean;
  error: string | null;
}

export async function probeExplorer(): Promise<ExplorerProbe> {
  try {
    // Zero address always resolves and costs the explorer nothing meaningful.
    await fetchExplorerTransactions('0x0000000000000000000000000000000000000000');
    return { reachable: true, error: null };
  } catch (error) {
    return { reachable: false, error: error instanceof Error ? error.message : String(error) };
  }
}
