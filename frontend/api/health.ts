export default async function handler(
  req: { method?: string },
  res: {
    headersSent?: boolean;
    status: (code: number) => { json: (body: unknown) => void };
  },
) {
  try {
    const id = process.env.VERCEL
      ? '../api-lib/dist/handlers/health.js'
      : '../api-lib/handlers/health';
    const mod = (await import(id)) as {
      handle?: (r: typeof req, s: typeof res) => Promise<void>;
    };
    if (!mod.handle) throw new Error('Health handler export missing');
    await mod.handle(req, res);
  } catch (error) {
    if (res.headersSent) return;
    const detail = error instanceof Error ? error.message : 'Health handler failed';
    res.status(503).json({
      healthy: false,
      checkedAt: new Date().toISOString(),
      error: 'service_unavailable',
      service: 'Credora API',
      detail,
      message: 'Credora API could not complete its health probe. No substitute data was generated.',
      services: {
        indexer: { name: 'Credora indexer', online: false, detail },
        chain: { name: '0G Chain', online: false, chainId: null, detail },
        storage: {
          name: '0G Storage',
          online: false,
          writes: { available: false, blockedReason: detail },
          detail,
        },
        compute: {
          name: '0G Compute',
          online: false,
          reachable: false,
          configured: false,
          detail,
        },
        explorer: { name: '0G Chain Scan', online: false, detail },
      },
      capabilities: null,
      index: null,
    });
  }
}
