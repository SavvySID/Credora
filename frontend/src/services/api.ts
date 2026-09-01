/**
 * Browser HTTP client for the Credora API layer.
 *
 * Talks only to same-origin `/api` (or VITE_API_BASE_URL). Never holds a
 * storage key, compute key, or indexer shared secret.
 */

import { publicConfig } from './0g-config';
import type { AnalysisType } from '@/lib/analysis';

export class ApiUnavailableError extends Error {
  readonly status: number;
  readonly service: string;

  constructor(message: string, status = 503, service = 'Credora API') {
    super(message);
    this.name = 'ApiUnavailableError';
    this.status = status;
    this.service = service;
  }
}

function errorText(value: unknown, fallback: string): string {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (value && typeof value === 'object') {
    const rec = value as Record<string, unknown>;
    if (typeof rec.detail === 'string' && rec.detail.trim()) return rec.detail.trim();
    if (typeof rec.message === 'string' && rec.message.trim()) return rec.message.trim();
    if (typeof rec.error === 'string' && rec.error.trim()) return rec.error.trim();
  }
  if (value instanceof Error && value.message) return value.message;
  return fallback;
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  opts: { acceptStatuses?: number[] } = {},
): Promise<T> {
  const url = `${publicConfig.apiBaseUrl}${path}`;

  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init.headers ?? {}),
      },
    });
  } catch (error) {
    throw new ApiUnavailableError(
      error instanceof Error ? error.message : 'Network request failed',
    );
  }

  const raw = await response.text().catch(() => '');
  let payload: (T & { error?: unknown; service?: string; detail?: unknown; message?: unknown }) | null =
    null;
  if (raw) {
    try {
      payload = JSON.parse(raw) as T & {
        error?: unknown;
        service?: string;
        detail?: unknown;
        message?: unknown;
      };
    } catch {
      payload = null;
    }
  }

  if (!response.ok && !opts.acceptStatuses?.includes(response.status)) {
    const service = payload?.service ?? 'Credora API';
    const detail = errorText(
      payload?.detail ?? payload?.message ?? payload?.error ?? raw,
      `HTTP ${response.status}`,
    );
    throw new ApiUnavailableError(detail, response.status, service);
  }

  return (payload ?? ({} as T)) as T;
}

export interface VerificationState {
  status: 'verified' | 'pending' | 'unverified' | 'failed';
  rootHash: string | null;
  storageTxHash: string | null;
  verifiedAt: string | null;
  detail: string | null;
}

export interface WalletActivityDto {
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
  verification: VerificationState;
}

export interface CreditScoreDto {
  wallet: string;
  creditScore: number;
  creditBand?: 'Building' | 'Established' | 'Excellent';
  riskLevel: 'Low' | 'Medium' | 'High';
  confidence: number;
  factors: Array<{
    factor: string;
    impact: string;
    weight: number;
    description: string;
    observed?: string;
    normalized?: number;
  }>;
  timestamp: string;
  walletData: {
    balance: string;
    balanceWei: string;
    transactionCount: number;
    firstSeen: string | null;
    lastActivity: string | null;
    chainId: number;
  };
  scoring: {
    id: string;
    version: string;
    method: string;
    deterministic: boolean;
    trained: boolean;
    description: string;
    methodology: string;
    inputs: Record<string, string | number | null>;
    completeness: { missing: string[] };
  };
  narrative: {
    available: boolean;
    provider: string | null;
    model: string | null;
    text: string | null;
    blockedReason: string | null;
    latencyMs: number | null;
  };
  dataQuality: {
    degraded: boolean;
    degradedReason: string | null;
    loanIndexing: { available: boolean; blockedReason: string | null };
    missingInputs: string[];
    fetchedAt: string;
  };
  record: {
    recordId?: string;
    verification?: VerificationState;
    storageWrites?: { available: boolean; blockedReason: string | null };
    persistence?: string;
    error?: string | null;
  };
}

export interface HealthDto {
  healthy: boolean;
  checkedAt: string;
  services: {
    indexer: { online: boolean; detail: string | null };
    chain: { online: boolean; chainId: number | null; detail: string | null };
    storage: {
      online: boolean;
      writes: { available: boolean; blockedReason: string | null };
      detail: string | null;
    };
    compute: {
      online: boolean;
      reachable: boolean;
      configured: boolean;
      detail: string | null;
    };
    explorer: { online: boolean; detail: string | null };
  };
  capabilities: Record<string, { available: boolean; blockedReason: string | null }> | null;
  index: { total: number; stored: number; verified: number; cursorBlock: number | null } | null;
}

