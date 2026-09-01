"use strict";
/**
 * Direct 0G Galileo reads used when the Credora indexer is not reachable
 * (Vercel has no path to localhost:3200).
 *
 * Balance and nonce come from the public RPC. Transaction history comes from
 * 0G Chain Scan. Loan index and 0G Storage writes stay blocked — this path
 * never invents repayments or a Verified record.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.emptyRecords = exports.emptyLoanView = exports.GalileoUnavailableError = void 0;
exports.fetchGalileoWallet = fetchGalileoWallet;
exports.featuresFromWallet = featuresFromWallet;
exports.fetchGalileoFeatures = fetchGalileoFeatures;
exports.probeGalileoChain = probeGalileoChain;
exports.probeGalileoExplorer = probeGalileoExplorer;
const node_crypto_1 = require("node:crypto");
function formatEther(wei) {
    const negative = wei < 0n;
    const value = negative ? -wei : wei;
    const whole = value / 1000000000000000000n;
    const frac = (value % 1000000000000000000n).toString().padStart(18, '0').replace(/0+$/, '');
    const formatted = frac ? `${whole.toString()}.${frac}` : whole.toString();
    return negative ? `-${formatted}` : formatted;
}
const RPC_URL = process.env.OG_RPC_URL ?? 'https://evmrpc-testnet.0g.ai';
const CHAIN_ID = Number.parseInt(process.env.OG_CHAIN_ID ?? '16602', 10);
const EXPLORER_API = process.env.CHAINSCAN_API_URL ?? 'https://chainscan-galileo.0g.ai/open/api';
const EXPLORER_KEY = process.env.CHAINSCAN_API_KEY ?? '';
const TIMEOUT_MS = process.env.VERCEL ? 4_000 : 12_000;
const LOAN_INDEXING = {
    available: false,
    blockedReason: 'Loan index lives on the Credora indexer worker. This deployment is reading Galileo RPC and Chain Scan directly.',
};
class GalileoUnavailableError extends Error {
    constructor(message) {
        super(message);
        this.name = 'GalileoUnavailableError';
    }
}
exports.GalileoUnavailableError = GalileoUnavailableError;
async function rpc(method, params) {
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
        const payload = (await response.json());
        if (payload.error) {
            throw new GalileoUnavailableError(payload.error.message ?? 'Galileo RPC error');
        }
        if (payload.result === undefined) {
            throw new GalileoUnavailableError(`Galileo RPC returned no result for ${method}`);
        }
        return payload.result;
    }
    catch (error) {
        if (error instanceof GalileoUnavailableError)
            throw error;
        if (error instanceof Error && error.name === 'AbortError') {
            throw new GalileoUnavailableError(`Galileo RPC did not respond within ${TIMEOUT_MS}ms`);
        }
        throw new GalileoUnavailableError(error instanceof Error ? error.message : String(error));
    }
    finally {
        clearTimeout(timer);
    }
}
function toBigInt(raw) {
    if (!raw)
        return 0n;
    const trimmed = raw.trim();
    if (trimmed === '')
        return 0n;
    try {
        return trimmed.startsWith('0x') || trimmed.startsWith('0X') ? BigInt(trimmed) : BigInt(trimmed);
    }
    catch {
        return 0n;
    }
}
async function fetchExplorerTransactions(address) {
    const url = new URL(EXPLORER_API);
    url.searchParams.set('module', 'account');
    url.searchParams.set('action', 'txlist');
    url.searchParams.set('address', address);
    url.searchParams.set('startblock', '0');
    url.searchParams.set('endblock', '99999999');
    url.searchParams.set('sort', 'desc');
    url.searchParams.set('page', '1');
    url.searchParams.set('offset', '100');
    if (EXPLORER_KEY)
        url.searchParams.set('apikey', EXPLORER_KEY);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) {
            throw new Error(`Chain Scan responded ${response.status}`);
        }
        const payload = (await response.json());
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
        return payload.result;
    }
    finally {
        clearTimeout(timer);
    }
}
function sourceHash(value) {
    const json = JSON.stringify(value);
    return `0x${(0, node_crypto_1.createHash)('sha256').update(json).digest('hex')}`;
}
async function fetchGalileoWallet(address) {
    const wallet = address.toLowerCase();
    const [balanceHex, nonceHex] = await Promise.all([
        rpc('eth_getBalance', [wallet, 'latest']),
        rpc('eth_getTransactionCount', [wallet, 'latest']),
    ]);
    const balanceWei = toBigInt(balanceHex);
    const transactionCount = Number(toBigInt(nonceHex));
    let transactions = [];
    let degraded = false;
    let degradedReason = null;
    try {
        const raw = await fetchExplorerTransactions(wallet);
        transactions = raw
            .map((entry) => {
            const from = (entry.from ?? '').toLowerCase();
            const to = entry.to && entry.to !== '' ? entry.to.toLowerCase() : null;
            const seconds = Number(toBigInt(entry.timestamp ?? entry.timeStamp));
            if (!Number.isFinite(seconds) || seconds <= 0)
                return null;
            const direction = from === wallet && to === wallet ? 'self' : from === wallet ? 'out' : 'in';
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
            .filter((entry) => entry !== null);
    }
    catch (error) {
        degraded = true;
        degradedReason = error instanceof Error ? error.message : String(error);
    }
    const sorted = [...transactions].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
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
function featuresFromWallet(snapshot) {
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
        repaymentRate: null,
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
async function fetchGalileoFeatures(address) {
    return featuresFromWallet(await fetchGalileoWallet(address));
}
exports.emptyLoanView = {
    loans: [],
    reconciled: false,
    reason: LOAN_INDEXING.blockedReason,
    indexing: LOAN_INDEXING,
    stats: {
        total: 0,
        repaid: 0,
        active: 0,
        defaulted: 0,
        overdue: 0,
        repaymentRate: null,
    },
};
exports.emptyRecords = {
    records: [],
    storageWrites: {
        available: false,
        blockedReason: '0G Storage writes run on the Credora indexer worker, which is not hosted on this deployment.',
    },
};
async function probeGalileoChain() {
    try {
        const [chainHex, blockHex] = await Promise.all([
            rpc('eth_chainId', []),
            rpc('eth_blockNumber', []),
        ]);
        const chainId = Number(toBigInt(chainHex));
        return {
            reachable: true,
            chainId,
            blockNumber: Number(toBigInt(blockHex)),
            chainIdMatches: chainId === CHAIN_ID,
            error: null,
        };
    }
    catch (error) {
        return {
            reachable: false,
            chainId: null,
            blockNumber: null,
            chainIdMatches: null,
            error: error instanceof Error ? error.message : String(error),
        };
    }
}
async function probeGalileoExplorer() {
    try {
        await fetchExplorerTransactions('0x0000000000000000000000000000000000000000');
        return { reachable: true, error: null };
    }
    catch (error) {
        return { reachable: false, error: error instanceof Error ? error.message : String(error) };
    }
}
