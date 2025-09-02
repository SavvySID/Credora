import { initialize0G } from './0g-config';
import { zeroGStorageService, UserData } from './0g-storage';
import { zeroGComputeService, CreditScoreResult } from './0g-compute';
import { zeroGPipelineService, CreditScoreUpdateEvent } from './0g-pipeline';

export interface CreditScoreResponse {
  wallet: string;
  creditScore: number; // 0-1000
  riskLevel: 'Low' | 'Medium' | 'High';
  confidence: number;
  factors: any[];
  walletData: {
    balance: string;
    transactionCount: number;
    lastActivity: string;
  };
  timestamp: string;
  modelVersion: string;
  poweredBy: '0G AI/ML Engine';
}

export class ZeroGCreditScoreService {
  private static instance: ZeroGCreditScoreService;
  private isInitialized: boolean = false;
  
  private constructor() {}
  
  public static getInstance(): ZeroGCreditScoreService {
    if (!ZeroGCreditScoreService.instance) {
      ZeroGCreditScoreService.instance = new ZeroGCreditScoreService();
    }
    return ZeroGCreditScoreService.instance;
  }
  
  /**
   * Initialize all 0G services
   */
  async initialize(): Promise<boolean> {
    if (this.isInitialized) {
      return true;
    }
    
    try {
      console.log('Initializing 0G Credit Score Service...');
      
      // Initialize 0G core services
      const coreInitialized = await initialize0G();
      if (!coreInitialized) {
        throw new Error('Failed to initialize 0G core services');
      }
      
      // Initialize pipeline for real-time updates
      const pipelineInitialized = await zeroGPipelineService.initialize();
      if (!pipelineInitialized) {
        console.warn('Failed to initialize 0G Pipeline, continuing without real-time updates');
      }
      
      this.isInitialized = true;
      console.log('0G Credit Score Service initialized successfully');
      return true;
      
    } catch (error) {
      console.error('Failed to initialize 0G Credit Score Service:', error);
      return false;
    }
  }
  
  /**
   * Get credit score for a wallet address using 0G AI/ML engine
   */
  async getCreditScore(walletAddress: string): Promise<CreditScoreResponse> {
    try {
      // Ensure service is initialized
      if (!this.isInitialized) {
        await this.initialize();
      }
      
      console.log(`Getting credit score for wallet: ${walletAddress}`);
      
      // Get or create user data from 0G storage
      let userData = await zeroGStorageService.getUserData(walletAddress);
      
      if (!userData) {
        // Create new user data if not exists
        userData = await this.createUserData(walletAddress);
      }
      
      // Run ML inference using 0G compute
      const creditScoreResult = await zeroGComputeService.runCreditScoreInference(userData);
      
      // Update user data with new credit score
      await this.updateUserDataWithCreditScore(walletAddress, creditScoreResult);
      
      // Publish real-time update via 0G pipeline
      await zeroGPipelineService.publishCreditScoreUpdate(
        walletAddress,
        creditScoreResult.creditScore,
        creditScoreResult.riskLevel,
        creditScoreResult.confidence,
        creditScoreResult.factors
      );
      
      // Format response
      const response: CreditScoreResponse = {
        wallet: walletAddress,
        creditScore: creditScoreResult.creditScore,
        riskLevel: creditScoreResult.riskLevel,
        confidence: creditScoreResult.confidence,
        factors: creditScoreResult.factors,
        walletData: {
          balance: `${userData.balance} ETH`,
          transactionCount: userData.transactionCount,
          lastActivity: userData.lastActivity,
        },
        timestamp: creditScoreResult.inferenceTimestamp,
        modelVersion: creditScoreResult.modelVersion,
        poweredBy: '0G AI/ML Engine',
      };
      
      console.log('Credit score generated successfully:', response);
      return response;
      
    } catch (error) {
      console.error('Failed to get credit score:', error);
      throw new Error('Credit score generation failed');
    }
  }
  
