import { formatEther } from 'ethers';
import { api, ApiUnavailableError, type LoanDto, type VerificationState } from './api';

export interface UserData {
  walletAddress: string;
  balance: number;
  transactionCount: number;
  transactionHistory: Transaction[];
  lendingHistory: LendingRecord[];
  lastActivity: string;
  createdAt: string;
  updatedAt: string;
  degraded?: boolean;
  degradedReason?: string | null;
}

export interface Transaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  timestamp: string;
  blockNumber: number;
  gasUsed: string;
  gasPrice: string;
}

export interface LendingRecord {
  loanId: string;
  wallet?: string;
  amount: number;
  interestRate: number;
  status: 'active' | 'repaid' | 'defaulted';
  createdAt: string;
  dueDate: string;
  repaidAt?: string;
  originTxHash?: string | null;
  repaidTxHash?: string | null;
  verification?: VerificationState;
}

function fromLoanDto(loan: LoanDto): LendingRecord {
  return {
    loanId: loan.loanId,
    wallet: loan.wallet,
    amount: Number(formatEther(loan.amountWei)),
    interestRate: loan.interestRateBps / 10_000,
    status: loan.status,
    createdAt: loan.createdAt,
    dueDate: loan.dueAt ?? loan.createdAt,
    repaidAt: loan.repaidAt ?? undefined,
    originTxHash: loan.originTxHash,
    repaidTxHash: loan.repaidTxHash,
  };
}

export class ZeroGStorageService {
  private static instance: ZeroGStorageService;

  private constructor() {}

  public static getInstance(): ZeroGStorageService {
    if (!ZeroGStorageService.instance) {
      ZeroGStorageService.instance = new ZeroGStorageService();
    }
    return ZeroGStorageService.instance;
  }

  /**
   * Browser writes to 0G Storage are not supported: uploads require a funded
   * server-side signer. Always returns false. No local fake persist.
   */
  async storeUserData(_walletAddress: string, _data: Partial<UserData>): Promise<boolean> {
    return false;
  }

  async getUserData(walletAddress: string): Promise<UserData | null> {
    try {
      const [activity, lendingHistory] = await Promise.all([
        api.walletActivity(walletAddress),
        this.getLendingHistory(walletAddress),
      ]);

      return {
        walletAddress: activity.address,
        balance: Number(activity.balanceFormatted),
        transactionCount: activity.transactionCount,
        transactionHistory: await this.getTransactionHistory(walletAddress, activity),
        lendingHistory,
        lastActivity: activity.lastActivity ?? activity.fetchedAt,
        createdAt: activity.firstSeen ?? activity.fetchedAt,
        updatedAt: activity.fetchedAt,
        degraded: activity.degraded,
        degradedReason: activity.degradedReason,
      };
    } catch (error) {
      if (error instanceof ApiUnavailableError) throw error;
      return null;
    }
  }

  async storeTransaction(_walletAddress: string, _transaction: Transaction): Promise<boolean> {
    return false;
  }

  async storeLendingRecord(_walletAddress: string, _lendingRecord: LendingRecord): Promise<boolean> {
    return false;
  }

  async getTransactionHistory(
    walletAddress: string,
    snapshot?: Awaited<ReturnType<typeof api.walletActivity>>,
  ): Promise<Transaction[]> {
    const activity = snapshot ?? (await api.walletActivity(walletAddress));

    return activity.transactions.map((tx) => ({
      hash: tx.hash,
      from: tx.from,
      to: tx.to ?? '',
      value: formatEther(tx.valueWei),
      timestamp: tx.timestamp,
      blockNumber: tx.blockNumber,
      gasUsed: '0',
      gasPrice: '0',
    }));
  }

  async getLendingHistory(walletAddress: string): Promise<LendingRecord[]> {
    const [result, indexed] = await Promise.all([
      api.walletLoans(walletAddress),
      api
        .walletRecords(walletAddress, ['loan_approved', 'loan_repaid', 'loan_defaulted'])
        .catch(() => ({ records: [] })),
    ]);

    return result.loans.map((loan) => {
      const match = indexed.records.find((record) => record.loanId === loan.loanId);
      return { ...fromLoanDto(loan), verification: match?.verification };
    });
  }

  async updateLastActivity(_walletAddress: string): Promise<boolean> {
    return false;
  }

  async deleteUserData(_walletAddress: string): Promise<boolean> {
    return false;
  }
}

export const zeroGStorageService = ZeroGStorageService.getInstance();
