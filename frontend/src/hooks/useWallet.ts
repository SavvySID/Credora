import { useAccount, useBalance, useDisconnect } from 'wagmi'

export const useWallet = () => {
  const { address: account, isConnected } = useAccount()
  const { data: balanceData } = useBalance({
    address: account,
  })
  const { disconnect } = useDisconnect()

  const balance = balanceData ? balanceData.formatted : null

  const connectWallet = async () => {
    // Rainbow Kit handles the connection through its modal
    // This function is kept for compatibility but doesn't need to do anything
    // as the ConnectButton component handles the connection
  }

  const disconnectWallet = () => {
    disconnect()
  }

  return {
    account,
    balance,
    isConnected,
    isLoading: false, // Rainbow Kit handles loading state
    connectWallet,
    disconnectWallet,
    provider: null, // Wagmi handles provider internally
    signer: null, // Wagmi handles signer internally
  }
}
