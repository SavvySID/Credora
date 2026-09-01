/**
 * Vercel entry. No static imports — a missing helper module must return JSON,
 * not FUNCTION_INVOCATION_FAILED.
 */
export default async function handler(
  req: { method?: string },
  res: {
    headersSent?: boolean;
    status: (code: number) => { json: (body: unknown) => void };
  },
) {
  try {
    const { handle } = await import('../api-lib/handlers/health');
    await handle(req as never, res as never);
  } catch (error) {
    if (res.headersSent) return;
    const detail = error instanceof Error ? error.message : 'Health handler failed to load';
    const apiKey = (process.env.ZG_COMPUTE_API_KEY ?? '').trim();
    const model = (process.env.ZG_COMPUTE_MODEL ?? '').trim();
    const configured = Boolean(apiKey && model);
    let reachable = false;
    try {
      const router = process.env.ZG_COMPUTE_ROUTER_URL ?? 'https://router-api.0g.ai/v1';
      const response = await fetch(`${router}/models`, { signal: AbortSignal.timeout(4_000) });
      reachable = response.ok;
    } catch {
      reachable = false;
    }

    res.status(503).json({
      healthy: false,
      checkedAt: new Date().toISOString(),
      error: 'service_unavailable',
      service: 'Credora API',
      detail,
      message: 'Credora API could not load its health probe. No substitute data was generated.',
      services: {
        indexer: {
          name: 'Credora indexer',
          online: false,
          detail:
            'Indexer is not reachable from this deployment. Host the indexer and set INDEXER_URL to a public https URL.',
        },
        chain: { name: '0G Chain', online: false, chainId: null, detail: 'Indexer unreachable' },
        storage: {
          name: '0G Storage',
          online: false,
          writes: { available: false, blockedReason: 'Indexer unreachable' },
          detail: 'Indexer unreachable',
        },
        compute: {
          name: '0G Compute',
          online: reachable && configured,
          reachable,
          configured,
          detail: configured
            ? reachable
              ? null
              : '0G Compute router was unreachable'
            : 'ZG_COMPUTE_API_KEY or ZG_COMPUTE_MODEL is not set.',
        },
        explorer: { name: '0G Chain Scan', online: false, detail: 'Indexer unreachable' },
      },
      capabilities: null,
      index: null,
    });
  }
}
