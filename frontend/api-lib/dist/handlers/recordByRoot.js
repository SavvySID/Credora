"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handle = handle;
const indexer_1 = require("../indexer");
const http_1 = require("../http");
async function handle(req, res) {
    if (!(0, http_1.methodGuard)(req, res, ['GET']))
        return;
    const raw = Array.isArray(req.query.rootHash) ? req.query.rootHash[0] : req.query.rootHash;
    if (!raw || !/^0x[0-9a-fA-F]{64}$/.test(raw)) {
        res.status(400).json({ error: 'invalid_root_hash', message: 'Expected a 0x 32-byte hash' });
        return;
    }
    try {
        const result = await indexer_1.indexerClient.recordByRoot(raw);
        if (result.verification.status === 'verified')
            (0, http_1.cacheFor)(res, 3600);
        else
            (0, http_1.noStore)(res);
        res.status(200).json(result);
    }
    catch (error) {
        if (error instanceof indexer_1.IndexerUnavailableError) {
            if (error.status === 502) {
                (0, http_1.noStore)(res);
                res.status(200).json({
                    rootHash: raw,
                    indexed: false,
                    verification: { status: 'failed', detail: error.message, verifiedAt: null },
                    record: null,
                });
                return;
            }
            (0, http_1.unavailable)(res, 'Credora indexer', error.message);
            return;
        }
        throw error;
    }
}
