/**
 * Server-side client for the Credora indexer worker.
 *
 * The shared secret lives only here. The browser never talks to the worker's
 * authenticated routes directly.
 */

const SHARED_SECRET = process.env.INDEXER_SHARED_SECRET ?? '';
const requestedTimeout = Number.parseInt(process.env.INDEXER_TIMEOUT_MS ?? '20000', 10);
const TIMEOUT_MS = process.env.VERCEL ? Math.min(requestedTimeout || 8000, 8000) : requestedTimeout || 20000;

function resolveIndexerUrl(): string {
  const configured = (process.env.INDEXER_URL ?? '').trim();
  if (configured) return configured.replace(/\/$/, '');
  return process.env.VERCEL ? '' : 'http://localhost:3200';
}

const INDEXER_URL = resolveIndexerUrl();

export class IndexerUnavailableError extends Error {
  constructor(
    message: string,
    readonly status: number | null = null,
  ) {
    super(message);
    this.name = 'IndexerUnavailableError';
  }
}

export function indexerConfigured(): { ok: boolean; reason: string | null } {
  if (!SHARED_SECRET) {
    return {
      ok: false,
      reason: 'INDEXER_SHARED_SECRET is not set on the API deployment.',
    };
  }
  if (!INDEXER_URL) {
    return {
      ok: false,
      reason:
        'INDEXER_URL is not set. Host the indexer and set INDEXER_URL to its public https URL. Do not point it at this Vercel app.',
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
      reason:
        'INDEXER_URL points at localhost; Vercel cannot reach your PC. Host the indexer and set INDEXER_URL to its public https URL.',
    };
  }
  if (/\/api$/i.test(INDEXER_URL)) {
    return {
      ok: false,
      reason: 'INDEXER_URL must be the indexer worker origin, not this app\'s /api path.',
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(INDEXER_URL);
  } catch {
    return { ok: false, reason: 'INDEXER_URL is not a valid URL.' };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, reason: 'INDEXER_URL must be http or https.' };
  }

  const selfHosts = [process.env.VERCEL_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.replace(/^https?:\/\//, '').toLowerCase());
  if (selfHosts.includes(parsed.host.toLowerCase())) {
    return {
      ok: false,
      reason:
        'INDEXER_URL points at this Vercel deployment. The indexer is a separate process; set INDEXER_URL to that public https origin.',
    };
  }

  return { ok: true, reason: null };
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const configured = indexerConfigured();
  if (!configured.ok) throw new IndexerUnavailableError(configured.reason!);

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
      throw new IndexerUnavailableError(
        `Indexer responded ${response.status}: ${body.slice(0, 300)}`,
        response.status,
      );
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof IndexerUnavailableError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new IndexerUnavailableError(`Indexer did not respond within ${TIMEOUT_MS}ms`);
    }
    throw new IndexerUnavailableError(
      error instanceof Error ? error.message : String(error),
    );
  } finally {
    clearTimeout(timer);
  }
}

export interface Capability {
  available: boolean;
  blockedReason: string | null;
}

export interface WalletSnapshotDto {
  address: string;
  chainId: number;
  balanceWei: string;
  balanceFormatted: string;
  transactionCount: number;
  transactions: Array<{
    hash: string;
    from: string;
    to: string | null;
    valueWei: string;
    timestamp: string;
    blockNumber: number;
    direction: 'in' | 'out' | 'self';
    isError: boolean;
  }>;
  firstSeen: string | null;
  lastActivity: string | null;
  degraded: boolean;
  degradedReason: string | null;
  fetchedAt: string;
  cached: boolean;
}

export interface RepaymentStats {
  total: number;
  repaid: number;
  active: number;
  defaulted: number;
  overdue: number;
  repaymentRate: number | null;
}

export interface FeaturesDto {
  wallet: string;
  chainId: number;
  balanceWei: string;
  balanceFormatted: string;
  transactionCount: number;
  observedTransactions: number;
  firstSeen: string | null;
  lastActivity: string | null;
  repayment: RepaymentStats;
  outstandingWei?: string;
  overdue?: boolean;
  activeLoanCount?: number;
  repaidLoanCount?: number;
  txMix?: { inbound: number; outbound: number; self: number };
  sourceDataHash?: string;
  degraded: boolean;
  degradedReason: string | null;
  loanIndexing: Capability;
  fetchedAt: string;
}

export interface LoanDto {
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
  reconciled: boolean;
  overdue: boolean;
}

