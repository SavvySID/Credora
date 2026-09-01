import type { VercelRequest, VercelResponse } from '@vercel/node';
import { IndexerUnavailableError, loadWallet } from '../indexer';
import { cacheFor, methodGuard, readAddress, unavailable } from '../http';

/**
 * Real wallet state from 0G Galileo: balance and nonce from the chain RPC,
 * transaction history from 0G Chain Scan.
 */
export async function handle(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res, ['GET'])) return;

  const address = readAddress(req, res);
  if (!address) return;

  try {
    const snapshot = await loadWallet(address, req.query.refresh === 'true');
    cacheFor(res, 15);
    res.status(200).json(snapshot);
  } catch (error) {
    if (error instanceof IndexerUnavailableError) {
      unavailable(res, 'Credora indexer', error.message);
      return;
    }
    throw error;
  }
}
