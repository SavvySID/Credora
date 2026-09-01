import type { VercelRequest, VercelResponse } from '@vercel/node';
import { IndexerUnavailableError, indexerClient } from '../_lib/indexer';
import { methodGuard, noStore, unavailable } from '../_lib/http';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res, ['GET'])) return;

  const limitRaw = Number.parseInt(String(req.query.limit ?? '50'), 10);
  const limit = Number.isFinite(limitRaw) ? limitRaw : 50;

  try {
    const payload = await indexerClient.borrowers(limit);
    noStore(res);
    res.status(200).json(payload);
  } catch (error) {
    if (error instanceof IndexerUnavailableError) {
      unavailable(res, 'Credora indexer', error.message);
      return;
    }
    throw error;
  }
}
