import { useCallback } from 'react';
import { parseEther, type Hash, type TransactionReceipt } from 'viem';
import {
  getAccount,
  simulateContract,
  switchChain,
  waitForTransactionReceipt,
  writeContract,
} from 'wagmi/actions';
import { loanAbi } from '@/abi/loan';
import { config, ogGalileo } from '@/config/wagmi';
import {
  ORIGINATION_DEPOSIT_WEI,
  LoanTxError,
  loanApprovedFromReceipt,
  loanContractAddress,
  mapWriteError,
  type LoanTxPhase,
} from '@/lib/loanTx';

export type LoanTxStatusHandler = (phase: LoanTxPhase, txHash?: Hash) => void;

export interface ConfirmedLoanTx {
  hash: Hash;
  receipt: TransactionReceipt;
}

async function ensureGalileo(): Promise<`0x${string}`> {
  const account = getAccount(config);
  if (!account.address) {
    throw new LoanTxError('Connect a wallet to submit this transaction.', 'not_connected');
  }
  if (account.chainId !== ogGalileo.id) {
    try {
      await switchChain(config, { chainId: ogGalileo.id });
    } catch (error) {
      throw mapWriteError(error);
    }
  }
  return account.address;
}

async function waitForSuccess(
  hash: Hash,
  onStatus?: LoanTxStatusHandler,
): Promise<TransactionReceipt> {
  onStatus?.('pending', hash);

  let receipt: TransactionReceipt;
  try {
    receipt = await waitForTransactionReceipt(config, { hash, chainId: ogGalileo.id });
  } catch (error) {
    throw mapWriteError(error, hash);
  }

  if (receipt.status !== 'success') {
    throw new LoanTxError('Transaction reverted on chain.', 'reverted', hash);
  }

  onStatus?.('confirmed', hash);
  return receipt;
}

/**
 * Submits requestLoan / repayLoan through the connected wallet.
 * Confirmation is a mined receipt. Indexer catch-up is the caller's job.
 */
export function useLoanTx() {
  const requestLoan = useCallback(
    async (
      amountEth: number,
      onStatus?: LoanTxStatusHandler,
    ): Promise<ConfirmedLoanTx & { loanId: Hash }> => {
      if (!(amountEth > 0)) {
        throw new LoanTxError('Enter an amount greater than zero.', 'unknown');
      }

      const account = await ensureGalileo();
      const address = loanContractAddress();
      onStatus?.('wallet');

      let hash: Hash;
      try {
        const simulation = await simulateContract(config, {
          address,
          abi: loanAbi,
          functionName: 'requestLoan',
          args: [parseEther(amountEth.toFixed(18))],
          value: ORIGINATION_DEPOSIT_WEI,
          account,
          chainId: ogGalileo.id,
        });
        hash = await writeContract(config, simulation.request);
      } catch (error) {
        throw mapWriteError(error);
      }

      const receipt = await waitForSuccess(hash, onStatus);
      const approved = loanApprovedFromReceipt(receipt, account);
      if (!approved) {
        throw new LoanTxError(
          'Transaction succeeded but no LoanApproved event was found. No loan is treated as created.',
          'reverted',
          hash,
        );
      }

      return { hash, receipt, loanId: approved.loanId };
    },
    [],
  );

  const repayLoan = useCallback(
    async (valueWei: bigint, onStatus?: LoanTxStatusHandler): Promise<ConfirmedLoanTx> => {
      const account = await ensureGalileo();
      const address = loanContractAddress();
      onStatus?.('wallet');

      let hash: Hash;
      try {
        const simulation = await simulateContract(config, {
          address,
          abi: loanAbi,
          functionName: 'repayLoan',
          value: valueWei,
          account,
          chainId: ogGalileo.id,
        });
        hash = await writeContract(config, simulation.request);
      } catch (error) {
        throw mapWriteError(error);
      }

      const receipt = await waitForSuccess(hash, onStatus);
      return { hash, receipt };
    },
    [],
  );

  return { requestLoan, repayLoan };
}
