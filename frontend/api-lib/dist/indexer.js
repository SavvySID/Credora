"use strict";
/**
 * Server-side client for the Credora indexer worker.
 *
 * The shared secret lives only here. The browser never talks to the worker's
 * authenticated routes directly.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.indexerClient = exports.IndexerUnavailableError = void 0;
exports.indexerConfigured = indexerConfigured;
exports.loadFeatures = loadFeatures;
exports.loadWallet = loadWallet;
exports.loadLoans = loadLoans;
exports.loadRecords = loadRecords;
const SHARED_SECRET = process.env.INDEXER_SHARED_SECRET ?? '';
const requestedTimeout = Number.parseInt(process.env.INDEXER_TIMEOUT_MS ?? '20000', 10);
const TIMEOUT_MS = process.env.VERCEL ? Math.min(requestedTimeout || 8000, 8000) : requestedTimeout || 20000;
function resolveIndexerUrl() {
    const configured = (process.env.INDEXER_URL ?? '').trim();
    if (configured)
        return configured.replace(/\/$/, '');
    return process.env.VERCEL ? '' : 'http://localhost:3200';
}
const INDEXER_URL = resolveIndexerUrl();
class IndexerUnavailableError extends Error {
    status;
    constructor(message, status = null) {
        super(message);
        this.status = status;
        this.name = 'IndexerUnavailableError';
    }
}
exports.IndexerUnavailableError = IndexerUnavailableError;
function indexerConfigured() {
    if (!SHARED_SECRET) {
        return {
            ok: false,
            reason: 'INDEXER_SHARED_SECRET is not set on the API deployment.',
        };
    }
    if (!INDEXER_URL) {
        return {
            ok: false,
            reason: 'INDEXER_URL is not set. Host the indexer and set INDEXER_URL to its public https URL. Do not point it at this Vercel app.',
        };
    }
    if (/your-indexer-host/i.test(INDEXER_URL)) {
        return {
            ok: false,
            reason: 'INDEXER_URL is still the placeholder host. Unset it until the indexer has a public https URL.',
        };
    }
    if (process.env.VERCEL && /localhost|127\.0\.0\.1/.test(INDEXER_URL)) {
        return {
            ok: false,
            reason: 'INDEXER_URL points at localhost; Vercel cannot reach your PC. Host the indexer and set INDEXER_URL to its public https URL.',
        };
    }
    if (/\/api$/i.test(INDEXER_URL)) {
        return {
            ok: false,
            reason: 'INDEXER_URL must be the indexer worker origin, not this app\'s /api path.',
        };
    }
    let parsed;
    try {
        parsed = new URL(INDEXER_URL);
    }
    catch {
        return { ok: false, reason: 'INDEXER_URL is not a valid URL.' };
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return { ok: false, reason: 'INDEXER_URL must be http or https.' };
    }
    const selfHosts = [process.env.VERCEL_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL]
        .filter((value) => Boolean(value))
        .map((value) => value.replace(/^https?:\/\//, '').toLowerCase());
    if (selfHosts.includes(parsed.host.toLowerCase())) {
        return {
            ok: false,
            reason: 'INDEXER_URL points at this Vercel deployment. The indexer is a separate process; set INDEXER_URL to that public https origin.',
        };
    }
    return { ok: true, reason: null };
}
async function request(path, init = {}) {
    const configured = indexerConfigured();
    if (!configured.ok)
        throw new IndexerUnavailableError(configured.reason);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
        const response = await fetch(`${INDEXER_URL}${path}`, {
            ...init,
            signal: controller.signal,
            headers: {
                ...(init.headers ?? {}),
                Authorization: `Bearer ${SHARED_SECRET}`,
                'Content-Type': 'application/json',
            },
        });
        if (!response.ok) {
            const body = await response.text().catch(() => '');
            throw new IndexerUnavailableError(`Indexer responded ${response.status}: ${body.slice(0, 300)}`, response.status);
        }
        return (await response.json());
    }
    catch (error) {
        if (error instanceof IndexerUnavailableError)
            throw error;
        if (error instanceof Error && error.name === 'AbortError') {
            throw new IndexerUnavailableError(`Indexer did not respond within ${TIMEOUT_MS}ms`);
        }
        throw new IndexerUnavailableError(error instanceof Error ? error.message : String(error));
    }
    finally {
        clearTimeout(timer);
    }
}
exports.indexerClient = {
    health: () => request('/health'),
    wallet: (address, refresh = false) => request(`/wallet/${address}${refresh ? '?refresh=true' : ''}`),
    features: (address) => request(`/wallet/${address}/features`),
    loans: (address) => request(`/wallet/${address}/loans`),
    records: (address, eventTypes, limit = 100) => {
        const params = new URLSearchParams({ limit: String(limit) });
        if (eventTypes?.length)
            params.set('eventTypes', eventTypes.join(','));
        return request(`/wallet/${address}/records?${params.toString()}`);
    },
    recordByRoot: (rootHash) => request(`/records/root/${rootHash}`),
    saveAssessment: (payload) => request('/records/assessment', { method: 'POST', body: JSON.stringify(payload) }),
    assessmentCache: (wallet, sourceDataHash, eventType, model) => {
        const params = new URLSearchParams({ wallet, sourceDataHash, eventType, model });
        return request(`/assessments/cache?${params.toString()}`);
    },
    borrowers: (limit = 50) => request(`/borrowers?limit=${limit}`),
    analytics: () => request('/analytics/summary'),
};
async function fromIndexerOrGalileo(indexerCall, fallback) {
    if (!indexerConfigured().ok)
        return fallback();
    try {
        return await indexerCall();
    }
    catch (error) {
        if (error instanceof IndexerUnavailableError)
            return fallback();
        throw error;
    }
}
async function loadFeatures(wallet) {
    const { fetchGalileoFeatures, GalileoUnavailableError } = await Promise.resolve().then(() => __importStar(require('./galileo')));
    try {
        return await fromIndexerOrGalileo(() => exports.indexerClient.features(wallet), () => fetchGalileoFeatures(wallet));
    }
    catch (error) {
        if (error instanceof GalileoUnavailableError) {
            throw new IndexerUnavailableError(error.message);
        }
        throw error;
    }
}
async function loadWallet(address, refresh = false) {
    const { fetchGalileoWallet, GalileoUnavailableError } = await Promise.resolve().then(() => __importStar(require('./galileo')));
    try {
        return await fromIndexerOrGalileo(() => exports.indexerClient.wallet(address, refresh), () => fetchGalileoWallet(address));
    }
    catch (error) {
        if (error instanceof GalileoUnavailableError) {
            throw new IndexerUnavailableError(error.message);
        }
        throw error;
    }
}
async function loadLoans(address) {
    const { emptyLoanView } = await Promise.resolve().then(() => __importStar(require('./galileo')));
    return fromIndexerOrGalileo(() => exports.indexerClient.loans(address), async () => emptyLoanView);
}
async function loadRecords(address, eventTypes, limit = 100) {
    const { emptyRecords } = await Promise.resolve().then(() => __importStar(require('./galileo')));
    return fromIndexerOrGalileo(() => exports.indexerClient.records(address, eventTypes, limit), async () => emptyRecords);
}
