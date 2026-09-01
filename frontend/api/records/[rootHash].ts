import type { VercelRequest, VercelResponse } from '@vercel/node';
import { IndexerUnavailableError, indexerClient } from '../_lib/indexer';
import { cacheFor, methodGuard, noStore, unavailable, withApiHandler } from '../_lib/http';

/**
 * Retrieves a Credora record from 0G Storage by root hash and verifies it by
 * recomputing the content hash.
 *
 * A 200 here is the evidence behind the "0G Verified" marker. Anything else
 * means the record could not be retrieved or did not verify, and the caller
 * must not present it as verified.
 */
export default withApiHandler(async function handler(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res, ['GET'])) return;

  const raw = Array.isArray(req.query.rootHash) ? req.query.rootHash[0] : req.query.rootHash;

  if (!raw || !/^0x[0-9a-fA-F]{64}$/.test(raw)) {
    res.status(400).json({ error: 'invalid_root_hash', message: 'Expected a 0x 32-byte hash' });
    return;
  }

  try {
    const result = await indexerClient.recordByRoot(raw);
    // Content addressed and immutable once written, so a verified record can
    // be cached hard.
    if (result.verification.status === 'verified') cacheFor(res, 3600);
    else noStore(res);

    res.status(200).json(result);
  } catch (error) {
    if (error instanceof IndexerUnavailableError) {
      // A 502 from the worker means retrieval or verification failed, which is
      // a real answer about the record rather than an outage.
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
});
