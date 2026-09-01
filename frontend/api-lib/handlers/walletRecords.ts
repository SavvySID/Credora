import type { VercelRequest, VercelResponse } from '@vercel/node';
import { IndexerUnavailableError, loadRecords } from '../indexer';
import { cacheFor, methodGuard, readAddress, unavailable } from '../http';

export async function handle(req: VercelRequest, res: VercelResponse) {
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
    const result = await loadRecords(address, eventTypes, limit);
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
