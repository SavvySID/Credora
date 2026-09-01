import type { VercelRequest, VercelResponse } from '@vercel/node';
import { IndexerUnavailableError, indexerClient } from '../../../api-lib/indexer';
import { cacheFor, methodGuard, readAddress, unavailable, withApiHandler } from '../../../api-lib/http';

/**
 * Credora records for a wallet, each carrying its real verification state.
 * Only records with `verification.status === 'verified'` have been read back
 * from 0G Storage and hash-checked.
 */
export default withApiHandler(async function handler(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res, ['GET'])) return;

  const address = readAddress(req, res);
  if (!address) return;

  const eventTypesRaw = Array.isArray(req.query.eventTypes)
    ? req.query.eventTypes[0]
    : req.query.eventTypes;
  const eventTypes = eventTypesRaw ? eventTypesRaw.split(',').filter(Boolean) : undefined;

  const limitRaw = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit;
  const parsedLimit = Number.parseInt(limitRaw ?? '100', 10);
  const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 500) : 100;

  try {
    const result = await indexerClient.records(address, eventTypes, limit);
    cacheFor(res, 10);
    res.status(200).json(result);
  } catch (error) {
    if (error instanceof IndexerUnavailableError) {
      unavailable(res, 'Credora indexer', error.message);
      return;
    }
    throw error;
  }
});
