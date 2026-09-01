/**
 * Direct 0G Galileo reads used when the Credora indexer is not reachable
 * (Vercel has no path to localhost:3200).
 *
 * Balance and nonce come from the public RPC. Transaction history comes from
 * 0G Chain Scan. Loan index and 0G Storage writes stay blocked — this path
 * never invents repayments or a Verified record.
 */

import { createHash } from 'node:crypto';
import type { FeaturesDto, WalletSnapshotDto } from './indexer';

function formatEther(wei: bigint): string {
  const negative = wei < 0n;
  const value = negative ? -wei : wei;
  const whole = value / 1000000000000000000n;
  const frac = (value % 1000000000000000000n).toString().padStart(18, '0').replace(/0+$/, '');
  const formatted = frac ? `${whole.toString()}.${frac}` : whole.toString();
  return negative ? `-${formatted}` : formatted;
}

const RPC_URL = process.env.OG_RPC_URL ?? 'https://evmrpc-testnet.0g.ai';
const CHAIN_ID = Number.parseInt(process.env.OG_CHAIN_ID ?? '16602', 10);
const EXPLORER_API =
  process.env.CHAINSCAN_API_URL ?? 'https://chainscan-galileo.0g.ai/open/api';
const EXPLORER_KEY = process.env.CHAINSCAN_API_KEY ?? '';

const TIMEOUT_MS = process.env.VERCEL ? 2_500 : 12_000;

const LOAN_INDEXING = {
  available: false as const,
  blockedReason:
    'Loan index lives on the Credora indexer worker. This deployment is reading Galileo RPC and Chain Scan directly.',
};

export class GalileoUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GalileoUnavailableError';
  }
}

async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    });
    if (!response.ok) {
      throw new GalileoUnavailableError(`Galileo RPC responded ${response.status}`);
    }
    const payload = (await response.json()) as { result?: T; error?: { message?: string } };
    if (payload.error) {
      throw new GalileoUnavailableError(payload.error.message ?? 'Galileo RPC error');
    }
    if (payload.result === undefined) {
      throw new GalileoUnavailableError(`Galileo RPC returned no result for ${method}`);
    }
    return payload.result;
  } catch (error) {
    if (error instanceof GalileoUnavailableError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new GalileoUnavailableError(`Galileo RPC did not respond within ${TIMEOUT_MS}ms`);
    }
    throw new GalileoUnavailableError(error instanceof Error ? error.message : String(error));
  } finally {
    clearTimeout(timer);
  }
}

function toBigInt(raw: string | undefined): bigint {
  if (!raw) return 0n;
  const trimmed = raw.trim();
  if (trimmed === '') return 0n;
  try {
    return trimmed.startsWith('0x') || trimmed.startsWith('0X') ? BigInt(trimmed) : BigInt(trimmed);
  } catch {
    return 0n;
  }
}

interface ExplorerTx {
  hash: string;
  from: string;
  to: string;
  value: string;
  timestamp?: string;
  timeStamp?: string;
  blockNumber: string;
  isError?: string;
  txreceipt_status?: string;
}

