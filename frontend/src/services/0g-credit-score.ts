import { initialize0G } from './0g-config';
import { zeroGStorageService, type UserData } from './0g-storage';
import { zeroGComputeService } from './0g-compute';
import { zeroGPipelineService, type CreditScoreUpdateEvent } from './0g-pipeline';
import { api, type HealthDto, type VerificationState } from './api';

export interface CreditScoreResponse {
  wallet: string;
  creditScore: number;
  creditBand?: 'Building' | 'Established' | 'Excellent';
  riskLevel: 'Low' | 'Medium' | 'High';
  confidence: number;
  factors: unknown[];
  walletData: {
    balance: string;
    transactionCount: number;
    lastActivity: string;
  };
  timestamp: string;
  modelVersion: string;
  /** Identifies the scoring method. Not a claim that the score is AI-generated. */
  poweredBy: string;
  methodology?: string;
  trained?: boolean;
  verification?: VerificationState | null;
  narrative?: {
    available: boolean;
    text: string | null;
    blockedReason: string | null;
    model: string | null;
  };
  ai?: import('./api').CreditProfileDto['ai'];
  reputation?: import('./api').CreditProfileDto['reputation']['earned'];
}

export interface ZeroGStatusSnapshot {
  initialized: boolean;
  pipelineConnected: boolean;
  subscriberCount: number;
  storageOnline: boolean;
  computeOnline: boolean;
  computeConfigured: boolean;
  chainOnline: boolean;
  verifiedRecords: number;
  blockedReasons: string[];
}

export class ZeroGCreditScoreService {
  private static instance: ZeroGCreditScoreService;
  private isInitialized = false;
  private lastHealth: HealthDto | null = null;

  private constructor() {}

  public static getInstance(): ZeroGCreditScoreService {
    if (!ZeroGCreditScoreService.instance) {
      ZeroGCreditScoreService.instance = new ZeroGCreditScoreService();
    }
    return ZeroGCreditScoreService.instance;
  }

  async initialize(): Promise<boolean> {
    if (this.isInitialized) return true;

    const storageReachable = await initialize0G();
    await zeroGPipelineService.initialize();
    this.isInitialized = storageReachable;
    return this.isInitialized;
  }

  async getCreditScore(walletAddress: string): Promise<CreditScoreResponse> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    let userData = await zeroGStorageService.getUserData(walletAddress);
    if (!userData) {
      userData = await this.createUserData(walletAddress);
    }

    const result = await zeroGComputeService.runCreditScoreInference(userData);

    return {
      wallet: walletAddress,
      creditScore: result.creditScore,
      riskLevel: result.riskLevel,
      confidence: result.confidence,
      factors: result.factors,
      walletData: {
        balance: result.walletData
          ? `${result.walletData.balance} 0G`
          : `${userData.balance} 0G`,
        transactionCount: result.walletData?.transactionCount ?? userData.transactionCount,
        lastActivity: result.walletData?.lastActivity ?? userData.lastActivity,
      },
      timestamp: result.inferenceTimestamp,
      modelVersion: result.modelVersion,
      poweredBy: result.trained
        ? '0G Compute (trained model)'
        : 'Credora on-chain model (deterministic, not trained)',
      methodology: result.methodology,
      trained: result.trained,
      verification: result.verification ?? null,
      narrative: result.narrative
        ? {
            available: result.narrative.available,
            text: result.narrative.text,
            blockedReason: result.narrative.blockedReason,
            model: result.narrative.model,
          }
        : undefined,
    };
  }

  private async createUserData(walletAddress: string): Promise<UserData> {
    const now = new Date().toISOString();
    const transactionHistory = await zeroGStorageService.getTransactionHistory(walletAddress);
    const lendingHistory = await zeroGStorageService.getLendingHistory(walletAddress);

    return {
      walletAddress,
      balance: 0,
      transactionCount: transactionHistory.length,
      transactionHistory,
      lendingHistory,
      lastActivity: transactionHistory[0]?.timestamp ?? now,
      createdAt: now,
      updatedAt: now,
    };
  }

  subscribeToCreditScoreUpdates(
    walletAddress: string,
    callback: (event: CreditScoreUpdateEvent) => void,
  ): () => void {
    return zeroGPipelineService.subscribeToCreditScoreUpdates(walletAddress, callback);
  }

  async updateWalletBalance(_walletAddress: string, _balance: number): Promise<boolean> {
    return false;
  }

  async addTransaction(
    _walletAddress: string,
    _transaction: {
      hash: string;
      from: string;
      to: string;
      value: string;
      timestamp: string;
      blockNumber: number;
      gasUsed: string;
      gasPrice: string;
    },
  ): Promise<boolean> {
    return false;
  }

  async addLendingRecord(
    _walletAddress: string,
    _lendingRecord: {
      loanId: string;
      amount: number;
      interestRate: number;
      status: 'active' | 'repaid' | 'defaulted';
      createdAt: string;
      dueDate: string;
      repaidAt?: string;
    },
  ): Promise<boolean> {
    return false;
  }

  async refreshHealth(): Promise<ZeroGStatusSnapshot> {
    try {
      this.lastHealth = await api.health();
    } catch {
      this.lastHealth = null;
    }
    return this.getStatus();
  }

  getStatus(): ZeroGStatusSnapshot {
    const health = this.lastHealth;
    const blockedReasons: string[] = [];

    if (health?.services.storage.writes && !health.services.storage.writes.available) {
      blockedReasons.push(health.services.storage.writes.blockedReason ?? '0G Storage writes blocked');
    }
    if (health?.services.compute && !health.services.compute.configured) {
      blockedReasons.push(health.services.compute.detail ?? '0G Compute not configured');
    }

    return {
      initialized: health?.services.storage.online ?? false,
      pipelineConnected: zeroGPipelineService.getConnectionStatus(),
      subscriberCount: zeroGPipelineService.getSubscriberCount(),
      storageOnline: health?.services.storage.online ?? false,
      computeOnline: health?.services.compute.online ?? false,
      computeConfigured: health?.services.compute.configured ?? false,
      chainOnline: health?.services.chain.online ?? false,
      verifiedRecords: health?.index?.verified ?? 0,
      blockedReasons,
    };
  }
}

export const zeroGCreditScoreService = ZeroGCreditScoreService.getInstance();
