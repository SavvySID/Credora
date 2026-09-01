import type { VercelRequest, VercelResponse } from '@vercel/node';
import { IndexerUnavailableError, indexerClient, indexerConfigured } from '../indexer';
import { probeCompute } from '../computeProbe';
import { probeGalileoChain, probeGalileoExplorer } from '../galileo';
import { methodGuard, noStore } from '../http';

/**
 * Real service status. Every field here is the result of an actual probe, so
 * the UI status indicators reflect reachability rather than a constant.
 */
export async function handle(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res, ['GET'])) return;

  const configured = indexerConfigured();

  const [indexerHealth, compute, chainProbe, explorerProbe] = await Promise.all([
    configured.ok
      ? indexerClient.health().catch((error: unknown) => ({
          __error:
            error instanceof IndexerUnavailableError ? error.message : String(error),
        }))
      : Promise.resolve({ __error: configured.reason }),
    probeCompute(),
    probeGalileoChain(),
    probeGalileoExplorer(),
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

  noStore(res);
  res.status(healthy ? 200 : 503).json({
    healthy,
    checkedAt: new Date().toISOString(),
    services,
    capabilities: upstream?.capabilities ?? null,
    index: upstream?.index ?? null,
  });
}