async function fetchExplorerTransactions(address: string): Promise<ExplorerTx[]> {
  const url = new URL(EXPLORER_API);
  url.searchParams.set('module', 'account');
  url.searchParams.set('action', 'txlist');
  url.searchParams.set('address', address);
  url.searchParams.set('startblock', '0');
  url.searchParams.set('endblock', '99999999');
  url.searchParams.set('sort', 'desc');
  url.searchParams.set('page', '1');
  url.searchParams.set('offset', '100');
  if (EXPLORER_KEY) url.searchParams.set('apikey', EXPLORER_KEY);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Chain Scan responded ${response.status}`);
    }
    const payload = (await response.json()) as {
      status?: string;
      message?: string;
      result?: unknown;
    };
    if (payload.status === '0') {
      const message = (payload.message ?? '').toLowerCase();
      if (message.includes('no transactions found') || message.includes('no records found')) {
        return [];
      }
      throw new Error(`Chain Scan error: ${payload.message ?? 'unknown'}`);
    }
    if (!Array.isArray(payload.result)) {
      throw new Error('Chain Scan returned an unexpected payload');
    }
    return payload.result as ExplorerTx[];
  } finally {
    clearTimeout(timer);
  }
}

function sourceHash(value: unknown): string {
  const json = JSON.stringify(value);
  return `0x${createHash('sha256').update(json).digest('hex')}`;
}

export async function fetchGalileoWallet(address: string): Promise<WalletSnapshotDto> {
  const wallet = address.toLowerCase();
  const [balanceHex, nonceHex] = await Promise.all([
    rpc<string>('eth_getBalance', [wallet, 'latest']),
    rpc<string>('eth_getTransactionCount', [wallet, 'latest']),
  ]);

  const balanceWei = toBigInt(balanceHex);
  const transactionCount = Number(toBigInt(nonceHex));

  let transactions: WalletSnapshotDto['transactions'] = [];
  let degraded = false;
  let degradedReason: string | null = null;

  try {
    const raw = await fetchExplorerTransactions(wallet);
    transactions = raw
      .map((entry) => {
        const from = (entry.from ?? '').toLowerCase();
        const to = entry.to && entry.to !== '' ? entry.to.toLowerCase() : null;
        const seconds = Number(toBigInt(entry.timestamp ?? entry.timeStamp));
        if (!Number.isFinite(seconds) || seconds <= 0) return null;
        const direction: 'in' | 'out' | 'self' =
          from === wallet && to === wallet ? 'self' : from === wallet ? 'out' : 'in';
        return {
          hash: entry.hash,
          from,
          to,
          valueWei: toBigInt(entry.value).toString(),
          timestamp: new Date(seconds * 1000).toISOString(),
          blockNumber: Number(toBigInt(entry.blockNumber)),
          direction,
          isError: entry.isError === '1' || entry.txreceipt_status === '0',
        };
      })
      .filter((entry): entry is WalletSnapshotDto['transactions'][number] => entry !== null);
  } catch (error) {
    degraded = true;
    degradedReason = error instanceof Error ? error.message : String(error);
  }

  const sorted = [...transactions].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  return {
    address: wallet,
    chainId: CHAIN_ID,
    balanceWei: balanceWei.toString(),
    balanceFormatted: formatEther(balanceWei),
    transactionCount,
    transactions,
    firstSeen: sorted[0]?.timestamp ?? null,
    lastActivity: sorted[sorted.length - 1]?.timestamp ?? null,
    degraded,
    degradedReason,
    fetchedAt: new Date().toISOString(),
    cached: false,
  };
}

export function featuresFromWallet(snapshot: WalletSnapshotDto): FeaturesDto {
  const txMix = {
    inbound: snapshot.transactions.filter((tx) => tx.direction === 'in').length,
    outbound: snapshot.transactions.filter((tx) => tx.direction === 'out').length,
    self: snapshot.transactions.filter((tx) => tx.direction === 'self').length,
  };
  const repayment = {
    total: 0,
    repaid: 0,
    active: 0,
    defaulted: 0,
    overdue: 0,
    repaymentRate: null as number | null,
  };

  const hashable = {
    wallet: snapshot.address,
    chainId: snapshot.chainId,
    balanceWei: snapshot.balanceWei,
    transactionCount: snapshot.transactionCount,
    observedTransactions: snapshot.transactions.length,
    firstSeen: snapshot.firstSeen,
    lastActivity: snapshot.lastActivity,
    repayment,
    outstandingWei: '0',
    overdue: false,
    activeLoanCount: 0,
    repaidLoanCount: 0,
    txMix,
    degraded: snapshot.degraded,
  };

  return {
    ...hashable,
    wallet: snapshot.address,
    balanceFormatted: snapshot.balanceFormatted,
    sourceDataHash: sourceHash(hashable),
    loanIndexing: LOAN_INDEXING,
    fetchedAt: snapshot.fetchedAt,
    degradedReason: snapshot.degradedReason,
  };
}

export async function fetchGalileoFeatures(address: string): Promise<FeaturesDto> {
  return featuresFromWallet(await fetchGalileoWallet(address));
}

export const emptyLoanView = {
  loans: [] as never[],
  reconciled: false,
  reason: LOAN_INDEXING.blockedReason,
  indexing: LOAN_INDEXING,
  stats: {
    total: 0,
    repaid: 0,
    active: 0,
    defaulted: 0,
    overdue: 0,
    repaymentRate: null as number | null,
  },
};

export const emptyRecords = {
  records: [] as never[],
  storageWrites: {
    available: false,
    blockedReason:
      '0G Storage writes run on the Credora indexer worker, which is not hosted on this deployment.',
  },
};

export async function probeGalileoChain(): Promise<{
  reachable: boolean;
  chainId: number | null;
  blockNumber: number | null;
  chainIdMatches: boolean | null;
  error: string | null;
}> {
  try {
    const [chainHex, blockHex] = await Promise.all([
      rpc<string>('eth_chainId', []),
      rpc<string>('eth_blockNumber', []),
    ]);
    const chainId = Number(toBigInt(chainHex));
    return {
      reachable: true,
      chainId,
      blockNumber: Number(toBigInt(blockHex)),
      chainIdMatches: chainId === CHAIN_ID,
      error: null,
    };
  } catch (error) {
    return {
      reachable: false,
      chainId: null,
      blockNumber: null,
      chainIdMatches: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function probeGalileoExplorer(): Promise<{ reachable: boolean; error: string | null }> {
  try {
    await fetchExplorerTransactions('0x0000000000000000000000000000000000000000');
    return { reachable: true, error: null };
  } catch (error) {
    return { reachable: false, error: error instanceof Error ? error.message : String(error) };
  }
}
