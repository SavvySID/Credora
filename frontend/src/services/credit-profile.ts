import { zeroGCreditScoreService, type CreditScoreResponse } from './0g-credit-score';
import { zeroGPipelineService } from './0g-pipeline';
import { initialize0G } from './0g-config';

/**
 * Adapter around the API-backed credit services.
 *
 * Live wallet facts (balance, nonce) still come from wagmi. History and the
 * score itself come from the indexer / scoring API. Nothing here invents data.
 */

export interface WalletFacts {
  balance: number;
  transactionCount: number;
}

let initialized = false;

async function ensureInitialized(): Promise<void> {
  if (initialized) return;
  await initialize0G();
  await zeroGPipelineService.initialize();
  initialized = true;
}

export async function getCreditProfile(
  walletAddress: string,
  _facts: WalletFacts,
): Promise<CreditScoreResponse> {
  await ensureInitialized();
  return zeroGCreditScoreService.getCreditScore(walletAddress);
}
