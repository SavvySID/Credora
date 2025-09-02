import { ZERO_G_CONFIG, zeroGCompute } from './0g-config';
import { UserData } from './0g-storage';

export interface CreditScoreResult {
  creditScore: number; // 0-1000
  riskLevel: 'Low' | 'Medium' | 'High';
  confidence: number; // 0-1
  factors: CreditFactor[];
  modelVersion: string;
  inferenceTimestamp: string;
}

export interface CreditFactor {
  factor: string;
  impact: 'positive' | 'negative' | 'neutral';
  weight: number; // 0-1
  description: string;
}

export interface CreditScoreInput {
  walletAddress: string;
  balance: number;
  transactionCount: number;
  transactionHistory: any[];
  lendingHistory: any[];
  lastActivity: string;
  additionalFeatures?: Record<string, any>;
}

export class ZeroGComputeService {
  private static instance: ZeroGComputeService;
  
  private constructor() {}
  
  public static getInstance(): ZeroGComputeService {
    if (!ZeroGComputeService.instance) {
      ZeroGComputeService.instance = new ZeroGComputeService();
    }
    return ZeroGComputeService.instance;
  }
  
  /**
   * Run credit scoring inference using 0G compute
   */
  async runCreditScoreInference(userData: UserData): Promise<CreditScoreResult> {
    try {
      console.log('Running credit score inference for wallet:', userData.walletAddress);
      
      // Prepare input data for the ML model
      const input: CreditScoreInput = {
        walletAddress: userData.walletAddress,
        balance: userData.balance,
        transactionCount: userData.transactionCount,
        transactionHistory: userData.transactionHistory,
        lendingHistory: userData.lendingHistory,
        lastActivity: userData.lastActivity,
        additionalFeatures: this.extractAdditionalFeatures(userData),
      };
      
      // Run inference on 0G compute
      const result = await zeroGCompute.runInference(
        ZERO_G_CONFIG.creditModel.modelId,
        input
      );
      
      // Transform the result to match our interface
      const creditScoreResult: CreditScoreResult = {
        creditScore: result.creditScore,
        riskLevel: result.riskLevel,
        confidence: result.confidence,
        factors: result.factors.map((factor: any) => ({
          factor: factor.factor,
          impact: factor.impact,
          weight: factor.weight,
          description: this.getFactorDescription(factor.factor, factor.impact),
        })),
        modelVersion: ZERO_G_CONFIG.creditModel.version,
        inferenceTimestamp: new Date().toISOString(),
      };
      
      console.log('Credit score inference completed:', creditScoreResult);
      return creditScoreResult;
      
    } catch (error) {
      console.error('Failed to run credit score inference:', error);
      throw new Error('Credit score inference failed');
    }
  }
  
  /**
   * Extract additional features from user data for ML model
   */
  private extractAdditionalFeatures(userData: UserData): Record<string, any> {
    const features: Record<string, any> = {};
    
    // Calculate time-based features
    const now = new Date();
    const lastActivity = new Date(userData.lastActivity);
    const daysSinceLastActivity = Math.floor((now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24));
    
    features.daysSinceLastActivity = daysSinceLastActivity;
    features.isActive = daysSinceLastActivity <= 7;
    
    // Calculate transaction-based features
    if (userData.transactionHistory.length > 0) {
      const recentTransactions = userData.transactionHistory.filter(tx => 
        new Date(tx.timestamp).getTime() > now.getTime() - (30 * 24 * 60 * 60 * 1000) // Last 30 days
      );
      
      features.recentTransactionCount = recentTransactions.length;
      features.averageTransactionValue = recentTransactions.reduce((sum, tx) => 
        sum + parseFloat(tx.value), 0
      ) / recentTransactions.length;
    }
    
    // Calculate lending-based features
    if (userData.lendingHistory.length > 0) {
      const activeLoans = userData.lendingHistory.filter(loan => loan.status === 'active');
      const repaidLoans = userData.lendingHistory.filter(loan => loan.status === 'repaid');
      const defaultedLoans = userData.lendingHistory.filter(loan => loan.status === 'defaulted');
      
      features.activeLoanCount = activeLoans.length;
      features.repaidLoanCount = repaidLoans.length;
      features.defaultedLoanCount = defaultedLoans.length;
      features.repaymentRate = userData.lendingHistory.length > 0 ? 
        repaidLoans.length / userData.lendingHistory.length : 1;
    }
    
    return features;
  }
  
  /**
   * Get human-readable description for credit factors
   */
  private getFactorDescription(factor: string, impact: string): string {
    const descriptions: Record<string, Record<string, string>> = {
      balance: {
        positive: 'High wallet balance indicates financial stability',
        negative: 'Low wallet balance may indicate financial stress',
        neutral: 'Moderate wallet balance',
      },
      transaction_count: {
        positive: 'High transaction count shows active wallet usage',
        negative: 'Low transaction count may indicate inactivity',
        neutral: 'Moderate transaction activity',
      },
      activity_recency: {
        positive: 'Recent activity shows wallet is actively used',
        negative: 'No recent activity may indicate abandoned wallet',
        neutral: 'Moderate activity recency',
      },
      repayment_rate: {
        positive: 'Good repayment history increases creditworthiness',
        negative: 'Poor repayment history reduces creditworthiness',
        neutral: 'Mixed repayment history',
      },
    };
    
    return descriptions[factor]?.[impact] || 'Factor impact on credit score';
  }
  
  /**
   * Run batch inference for multiple wallets
   */
  async runBatchCreditScoreInference(userDataList: UserData[]): Promise<CreditScoreResult[]> {
    try {
      console.log(`Running batch credit score inference for ${userDataList.length} wallets`);
      
      const results = await Promise.all(
        userDataList.map(userData => this.runCreditScoreInference(userData))
      );
      
      console.log('Batch credit score inference completed');
      return results;
      
    } catch (error) {
      console.error('Failed to run batch credit score inference:', error);
      throw new Error('Batch credit score inference failed');
    }
  }
  
  /**
   * Get model information
   */
  async getModelInfo(): Promise<{
    modelId: string;
    version: string;
    inputSchema: any;
    outputSchema: any;
    lastUpdated: string;
  }> {
    return {
      modelId: ZERO_G_CONFIG.creditModel.modelId,
      version: ZERO_G_CONFIG.creditModel.version,
      inputSchema: ZERO_G_CONFIG.creditModel.inputSchema,
      outputSchema: ZERO_G_CONFIG.creditModel.outputSchema,
      lastUpdated: new Date().toISOString(),
    };
  }
  
  /**
   * Validate input data against model schema
   */
  validateInput(input: CreditScoreInput): boolean {
    const requiredFields = [
      'walletAddress',
      'balance',
      'transactionCount',
      'transactionHistory',
      'lendingHistory',
      'lastActivity',
    ];
    
    return requiredFields.every(field => input[field] !== undefined);
  }
}

export const zeroGComputeService = ZeroGComputeService.getInstance();
