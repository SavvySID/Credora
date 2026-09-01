import type { VercelRequest, VercelResponse } from '@vercel/node';
import { IndexerUnavailableError, indexerClient } from '../indexer';
import { cacheFor, methodGuard, readAddress, unavailable } from '../http';

export async function handle(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res, ['GET'])) return;

  const address = readAddress(req, res);
  if (!address) return;

  try {
    const result = await indexerClient.loans(address);
    cacheFor(res, 10);
    res.status(200).json(result);
  } catch (error) {
    if (error instanceof IndexerUnavailableError) {
      unavailable(res, 'Credora indexer', error.message);
      return;
    }
    throw error;
  }
}
