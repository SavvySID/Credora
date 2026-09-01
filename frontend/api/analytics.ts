import type { VercelRequest, VercelResponse } from '@vercel/node';
import { IndexerUnavailableError, indexerClient } from './lib/indexer';
import { methodGuard, noStore, unavailable, withApiHandler } from './lib/http';

export default withApiHandler(async function handler(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res, ['GET'])) return;

  try {
    const summary = await indexerClient.analytics();
    noStore(res);
    res.status(200).json(summary);
  } catch (error) {
    if (error instanceof IndexerUnavailableError) {
      unavailable(res, 'Credora indexer', error.message);
      return;
    }
    throw error;
  }
});
