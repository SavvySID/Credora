import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handle } from '../../api-lib/handlers/lenderBorrowers';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    await handle(req, res);
  } catch (error) {
    if (res.headersSent) return;
    res.status(503).json({
      error: 'service_unavailable',
      service: 'Credora indexer',
      detail: error instanceof Error ? error.message : 'Borrower list handler failed',
      message: 'Credora indexer is unavailable. No substitute data was generated.',
    });
  }
}