  /**
   * Create new user data for a wallet
   */
  private async createUserData(walletAddress: string): Promise<UserData> {
    console.log(`Creating new user data for wallet: ${walletAddress}`);
    
    // Get transaction history from blockchain (mock for now)
    const transactionHistory = await zeroGStorageService.getTransactionHistory(walletAddress);
    
    // Get lending history (mock for now)
    const lendingHistory = await zeroGStorageService.getLendingHistory(walletAddress);
    
    // Create user data
    const userData: UserData = {
      walletAddress,
      balance: 0, // Will be updated by wallet provider
      transactionCount: transactionHistory.length,
      transactionHistory,
      lendingHistory,
      lastActivity: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    // Store in 0G storage
    await zeroGStorageService.storeUserData(walletAddress, userData);
    
    return userData;
  }
  
  /**
   * Update user data with new credit score
   */
  private async updateUserDataWithCreditScore(
    walletAddress: string, 
    creditScoreResult: CreditScoreResult
  ): Promise<void> {
    try {
      const userData = await zeroGStorageService.getUserData(walletAddress);
      if (userData) {
        userData.updatedAt = new Date().toISOString();
        await zeroGStorageService.storeUserData(walletAddress, userData);
      }
    } catch (error) {
      console.error('Failed to update user data with credit score:', error);
    }
  }
  
  /**
   * Subscribe to real-time credit score updates
   */
  subscribeToCreditScoreUpdates(
    walletAddress: string,
    callback: (event: CreditScoreUpdateEvent) => void
  ): () => void {
    return zeroGPipelineService.subscribeToCreditScoreUpdates(walletAddress, callback);
  }
  
  /**
   * Update user's wallet balance
   */
  async updateWalletBalance(walletAddress: string, balance: number): Promise<boolean> {
    try {
      const userData = await zeroGStorageService.getUserData(walletAddress);
      if (userData) {
        userData.balance = balance;
        userData.updatedAt = new Date().toISOString();
        return await zeroGStorageService.storeUserData(walletAddress, userData);
      }
      return false;
    } catch (error) {
      console.error('Failed to update wallet balance:', error);
      return false;
    }
  }
  
  /**
   * Add a new transaction to user's history
   */
  async addTransaction(
    walletAddress: string,
    transaction: {
      hash: string;
      from: string;
      to: string;
      value: string;
      timestamp: string;
      blockNumber: number;
      gasUsed: string;
      gasPrice: string;
    }
  ): Promise<boolean> {
    try {
      // Store transaction in 0G storage
      const stored = await zeroGStorageService.storeTransaction(walletAddress, transaction);
      
      if (stored) {
        // Update user data
        const userData = await zeroGStorageService.getUserData(walletAddress);
        if (userData) {
          userData.transactionHistory.push(transaction);
          userData.transactionCount = userData.transactionHistory.length;
          userData.lastActivity = transaction.timestamp;
          userData.updatedAt = new Date().toISOString();
          
          await zeroGStorageService.storeUserData(walletAddress, userData);
          
          // Publish transaction update via pipeline
          await zeroGPipelineService.publishTransactionUpdate(walletAddress, {
            hash: transaction.hash,
            from: transaction.from,
            to: transaction.to,
            value: transaction.value,
            blockNumber: transaction.blockNumber,
          });
        }
      }
      
      return stored;
    } catch (error) {
      console.error('Failed to add transaction:', error);
      return false;
    }
  }
  
  /**
   * Add a new lending record
   */
  async addLendingRecord(
    walletAddress: string,
    lendingRecord: {
      loanId: string;
      amount: number;
      interestRate: number;
      status: 'active' | 'repaid' | 'defaulted';
      createdAt: string;
      dueDate: string;
      repaidAt?: string;
    }
  ): Promise<boolean> {
    try {
      // Store lending record in 0G storage
      const stored = await zeroGStorageService.storeLendingRecord(walletAddress, lendingRecord);
      
      if (stored) {
        // Update user data
        const userData = await zeroGStorageService.getUserData(walletAddress);
        if (userData) {
          userData.lendingHistory.push(lendingRecord);
          userData.updatedAt = new Date().toISOString();
          
          await zeroGStorageService.storeUserData(walletAddress, userData);
          
          // Publish lending update via pipeline
          await zeroGPipelineService.publishLendingUpdate(walletAddress, {
            loanId: lendingRecord.loanId,
            status: lendingRecord.status,
            amount: lendingRecord.amount,
            action: lendingRecord.status === 'active' ? 'created' : 
                   lendingRecord.status === 'repaid' ? 'repaid' : 'defaulted',
          });
        }
      }
      
      return stored;
    } catch (error) {
      console.error('Failed to add lending record:', error);
      return false;
    }
  }
  
  /**
   * Get service status
   */
  getStatus(): {
    initialized: boolean;
    pipelineConnected: boolean;
    subscriberCount: number;
  } {
    return {
      initialized: this.isInitialized,
      pipelineConnected: zeroGPipelineService.getConnectionStatus(),
      subscriberCount: zeroGPipelineService.getSubscriberCount(),
    };
  }
}

export const zeroGCreditScoreService = ZeroGCreditScoreService.getInstance();
