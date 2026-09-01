import { ZERO_G_CONFIG } from './0g-config';
import { api, type CreditScoreDto } from './api';
import type { UserData } from './0g-storage';

export interface CreditScoreResult {
  creditScore: number;
  riskLevel: 'Low' | 'Medium' | 'High';
  confidence: number;
  factors: CreditFactor[];
  modelVersion: string;
  inferenceTimestamp: string;
  methodology?: string;
  trained?: boolean;
  narrative?: CreditScoreDto['narrative'];
  verification?: CreditScoreDto['record']['verification'];
  dataQuality?: CreditScoreDto['dataQuality'];
  walletData?: CreditScoreDto['walletData'];
}

export interface CreditFactor {
  factor: string;
  impact: 'positive' | 'negative' | 'neutral';
  weight: number;
  description: string;
}

export interface CreditScoreInput {
  walletAddress: string;
  balance: number;
  transactionCount: number;
  transactionHistory: unknown[];
  lendingHistory: unknown[];
  lastActivity: string;
  additionalFeatures?: Record<string, unknown>;
}

function toFactors(dto: CreditScoreDto): CreditFactor[] {
  return dto.factors.map((factor) => ({
    factor: factor.factor,
    impact:
      factor.impact === 'positive' || factor.impact === 'negative' ? factor.impact : 'neutral',
    weight: factor.weight,
    description: factor.description,
  }));
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
   * Requests a credit assessment from the API.
   *
   * The number is produced by the deterministic model in api/_lib/scoring.ts.
   * 0G Compute, when configured, only writes a natural-language explanation
   * and does not change the score.
   */
  async runCreditScoreInference(userData: UserData): Promise<CreditScoreResult> {
    const dto = await api.creditScore(userData.walletAddress);

    return {
      creditScore: dto.creditScore,
      riskLevel: dto.riskLevel,
      confidence: dto.confidence,
      factors: toFactors(dto),
      modelVersion: `${dto.scoring.id}@${dto.scoring.version}`,
      inferenceTimestamp: dto.timestamp,
      methodology: dto.scoring.methodology,
      trained: dto.scoring.trained,
      narrative: dto.narrative,
      verification: dto.record.verification,
      dataQuality: dto.dataQuality,
      walletData: dto.walletData,
    };
  }

  async runBatchCreditScoreInference(userDataList: UserData[]): Promise<CreditScoreResult[]> {
    return Promise.all(userDataList.map((userData) => this.runCreditScoreInference(userData)));
  }

  async getModelInfo(): Promise<{
    modelId: string;
    version: string;
    inputSchema: unknown;
    outputSchema: unknown;
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

  validateInput(input: CreditScoreInput): boolean {
    return Boolean(input.walletAddress && input.lastActivity);
  }
}

export const zeroGComputeService = ZeroGComputeService.getInstance();