export interface CreditProfileDto {
  wallet: string;
  sourceDataHash: string | null;
  deterministic: {
    score: number;
    creditBand: 'Building' | 'Established' | 'Excellent';
    riskLevel: 'Low' | 'Medium' | 'High';
    factors: CreditScoreDto['factors'];
    methodology: string;
    confidence: number;
    completeness: { missing: string[] };
    model: string;
  };
  ai: {
    available: boolean;
    riskLevel: 'Low' | 'Medium' | 'High' | null;
    riskScore: number | null;
    factors: { keyRiskFactors: string[]; positiveFactors: string[] };
    summary: string | null;
    model: string | null;
    latencyMs: number | null;
    confidence: number | null;
    blockedReason: string | null;
    cached: boolean;
    timestamp: string | null;
    sourceDataHash: string | null;
    analysisType?: AnalysisType;
    analysisLabel?: string | null;
    riskOutlook?: 'Improving' | 'Stable' | 'Deteriorating' | 'Insufficient Data' | null;
    verification: {
      status: VerificationState['status'];
      rootHash: string | null;
      storageTxHash: string | null;
      verifiedAt: string | null;
      detail: string | null;
      recordId: string;
      eventType: string;
    } | null;
  };
  aiByAnalysis?: Partial<Record<AnalysisType, CreditProfileDto['ai']>>;
  reputation: {
    badges: Array<{ id: string; label: string; earned: boolean; evidence: string }>;
    earned: Array<{ id: string; label: string; evidence: string }>;
  };
  loans: {
    list: LoanDto[];
    stats: {
      total: number;
      repaid: number;
      active: number;
      defaulted: number;
      overdue: number;
      repaymentRate: number | null;
    };
    reconciled: boolean;
    reason: string | null;
  };
  walletSummary: {
    balanceWei: string;
    balanceFormatted: string;
    transactionCount: number;
    firstSeen: string | null;
    lastActivity: string | null;
    txMix?: { inbound: number; outbound: number; self: number };
    outstandingWei?: string;
    overdue?: boolean;
    chainId: number;
  };
  verification: {
    status: VerificationState['status'];
    rootHash: string | null;
    storageTxHash: string | null;
    verifiedAt: string | null;
    detail: string | null;
    recordId: string;
    eventType: string;
  } | null;
  history: Array<{
    kind: string;
    score: number;
    riskLevel: string | null;
    timestamp: string;
    source: string;
    verification: string;
    recordId: string;
  }>;
  limitations: Record<string, boolean>;
  dataQuality: CreditScoreDto['dataQuality'];
}

export interface RiskAssessmentDto {
  wallet: string;
  available: boolean;
  riskLevel: 'Low' | 'Medium' | 'High' | null;
  riskScore: number | null;
  keyRiskFactors?: string[];
  positiveFactors?: string[];
  assessmentSummary?: string | null;
  confidence?: number | null;
  model?: string | null;
  latencyMs?: number | null;
  blockedReason?: string | null;
  cached?: boolean;
  sourceDataHash?: string | null;
  record?: RecordDto | null;
  deterministicScore?: number;
  creditBand?: string;
  analysisType?: AnalysisType;
  analysisLabel?: string;
  riskOutlook?: 'Improving' | 'Stable' | 'Deteriorating' | 'Insufficient Data' | null;
}

export function creditAiFromRiskAssessment(result: RiskAssessmentDto): CreditProfileDto['ai'] {
  return {
    available: result.available,
    riskLevel: result.riskLevel ?? null,
    riskScore: result.riskScore ?? null,
    factors: {
      keyRiskFactors: result.keyRiskFactors ?? [],
      positiveFactors: result.positiveFactors ?? [],
    },
    summary: result.assessmentSummary ?? null,
    model: result.model ?? null,
    latencyMs: result.latencyMs ?? null,
    confidence: result.confidence ?? null,
    blockedReason: result.blockedReason ?? null,
    cached: Boolean(result.cached),
    timestamp: result.record?.timestamp ?? null,
    sourceDataHash: result.sourceDataHash ?? null,
    analysisType: result.analysisType,
    analysisLabel: result.analysisLabel ?? null,
    riskOutlook: result.riskOutlook ?? null,
    verification: result.record
      ? {
          status: result.record.verification.status,
          rootHash: result.record.verification.rootHash,
          storageTxHash: result.record.verification.storageTxHash,
          verifiedAt: result.record.verification.verifiedAt,
          detail: result.record.verification.detail,
          recordId: result.record.recordId,
          eventType: result.record.eventType,
        }
      : null,
  };
}

export const api = {
  health: () => request<HealthDto>('/health', {}, { acceptStatuses: [503] }),

  creditScore: (address: string) =>
    request<CreditScoreDto>(`/credit-score?address=${encodeURIComponent(address)}`),

  creditProfile: (address: string) =>
    request<CreditProfileDto>(`/credit-profile?address=${encodeURIComponent(address)}`),

  riskAssessment: (address: string, method: 'GET' | 'POST' = 'GET', analysisType?: AnalysisType) => {
    const params = new URLSearchParams({ address });
    if (analysisType) params.set('analysisType', analysisType);
    return request<RiskAssessmentDto>(`/risk-assessment?${params.toString()}`, {
      method,
      ...(method === 'POST' && analysisType ? { body: JSON.stringify({ analysisType }) } : {}),
    });
  },

  analytics: () => request<Record<string, unknown>>('/analytics'),

  lenderBorrowers: (limit = 50) =>
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
    }>(`/lender/borrowers?limit=${limit}`),

  lenderBorrower: (address: string) =>
    request<CreditProfileDto>(`/lender/borrowers/${address}`),

  walletActivity: (address: string, refresh = false) =>
    request<WalletActivityDto>(
      `/wallet/${address}/activity${refresh ? '?refresh=true' : ''}`,
    ),

  walletLoans: (address: string) =>
    request<{
      loans: LoanDto[];
      reconciled: boolean;
      reason: string | null;
      indexing: { available: boolean; blockedReason: string | null };
      stats: {
        total: number;
        repaid: number;
        active: number;
        defaulted: number;
        overdue: number;
        repaymentRate: number | null;
      };
    }>(`/wallet/${address}/loans`),

  walletRecords: (address: string, eventTypes?: string[], limit = 100) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (eventTypes?.length) params.set('eventTypes', eventTypes.join(','));
    return request<{
      records: RecordDto[];
      storageWrites: { available: boolean; blockedReason: string | null };
    }>(`/wallet/${address}/records?${params.toString()}`);
  },

  recordByRoot: (rootHash: string) =>
    request<{
      rootHash: string;
      indexed: boolean;
      verification: { status: string; detail: string | null; verifiedAt: string | null };
      record: unknown;
    }>(`/records/${rootHash}`),
};
