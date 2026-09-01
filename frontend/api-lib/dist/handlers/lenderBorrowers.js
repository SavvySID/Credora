"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handle = handle;
const indexer_1 = require("../indexer");
const http_1 = require("../http");
async function handle(req, res) {
    if (!(0, http_1.methodGuard)(req, res, ['GET']))
        return;
    const limitRaw = Number.parseInt(String(req.query.limit ?? '50'), 10);
    const limit = Number.isFinite(limitRaw) ? limitRaw : 50;
    try {
        const payload = await indexer_1.indexerClient.borrowers(limit);
        (0, http_1.noStore)(res);
        res.status(200).json(payload);
    }
    catch (error) {
        if (error instanceof indexer_1.IndexerUnavailableError) {
            (0, http_1.unavailable)(res, 'Credora indexer', error.message);
            return;
        }
        throw error;
    }
}
