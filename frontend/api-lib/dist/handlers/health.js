"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handle = handle;
const indexer_1 = require("../indexer");
const computeProbe_1 = require("../computeProbe");
const galileo_1 = require("../galileo");
const http_1 = require("../http");
/**
 * Real service status. Every field here is the result of an actual probe, so
 * the UI status indicators reflect reachability rather than a constant.
 */
async function handle(req, res) {
    if (!(0, http_1.methodGuard)(req, res, ['GET']))
        return;
    const configured = (0, indexer_1.indexerConfigured)();
    const [indexerHealth, compute, chainProbe, explorerProbe] = await Promise.all([
        configured.ok
            ? indexer_1.indexerClient.health().catch((error) => ({
                __error: error instanceof indexer_1.IndexerUnavailableError ? error.message : String(error),
            }))
            : Promise.resolve({ __error: configured.reason }),
        (0, computeProbe_1.probeCompute)(),
        (0, galileo_1.probeGalileoChain)(),
        (0, galileo_1.probeGalileoExplorer)(),
    ]);
    const indexerError = indexerHealth.__error ?? null;
    const indexerOk = indexerError === null && indexerHealth.healthy === true;
    const upstream = indexerError
        ? null
        : indexerHealth;
    const services = {
        indexer: {
            name: 'Credora indexer',
            online: indexerOk,
            detail: indexerError,
        },
        chain: {
            name: '0G Chain',
            online: upstream?.chain?.reachable ?? chainProbe.reachable,
            chainId: upstream?.chain?.chainId ?? chainProbe.chainId,
            blockNumber: upstream?.chain?.blockNumber ?? chainProbe.blockNumber,
            chainIdMatches: upstream?.chain?.chainIdMatches ?? chainProbe.chainIdMatches,
            detail: (upstream?.chain?.reachable ?? chainProbe.reachable)
                ? null
                : (upstream?.chain ? 'RPC unreachable' : chainProbe.error),
        },
        storage: {
            name: '0G Storage',
            online: upstream?.storage?.reachable ?? false,
            trustedNodes: upstream?.storage?.trustedNodes ?? null,
            writes: upstream?.storage?.writeCapability ?? {
                available: false,
                blockedReason: 'Indexer unreachable',
            },
            detail: upstream?.storage?.reachable === false ? 'Storage indexer unreachable' : null,
        },
        compute: {
            name: '0G Compute',
            online: compute.reachable && compute.configured,
            reachable: compute.reachable,
            configured: compute.configured,
            models: compute.models,
            detail: compute.blockedReason ?? compute.error,
        },
        explorer: {
            name: '0G Chain Scan',
            online: upstream?.explorer?.reachable ?? explorerProbe.reachable,
            detail: (upstream?.explorer?.reachable ?? explorerProbe.reachable)
                ? null
                : explorerProbe.error ?? 'Explorer API unreachable',
        },
    };
    const healthy = services.indexer.online && services.chain.online && services.storage.online;
    // HTTP 200 means the probe ran. `healthy` is still false when indexer/storage
    // are down so the UI can show 1/3 without the browser logging a failed request.
    (0, http_1.noStore)(res);
    res.status(200).json({
        healthy,
        checkedAt: new Date().toISOString(),
        services,
        capabilities: upstream?.capabilities ?? null,
        index: upstream?.index ?? null,
    });
}
