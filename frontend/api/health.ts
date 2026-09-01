import type { VercelRequest, VercelResponse } from '@vercel/node';
import { IndexerUnavailableError, indexerClient, indexerConfigured } from './lib/indexer';
import { probeCompute } from './lib/computeProbe';
import { methodGuard, noStore, withApiHandler } from './lib/http';

/**
 * Real service status. Every field here is the result of an actual probe, so
 * the UI status indicators reflect reachability rather than a constant.
 */
export default withApiHandler(async function handler(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res, ['GET'])) return;

  const configured = indexerConfigured();

  const [indexerHealth, compute] = await Promise.all([
    configured.ok
      ? indexerClient.health().catch((error: unknown) => ({
          __error:
            error instanceof IndexerUnavailableError ? error.message : String(error),
        }))
      : Promise.resolve({ __error: configured.reason }),
    probeCompute(),
  ]);

  const indexerError = (indexerHealth as { __error?: string }).__error ?? null;
  const indexerOk = indexerError === null && (indexerHealth as { healthy?: boolean }).healthy === true;

  const upstream = indexerError
    ? null
    : (indexerHealth as {
        chain?: { reachable: boolean; chainId: number | null; blockNumber: number | null; chainIdMatches: boolean | null };
        storage?: { reachable: boolean; trustedNodes: number | null; writeCapability: { available: boolean; blockedReason: string | null } };
        explorer?: { reachable: boolean };
        capabilities?: Record<string, { available: boolean; blockedReason: string | null }>;
        index?: { total: number; stored: number; verified: number; cursorBlock: number | null };
      });

  const services = {
    indexer: {
      name: 'Credora indexer',
      online: indexerOk,
      detail: indexerError,
    },
    chain: {
      name: '0G Chain',
      online: upstream?.chain?.reachable ?? false,
      chainId: upstream?.chain?.chainId ?? null,
      blockNumber: upstream?.chain?.blockNumber ?? null,
      chainIdMatches: upstream?.chain?.chainIdMatches ?? null,
      detail: upstream?.chain?.reachable === false ? 'RPC unreachable' : null,
    },
    storage: {
      name: '0G Storage',
      online: upstream?.storage?.reachable ?? false,
      trustedNodes: upstream?.storage?.trustedNodes ?? null,
      // Read and write are distinct: reads work with no credential, writes
      // need a funded signer.
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
      online: upstream?.explorer?.reachable ?? false,
      detail: upstream?.explorer?.reachable === false ? 'Explorer API unreachable' : null,
    },
  };

  const healthy = services.indexer.online && services.chain.online && services.storage.online;

  noStore(res);
  res.status(healthy ? 200 : 503).json({
    healthy,
    checkedAt: new Date().toISOString(),
    services,
    capabilities: upstream?.capabilities ?? null,
    index: upstream?.index ?? null,
  });
});
