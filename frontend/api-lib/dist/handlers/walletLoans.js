"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handle = handle;
const indexer_1 = require("../indexer");
const http_1 = require("../http");
async function handle(req, res) {
    if (!(0, http_1.methodGuard)(req, res, ['GET']))
        return;
    const address = (0, http_1.readAddress)(req, res);
    if (!address)
        return;
    try {
        const result = await (0, indexer_1.loadLoans)(address);
        (0, http_1.cacheFor)(res, 10);
        res.status(200).json(result);
    }
    catch (error) {
        if (error instanceof indexer_1.IndexerUnavailableError) {
            (0, http_1.unavailable)(res, 'Credora indexer', error.message);
            return;
        }
        throw error;
    }
}
