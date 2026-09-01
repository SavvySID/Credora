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

export const OG_CHAIN_ID = Number.parseInt(env('VITE_0G_CHAIN_ID') ?? '16602', 10);

export const publicConfig = {
  apiBaseUrl: (env('VITE_API_BASE_URL') ?? '/api').replace(/\/$/, ''),
  streamUrl: env('VITE_INDEXER_STREAM_URL') ?? 'http://localhost:3200/stream',
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
    return health.services.storage.online;
  } catch {
    return false;
  }
}
