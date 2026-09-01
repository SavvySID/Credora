import type { VercelRequest, VercelResponse } from '@vercel/node';
import { IndexerUnavailableError, indexerClient } from '../indexer';
import { cacheFor, methodGuard, noStore, unavailable } from '../http';

export async function handle(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res, ['GET'])) return;

  const raw = Array.isArray(req.query.rootHash) ? req.query.rootHash[0] : req.query.rootHash;

  if (!raw || !/^0x[0-9a-fA-F]{64}$/.test(raw)) {
    res.status(400).json({ error: 'invalid_root_hash', message: 'Expected a 0x 32-byte hash' });
    return;
  }

  try {
    const result = await indexerClient.recordByRoot(raw);
    if (result.verification.status === 'verified') cacheFor(res, 3600);
    else noStore(res);

    res.status(200).json(result);
  } catch (error) {
    if (error instanceof IndexerUnavailableError) {
      if (error.status === 502) {
        noStore(res);
        res.status(200).json({
          rootHash: raw,
          indexed: false,
          verification: { status: 'failed', detail: error.message, verifiedAt: null },
          record: null,
        });
        return;
      }

      unavailable(res, 'Credora indexer', error.message);
      return;
    }
    throw error;
  }
}
