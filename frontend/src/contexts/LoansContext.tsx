import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { type Hash } from 'viem';
import { zeroGStorageService, type LendingRecord } from '@/services/0g-storage';
import { api, type LoanDto } from '@/services/api';
import { toLoanView, type LoanView } from '@/lib/loans';
import { LoanTxError, repaymentWei, type LoanTxPhase } from '@/lib/loanTx';
import { useLoanTx } from '@/hooks/useLoanTx';
import { useWallet } from '@/hooks/useWallet';

export type { LoanTxPhase };

interface LoansContextValue {
  loans: LoanView[];
  activeLoans: LoanView[];
  isLoading: boolean;
  error: string | null;
  indexingAvailable: boolean;
  indexingReason: string | null;
  createLoan: (
    amount: number,
    onStatus?: (phase: LoanTxPhase, txHash?: Hash) => void,
  ) => Promise<LoanView>;
  repayLoan: (
    loanId: string,
    onStatus?: (phase: LoanTxPhase, txHash?: Hash) => void,
  ) => Promise<void>;
  getLoan: (loanId: string) => LoanView | undefined;
  refresh: () => Promise<void>;
}

const LoansContext = createContext<LoansContextValue | undefined>(undefined);

const INDEX_POLL_MS = 3_000;
const INDEX_TIMEOUT_MS = 180_000;

async function pollLoan(
  wallet: string,
  predicate: (loans: LoanDto[]) => LoanDto | undefined,
  txHash: Hash,
): Promise<LoanDto> {
  const started = Date.now();
  let lastError: Error | null = null;

  while (Date.now() - started < INDEX_TIMEOUT_MS) {
    try {
      const result = await api.walletLoans(wallet);
      const match = predicate(result.loans);
      if (match) return match;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Indexer request failed');
    }
    await new Promise((resolve) => setTimeout(resolve, INDEX_POLL_MS));
  }

  throw new LoanTxError(
    lastError
      ? `Transaction confirmed (${txHash}) but the indexer is unavailable: ${lastError.message}`
      : `Transaction confirmed (${txHash}) but the indexer has not recorded the loan yet. Check the explorer and retry shortly.`,
    'indexer_unavailable',
    txHash,
  );
}

export function LoansProvider({ children }: { children: ReactNode }) {
  const { account, refetchBalance } = useWallet();
  const { requestLoan, repayLoan: submitRepay } = useLoanTx();

  const [records, setRecords] = useState<LendingRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [indexingAvailable, setIndexingAvailable] = useState(false);
  const [indexingReason, setIndexingReason] = useState<string | null>(
    'Loan contract is not deployed or configured',
  );

  const refresh = useCallback(async () => {
    if (!account) {
      setRecords([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await api.walletLoans(account);
      setRecords(await zeroGStorageService.getLendingHistory(account));
      setIndexingAvailable(result.indexing.available);
      setIndexingReason(result.indexing.blockedReason ?? result.reason);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load loans');
      setRecords([]);
    } finally {
      setIsLoading(false);
    }
  }, [account]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createLoan = useCallback<LoansContextValue['createLoan']>(
    async (amount, onStatus) => {
      if (!account) {
        throw new LoanTxError('Connect a wallet to submit this transaction.', 'not_connected');
      }

      const { hash, loanId } = await requestLoan(amount, onStatus);
      void refetchBalance();
      onStatus?.('indexing', hash);

      const indexed = await pollLoan(
        account,
        (loans) =>
          loans.find(
            (loan) =>
              loan.originTxHash?.toLowerCase() === hash.toLowerCase() ||
              loan.loanId.toLowerCase() === loanId.toLowerCase(),
          ),
        hash,
      );

      await refresh();
      onStatus?.('available', hash);

      const history = await zeroGStorageService.getLendingHistory(account);
      const view = history.map(toLoanView).find((loan) => loan.loanId === indexed.loanId);
      if (!view) {
        throw new LoanTxError(
          'Indexer recorded the loan but the frontend could not load it yet.',
          'indexer_unavailable',
          hash,
        );
      }
      return view;
    },
    [account, refetchBalance, refresh, requestLoan],
  );

  const repayLoan = useCallback<LoansContextValue['repayLoan']>(
    async (loanId, onStatus) => {
      if (!account) {
        throw new LoanTxError('Connect a wallet to submit this transaction.', 'not_connected');
      }

      const current = records.map(toLoanView).find((loan) => loan.loanId === loanId);
      if (!current) {
        throw new LoanTxError('This loan is not associated with the connected wallet.', 'unknown');
      }
      if (current.status !== 'active') {
        throw new LoanTxError('Only an active loan can be repaid.', 'reverted');
      }
      if (current.overdue) {
        throw new LoanTxError(
          'Loan.sol rejects repayment after dueTime. This overdue loan cannot be settled on the current contract.',
          'expired',
        );
      }
      if (current.wallet && current.wallet.toLowerCase() !== account.toLowerCase()) {
        throw new LoanTxError('Only the borrower wallet can repay this loan.', 'reverted');
      }

      const { hash } = await submitRepay(repaymentWei(current.amount), onStatus);
      void refetchBalance();
      onStatus?.('indexing', hash);

      await pollLoan(
        account,
        (loans) =>
          loans.find(
            (loan) =>
              loan.loanId === loanId &&
              loan.status === 'repaid' &&
              loan.repaidTxHash?.toLowerCase() === hash.toLowerCase(),
          ),
        hash,
      );

      await refresh();
      onStatus?.('available', hash);
    },
    [account, records, refetchBalance, refresh, submitRepay],
  );

  const loans = useMemo(
    () =>
      records
        .map(toLoanView)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [records],
  );

  const activeLoans = useMemo(() => loans.filter((loan) => loan.status === 'active'), [loans]);

  const getLoan = useCallback(
    (loanId: string) => loans.find((loan) => loan.loanId === loanId),
    [loans],
  );

  const value = useMemo(
    () => ({
      loans,
      activeLoans,
      isLoading,
      error,
      indexingAvailable,
      indexingReason,
      createLoan,
      repayLoan,
      getLoan,
      refresh,
    }),
    [
      loans,
      activeLoans,
      isLoading,
      error,
      indexingAvailable,
      indexingReason,
      createLoan,
      repayLoan,
      getLoan,
      refresh,
    ],
  );

  return <LoansContext.Provider value={value}>{children}</LoansContext.Provider>;
}

export function useLoans() {
  const context = useContext(LoansContext);
  if (!context) throw new Error('useLoans must be used within a LoansProvider');
  return context;
}
