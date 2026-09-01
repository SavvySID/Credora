"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handle = handle;
const indexer_1 = require("../indexer");
const http_1 = require("../http");
async function handle(req, res) {
    if (!(0, http_1.methodGuard)(req, res, ['GET']))
        return;
    try {
        const summary = await indexer_1.indexerClient.analytics();
        (0, http_1.noStore)(res);
        res.status(200).json(summary);
    }
    catch (error) {
        if (error instanceof indexer_1.IndexerUnavailableError) {
            (0, http_1.unavailable)(res, 'Credora indexer', error.message);
            return;
        }
        throw error;
    }
}
