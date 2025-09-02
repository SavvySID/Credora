import { ZERO_G_CONFIG, zeroGStorage } from './0g-config';

export interface UserData {
  walletAddress: string;
  balance: number;
  transactionCount: number;
  transactionHistory: Transaction[];
  lendingHistory: LendingRecord[];
  lastActivity: string;
  createdAt: string;
  updatedAt: string;
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
  amount: number;
  interestRate: number;
  status: 'active' | 'repaid' | 'defaulted';
  createdAt: string;
  dueDate: string;
  repaidAt?: string;
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
   * Store user data in 0G storage
   */
  async storeUserData(walletAddress: string, data: Partial<UserData>): Promise<boolean> {
    try {
      const key = `${ZERO_G_CONFIG.storage.userDataPrefix}${walletAddress}`;
      const userData: UserData = {
        walletAddress,
        balance: data.balance || 0,
        transactionCount: data.transactionCount || 0,
        transactionHistory: data.transactionHistory || [],
        lendingHistory: data.lendingHistory || [],
        lastActivity: data.lastActivity || new Date().toISOString(),
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      const result = await zeroGStorage.store(key, userData);
      console.log('User data stored successfully:', result);
      return result.success;
    } catch (error) {
      console.error('Failed to store user data:', error);
      return false;
    }
  }
  
  /**
   * Retrieve user data from 0G storage
   */
  async getUserData(walletAddress: string): Promise<UserData | null> {
    try {
      const key = `${ZERO_G_CONFIG.storage.userDataPrefix}${walletAddress}`;
      const result = await zeroGStorage.retrieve(key);
      
      if (result.exists && result.data) {
        return result.data as UserData;
      }
      
      return null;
    } catch (error) {
      console.error('Failed to retrieve user data:', error);
      return null;
    }
  }
  
  /**
   * Store transaction data
   */
  async storeTransaction(walletAddress: string, transaction: Transaction): Promise<boolean> {
    try {
      const key = `${ZERO_G_CONFIG.storage.transactionPrefix}${walletAddress}:${transaction.hash}`;
      const result = await zeroGStorage.store(key, transaction);
      return result.success;
    } catch (error) {
      console.error('Failed to store transaction:', error);
      return false;
    }
  }
  
  /**
   * Store lending record
   */
  async storeLendingRecord(walletAddress: string, lendingRecord: LendingRecord): Promise<boolean> {
    try {
      const key = `${ZERO_G_CONFIG.storage.lendingPrefix}${walletAddress}:${lendingRecord.loanId}`;
      const result = await zeroGStorage.store(key, lendingRecord);
      return result.success;
    } catch (error) {
      console.error('Failed to store lending record:', error);
      return false;
    }
  }
  
  /**
   * Get user's transaction history
   */
  async getTransactionHistory(walletAddress: string): Promise<Transaction[]> {
    try {
      // In a real implementation, this would query 0G storage for all transactions
      // For now, we'll return mock data
      return [
        {
          hash: '0x1234567890abcdef',
          from: walletAddress,
          to: '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6',
          value: '0.1',
          timestamp: new Date().toISOString(),
          blockNumber: 12345678,
          gasUsed: '21000',
          gasPrice: '20000000000',
        },
      ];
    } catch (error) {
      console.error('Failed to get transaction history:', error);
      return [];
    }
  }
  
  /**
   * Get user's lending history
   */
  async getLendingHistory(walletAddress: string): Promise<LendingRecord[]> {
    try {
      // In a real implementation, this would query 0G storage for all lending records
      // For now, we'll return mock data
      return [
        {
          loanId: 'loan-001',
          amount: 2.5,
          interestRate: 0.05,
          status: 'active',
          createdAt: new Date().toISOString(),
          dueDate: '2024-09-15',
        },
      ];
    } catch (error) {
      console.error('Failed to get lending history:', error);
      return [];
    }
  }
  
  /**
   * Update user's last activity
   */
  async updateLastActivity(walletAddress: string): Promise<boolean> {
    try {
      const userData = await this.getUserData(walletAddress);
      if (userData) {
        userData.lastActivity = new Date().toISOString();
        userData.updatedAt = new Date().toISOString();
        return await this.storeUserData(walletAddress, userData);
      }
      return false;
    } catch (error) {
      console.error('Failed to update last activity:', error);
      return false;
    }
  }
  
  /**
   * Delete user data (for privacy/GDPR compliance)
   */
  async deleteUserData(walletAddress: string): Promise<boolean> {
    try {
      const key = `${ZERO_G_CONFIG.storage.userDataPrefix}${walletAddress}`;
      const result = await zeroGStorage.delete(key);
      return result.success;
    } catch (error) {
      console.error('Failed to delete user data:', error);
      return false;
    }
  }
}

export const zeroGStorageService = ZeroGStorageService.getInstance();
