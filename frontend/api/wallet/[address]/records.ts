import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handle } from '../../../api-lib/handlers/walletRecords';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    await handle(req, res);
  } catch (error) {
    if (res.headersSent) return;
    res.status(503).json({
      error: 'service_unavailable',
      service: 'Credora API',
      detail: error instanceof Error ? error.message : 'Wallet records handler failed',
      message: 'Records could not be loaded. No substitute data was generated.',
    });
  }
}
