import { Contract, JsonRpcProvider, Network } from 'ethers';
import { config, loanIndexingCapability } from '../config';
import { LOAN_ABI, readDeploymentArtifact } from './abi';
import { createLogger } from '../logger';

const log = createLogger('chain:provider');

let provider: JsonRpcProvider | null = null;

export function getProvider(): JsonRpcProvider {
  if (provider) return provider;

  // Pinning the network avoids an extra eth_chainId round trip per call and
  // makes a misconfigured RPC fail loudly instead of silently indexing
  // the wrong chain.
  provider = new JsonRpcProvider(config.chain.rpcUrl, Network.from(config.chain.chainId), {
    staticNetwork: Network.from(config.chain.chainId),
  });

  return provider;
}

export interface ResolvedLoanContract {
  address: string;
  deployBlock: number;
  contract: Contract;
}

let resolvedLoan: ResolvedLoanContract | null | undefined;

/**
 * Returns null when Loan.sol has not been deployed yet. Callers must treat
 * null as BLOCKED rather than substituting placeholder data.
 */
export function getLoanContract(): ResolvedLoanContract | null {
  if (resolvedLoan !== undefined) return resolvedLoan;

  let address = config.loan.address;
  let deployBlock = config.loan.deployBlock;

  if (!address || deployBlock === null) {
    const artifact = readDeploymentArtifact();
    if (artifact) {
      address = address ?? artifact.address;
      deployBlock = deployBlock ?? artifact.deployBlock;
    }
  }

  if (!address || deployBlock === null || !Number.isFinite(deployBlock)) {
    log.warn(`Loan contract unavailable: ${loanIndexingCapability.blockedReason}`);
    resolvedLoan = null;
    return null;
  }

  resolvedLoan = {
    address,
    deployBlock,
    contract: new Contract(address, LOAN_ABI as unknown as string[], getProvider()),
  };

  log.info('Loan contract resolved', { address, deployBlock });
  return resolvedLoan;
}

export async function getChainHead(): Promise<number> {
  return getProvider().getBlockNumber();
}

export interface ChainProbe {
  reachable: boolean;
  chainId: number | null;
  blockNumber: number | null;
  error: string | null;
}

export async function probeChain(): Promise<ChainProbe> {
  try {
    const rpc = getProvider();
    const [network, blockNumber] = await Promise.all([rpc.getNetwork(), rpc.getBlockNumber()]);
    return {
      reachable: true,
      chainId: Number(network.chainId),
      blockNumber,
      error: null,
    };
  } catch (error) {
    return {
      reachable: false,
      chainId: null,
      blockNumber: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
