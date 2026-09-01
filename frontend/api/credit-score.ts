import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handle } from '../api-lib/handlers/creditScore';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    await handle(req, res);
  } catch (error) {
    if (res.headersSent) return;
    res.status(503).json({
      error: 'service_unavailable',
      service: 'Credora API',
      detail: error instanceof Error ? error.message : 'Credit score handler failed',
      message: 'Credit score could not be produced. No substitute data was generated.',
    });
  }
}
