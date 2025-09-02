import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { mainnet, polygon, optimism, arbitrum, base, sepolia } from 'wagmi/chains'

export const config = getDefaultConfig({
  appName: 'Credora',
  projectId: 'c4f79cc821944d9680842e34466bfbd9', // WalletConnect Cloud project ID
  chains: [mainnet, polygon, optimism, arbitrum, base, sepolia],
  ssr: true,
})
