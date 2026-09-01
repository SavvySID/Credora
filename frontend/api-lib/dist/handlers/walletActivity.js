"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handle = handle;
const indexer_1 = require("../indexer");
const http_1 = require("../http");
/**
 * Real wallet state from 0G Galileo: balance and nonce from the chain RPC,
 * transaction history from 0G Chain Scan.
 */
async function handle(req, res) {
    if (!(0, http_1.methodGuard)(req, res, ['GET']))
        return;
    const address = (0, http_1.readAddress)(req, res);
    if (!address)
        return;
    try {
        const snapshot = await (0, indexer_1.loadWallet)(address, req.query.refresh === 'true');
        (0, http_1.cacheFor)(res, 15);
        res.status(200).json(snapshot);
    }
    catch (error) {
        if (error instanceof indexer_1.IndexerUnavailableError) {
            (0, http_1.unavailable)(res, 'Credora indexer', error.message);
            return;
        }
        throw error;
    }
}
