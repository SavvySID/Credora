import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handle } from '../api-lib/handlers/health';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    await handle(req, res);
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
