import { useCallback, useEffect, useState } from 'react';
import { readContract } from 'wagmi/actions';
import { formatEther } from 'viem';
import { loanAbi } from '@/abi/loan';
import { config, ogGalileo } from '@/config/wagmi';
import { useWallet } from '@/hooks/useWallet';
import {
  ORIGINATION_DEPOSIT_WEI,
  MIN_REMAINING_BALANCE_WEI,
  loanContractAddress,
  originationDepositEth,
} from '@/lib/loanTx';

export interface ContractEligibility {
  configured: boolean;
  onGalileo: boolean;
  hasActiveLoan: boolean | null;
  ownerSetTxCount: number | null;
  minTxCount: number;
  remainingAfterDepositOk: boolean | null;
  canSubmitDeposit: boolean | null;
  reasons: string[];
  ready: boolean;
}

const EMPTY: ContractEligibility = {
  configured: false,
  onGalileo: false,
  hasActiveLoan: null,
  ownerSetTxCount: null,
  minTxCount: 10,
  remainingAfterDepositOk: null,
  canSubmitDeposit: null,
  reasons: ['Loan contract address is not configured.'],
  ready: false,
};

/**
 * Reads Loan.sol requirements. `getBorrowerTxCount` is an owner-set counter,
 * not the wallet's real Galileo nonce.
 */
export function useLoanEligibility() {
  const { account, balanceWei, chainId } = useWallet();
  const [state, setState] = useState<ContractEligibility>(EMPTY);

  const refresh = useCallback(async () => {
    let address: `0x${string}`;
    try {
      address = loanContractAddress();
    } catch {
      setState(EMPTY);
      return;
    }

    if (!account) {
      setState({
        ...EMPTY,
        configured: true,
        reasons: ['Connect a wallet on 0G Galileo.'],
      });
      return;
    }

    const onGalileo = chainId === ogGalileo.id;
    const balanceExact = balanceWei ?? 0n;
    const canSubmitDeposit = balanceExact >= ORIGINATION_DEPOSIT_WEI;
    const remainingAfterDepositOk = balanceExact >= ORIGINATION_DEPOSIT_WEI + MIN_REMAINING_BALANCE_WEI;

    if (!onGalileo) {
      setState({
        configured: true,
        onGalileo: false,
        hasActiveLoan: null,
        ownerSetTxCount: null,
        minTxCount: 10,
        remainingAfterDepositOk,
        canSubmitDeposit,
        reasons: [`Switch to 0G Galileo (chain ${ogGalileo.id}).`],
        ready: false,
      });
      return;
    }

    try {
      const [hasActiveLoan, ownerSetTxCount, minTxCount] = await Promise.all([
        readContract(config, {
          address,
          abi: loanAbi,
          functionName: 'hasActiveLoan',
          args: [account],
        }),
        readContract(config, {
          address,
          abi: loanAbi,
          functionName: 'getBorrowerTxCount',
          args: [account],
        }),
        readContract(config, {
          address,
          abi: loanAbi,
          functionName: 'MIN_TX_COUNT',
        }),
      ]);

      const count = Number(ownerSetTxCount);
      const min = Number(minTxCount);
      const reasons: string[] = [];

      if (hasActiveLoan) {
        reasons.push('Loan.sol already has an active loan for this wallet (one at a time).');
      }
      if (!canSubmitDeposit) {
        reasons.push(
          `requestLoan must attach ${originationDepositEth()} 0G. That deposit stays in the contract; it is not the loan principal.`,
        );
      }
      if (!remainingAfterDepositOk) {
        reasons.push(
          `After the ${originationDepositEth()} 0G deposit, your wallet must still hold at least ${formatEther(MIN_REMAINING_BALANCE_WEI)} 0G.`,
        );
      }
      if (count < min) {
        reasons.push(
          `Loan.sol getBorrowerTxCount is ${count}; it must be at least ${min}. This counter is set by the contract owner via setBorrowerTxCount, not read from your wallet's real transaction history.`,
        );
      }

      setState({
        configured: true,
        onGalileo: true,
        hasActiveLoan: Boolean(hasActiveLoan),
        ownerSetTxCount: count,
        minTxCount: min,
        remainingAfterDepositOk,
        canSubmitDeposit,
        reasons,
        ready: reasons.length === 0,
      });
    } catch (error) {
      setState({
        configured: true,
        onGalileo,
        hasActiveLoan: null,
        ownerSetTxCount: null,
        minTxCount: 10,
        remainingAfterDepositOk,
        canSubmitDeposit,
        reasons: [
          error instanceof Error
            ? error.message
            : 'Could not read Loan.sol eligibility from chain.',
        ],
        ready: false,
      });
    }
  }, [account, balanceWei, chainId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { ...state, refresh };
}