export interface RecordDto {
  recordId: string;
  wallet: string;
  eventType: string;
  loanId: string | null;
  txHash: string | null;
  blockNumber: number | null;
  timestamp: string;
  chainId: number;
  source: string;
  values: Record<string, unknown>;
  meta: Record<string, unknown>;
  verification: {
    status: 'verified' | 'pending' | 'unverified' | 'failed';
    rootHash: string | null;
    storageTxHash: string | null;
    verifiedAt: string | null;
    detail: string | null;
  };
}

export const indexerClient = {
  health: () => request<Record<string, unknown>>('/health'),

  wallet: (address: string, refresh = false) =>
    request<WalletSnapshotDto>(`/wallet/${address}${refresh ? '?refresh=true' : ''}`),

  features: (address: string) => request<FeaturesDto>(`/wallet/${address}/features`),

  loans: (address: string) =>
    request<{ loans: LoanDto[]; reconciled: boolean; reason: string | null; indexing: Capability; stats: RepaymentStats }>(
      `/wallet/${address}/loans`,
    ),

  records: (address: string, eventTypes?: string[], limit = 100) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (eventTypes?.length) params.set('eventTypes', eventTypes.join(','));
    return request<{ records: RecordDto[]; storageWrites: Capability }>(
      `/wallet/${address}/records?${params.toString()}`,
    );
  },

  recordByRoot: (rootHash: string) =>
    request<{
      rootHash: string;
      indexed: boolean;
      verification: { status: string; detail: string | null; verifiedAt: string | null };
      record: unknown;
    }>(`/records/root/${rootHash}`),

  saveAssessment: (payload: {
    wallet: string;
    creditScore?: number;
    riskLevel?: 'Low' | 'Medium' | 'High';
    confidence: number;
    model: string;
    methodology: string;
    eventType?: 'credit_assessment' | 'ai_risk_assessment';
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
  }) =>
    request<{ record: RecordDto; storageWrites: Capability; verification: string; cached?: boolean }>(
      '/records/assessment',
      { method: 'POST', body: JSON.stringify(payload) },
    ),

  assessmentCache: (
    wallet: string,
    sourceDataHash: string,
    eventType: string,
    model: string,
  ) => {
    const params = new URLSearchParams({ wallet, sourceDataHash, eventType, model });
    return request<{ hit: boolean; record: RecordDto | null }>(`/assessments/cache?${params.toString()}`);
  },

  borrowers: (limit = 50) =>
    request<{
      borrowers: Array<{
        wallet: string;
        lastDeterministicScore: number | null;
        lastAiRiskScore: number | null;
        lastAiRiskLevel: string | null;
        hasActiveLoan: boolean;
        overdue: boolean;
        latestVerification: string | null;
        lastAssessmentAt: string | null;
      }>;
      limitations: Record<string, boolean>;
    }>(`/borrowers?limit=${limit}`),

  analytics: () => request<Record<string, unknown>>('/analytics/summary'),
};

async function fromIndexerOrGalileo<T>(indexerCall: () => Promise<T>, fallback: () => Promise<T>): Promise<T> {
  if (!indexerConfigured().ok) return fallback();
  try {
    return await indexerCall();
  } catch (error) {
    if (error instanceof IndexerUnavailableError) return fallback();
    throw error;
  }
}

export async function loadFeatures(wallet: string): Promise<FeaturesDto> {
  const { fetchGalileoFeatures, GalileoUnavailableError } = await import('./galileo');
  try {
    return await fromIndexerOrGalileo(
      () => indexerClient.features(wallet),
      () => fetchGalileoFeatures(wallet),
    );
  } catch (error) {
    if (error instanceof GalileoUnavailableError) {
      throw new IndexerUnavailableError(error.message);
    }
    throw error;
  }
}

export async function loadWallet(address: string, refresh = false): Promise<WalletSnapshotDto> {
  const { fetchGalileoWallet, GalileoUnavailableError } = await import('./galileo');
  try {
    return await fromIndexerOrGalileo(
      () => indexerClient.wallet(address, refresh),
      () => fetchGalileoWallet(address),
    );
  } catch (error) {
    if (error instanceof GalileoUnavailableError) {
      throw new IndexerUnavailableError(error.message);
    }
    throw error;
  }
}

export async function loadLoans(address: string) {
  const { emptyLoanView } = await import('./galileo');
  return fromIndexerOrGalileo(
    () => indexerClient.loans(address),
    async () => emptyLoanView,
  );
}

export async function loadRecords(address: string, eventTypes?: string[], limit = 100) {
  const { emptyRecords } = await import('./galileo');
  return fromIndexerOrGalileo(
    () => indexerClient.records(address, eventTypes, limit),
    async () => emptyRecords,
  );
}
