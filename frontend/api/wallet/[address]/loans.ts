import type { VercelRequest, VercelResponse } from '@vercel/node';
import { IndexerUnavailableError, indexerClient } from '../../lib/indexer';
import { cacheFor, methodGuard, readAddress, unavailable, withApiHandler } from '../../lib/http';

/**
 * Loans for a wallet, projected from indexed Loan.sol events and reconciled
 * against live contract state.
 *
 * When Loan.sol is not deployed the response carries `indexing.available:
 * false` with a reason and an empty list. Empty means "no on-chain loans",
 * never "here is a sample loan".
 */
export default withApiHandler(async function handler(req: VercelRequest, res: VercelResponse) {
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
});
