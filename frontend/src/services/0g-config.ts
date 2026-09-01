/**
 * Public, browser-safe configuration.
 *
 * No API keys, private keys, or encryption secrets live here. Those stay on
 * the indexer worker and the Vercel / local API server.
 */

const env = (key: string): string | undefined => {
  const value = (import.meta.env as Record<string, string | undefined>)[key];
  return value && value.trim() !== '' ? value.trim() : undefined;
};

function publicStreamUrl(): string | null {
  const configured = env('VITE_INDEXER_STREAM_URL');
  if (!configured) return import.meta.env.DEV ? 'http://localhost:3200/stream' : null;
  if (/your-indexer-host/i.test(configured)) return null;
  if (import.meta.env.PROD && /localhost|127\.0\.0\.1/.test(configured)) return null;
  try {
    const parsed = new URL(configured);
    if (import.meta.env.PROD && parsed.protocol === 'http:') return null;
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return configured.replace(/\/$/, '');
  } catch {
    return null;
  }
}

export const OG_CHAIN_ID = Number.parseInt(env('VITE_0G_CHAIN_ID') ?? '16602', 10);

function publicApiBase(): string {
  const configured = (env('VITE_API_BASE_URL') ?? '/api').replace(/\/$/, '') || '/api';
  if (import.meta.env.PROD) {
    if (/your-indexer-host/i.test(configured)) return '/api';
    if (/localhost|127\.0\.0\.1/.test(configured)) return '/api';
    if (/^http:\/\//i.test(configured)) return '/api';
  }
  return configured;
}

export const publicConfig = {
  apiBaseUrl: publicApiBase(),
  streamUrl: publicStreamUrl(),
  loanContractAddress: env('VITE_LOAN_CONTRACT_ADDRESS') ?? null,
  chainId: Number.isFinite(OG_CHAIN_ID) ? OG_CHAIN_ID : 16602,
  explorerUrl: env('VITE_0G_EXPLORER_URL') ?? 'https://chainscan-galileo.0g.ai',
  walletConnectProjectId: env('VITE_WALLETCONNECT_PROJECT_ID') ?? '',
};

/** Retained so existing imports of ZERO_G_CONFIG.creditModel still typecheck. */
export const ZERO_G_CONFIG = {
  creditModel: {
    modelId: 'credora-onchain-v1',
    version: '1.0.0',
    inputSchema: {
      walletAddress: 'string',
      balance: 'number',
      transactionCount: 'number',
      transactionHistory: 'array',
      lendingHistory: 'array',
      lastActivity: 'string',
    },
    outputSchema: {
      creditScore: 'number',
      riskLevel: 'string',
      confidence: 'number',
      factors: 'array',
    },
  },
};

/**
 * Probes the API health endpoint. Returns false when the API or 0G Storage
 * cannot be reached. Does not construct mock clients.
 */
export async function initialize0G(): Promise<boolean> {
  try {
    const { api } = await import('./api');
    const health = await api.health();
    return Boolean(health.services?.storage?.online);
  } catch {
    return false;
  }
}
