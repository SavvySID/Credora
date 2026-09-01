"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.methodGuard = methodGuard;
exports.readAddress = readAddress;
exports.cacheFor = cacheFor;
exports.noStore = noStore;
exports.unavailable = unavailable;
function methodGuard(req, res, allowed) {
    if (!allowed.includes(req.method ?? 'GET')) {
        res.setHeader('Allow', allowed.join(', '));
        res.status(405).json({ error: 'method_not_allowed' });
        return false;
    }
    return true;
}
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
function readAddress(req, res) {
    const fromAddress = Array.isArray(req.query.address) ? req.query.address[0] : req.query.address;
    const fromWallet = Array.isArray(req.query.wallet) ? req.query.wallet[0] : req.query.wallet;
    const raw = fromAddress || fromWallet;
    if (!raw || !ADDRESS.test(raw)) {
        res.status(400).json({ error: 'invalid_address', message: 'Expected a 0x EVM address' });
        return null;
    }
    return raw.toLowerCase();
}
/** Short shared cache with revalidation. Wallet data changes on every block. */
function cacheFor(res, seconds) {
    res.setHeader('Cache-Control', `public, s-maxage=${seconds}, stale-while-revalidate=${seconds * 4}`);
}
function noStore(res) {
    res.setHeader('Cache-Control', 'no-store');
}
/**
 * Maps an upstream failure to a response that says what is unavailable.
 * Never substitutes placeholder data for a failed dependency.
 */
function unavailable(res, service, detail, status = 503) {
    noStore(res);
    res.status(status).json({
        error: 'service_unavailable',
        service,
        detail,
        message: `${service} is unavailable. No substitute data was generated.`,
    });
}
