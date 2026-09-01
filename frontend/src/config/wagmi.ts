import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { defineChain, type Address } from 'viem';
import { mainnet, polygon, optimism, arbitrum, base, sepolia } from 'wagmi/chains';
import { publicConfig } from '@/services/0g-config';

export const ogGalileo = defineChain({
  id: 16602,
  name: '0G Galileo',
  nativeCurrency: { name: '0G', symbol: '0G', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://evmrpc-testnet.0g.ai'] },
  },
  blockExplorers: {
    default: { name: '0G Chain Scan', url: publicConfig.explorerUrl },
  },
  testnet: true,
});

/** Deployed Loan.sol on Galileo. Null until VITE_LOAN_CONTRACT_ADDRESS is set. */
export const deployedLoanContract: Address | null = publicConfig.loanContractAddress
  ? (publicConfig.loanContractAddress as Address)
  : null;

export const config = getDefaultConfig({
  appName: 'Credora',
  // WalletConnect project IDs are public client identifiers, not secrets.
  projectId: publicConfig.walletConnectProjectId || 'c4f79cc821944d9680842e34466bfbd9',
  chains: [ogGalileo, sepolia, mainnet, polygon, optimism, arbitrum, base],
  ssr: true,
});
