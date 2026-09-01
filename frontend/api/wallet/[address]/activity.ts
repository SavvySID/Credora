import type { VercelRequest, VercelResponse } from '@vercel/node';
import { IndexerUnavailableError, indexerClient } from '../../_lib/indexer';
import { cacheFor, methodGuard, readAddress, unavailable, withApiHandler } from '../../_lib/http';

/**
 * Real wallet state from 0G Galileo: balance and nonce from the chain RPC,
 * transaction history from 0G Chain Scan.
 *
 * A degraded snapshot (history unavailable) is returned as-is with the flag
 * set, so the UI can say the history is unknown instead of showing an empty
 * list as though the wallet were inactive.
 */
export default withApiHandler(async function handler(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res, ['GET'])) return;

  const address = readAddress(req, res);
  if (!address) return;

  try {
    const snapshot = await indexerClient.wallet(address, req.query.refresh === 'true');
    cacheFor(res, 15);
    res.status(200).json(snapshot);
  } catch (error) {
    if (error instanceof IndexerUnavailableError) {
      unavailable(res, 'Credora indexer', error.message);
      return;
    }
    throw error;
  }
});
