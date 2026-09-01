import { useAccount, useBalance, useDisconnect, useSwitchChain, useTransactionCount } from 'wagmi';
import { ogGalileo } from '@/config/wagmi';

/**
 * Same public surface as the original hook, extended with the network and the
 * on-chain nonce so the credit engine can score against real wallet activity.
 */
export const useWallet = () => {
  const { address: account, isConnected, isConnecting, chain } = useAccount();

  const { data: balanceData, isLoading: isBalanceLoading, refetch: refetchBalance } = useBalance({
    address: account,
  });

  const { data: txCount, isLoading: isTxCountLoading } = useTransactionCount({
    address: account,
  });

  const { disconnect } = useDisconnect();
  const { switchChainAsync } = useSwitchChain();

  const balance = balanceData ? balanceData.formatted : null;

  const connectWallet = async () => {
    // RainbowKit's ConnectButton owns the connection modal; kept for API compatibility.
  };

  const disconnectWallet = () => {
    disconnect();
  };

  const switchToGalileo = async () => {
    if (chain?.id === ogGalileo.id) return;
    await switchChainAsync({ chainId: ogGalileo.id });
  };

  return {
    account: account ?? null,
    balance,
    balanceWei: balanceData?.value ?? null,
    balanceSymbol: balanceData?.symbol ?? '0G',
    transactionCount: typeof txCount === 'number' ? txCount : null,
    chainName: chain?.name ?? null,
    chainId: chain?.id ?? null,
    isConnected,
    isConnecting,
    isLoading: isBalanceLoading || isTxCountLoading,
    connectWallet,
    disconnectWallet,
    refetchBalance,
    switchToGalileo,
    isGalileo: chain?.id === ogGalileo.id,
  };
};
