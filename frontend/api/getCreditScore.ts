import { isAddress } from 'ethers';
import { zeroGCreditScoreService } from '../src/services/0g-credit-score';

export default async function handler(req: any, res: any) {
  try {
    const wallet = (req.query?.wallet || req.query?.address || '').toString();

    if (!wallet) {
      return res.status(400).json({
        error: 'Wallet address is required',
        example: '/api/getCreditScore?wallet=0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6',
      });
    }

    if (!isAddress(wallet)) {
      return res.status(400).json({ error: 'Invalid Ethereum address format' });
    }

    // Initialize 0G Credit Score Service
    await zeroGCreditScoreService.initialize();

    // Get credit score using 0G AI/ML engine
    const creditScoreResponse = await zeroGCreditScoreService.getCreditScore(wallet);

    // Transform response to match existing API format
    const response = {
      wallet: creditScoreResponse.wallet,
      creditScore: creditScoreResponse.riskLevel, // Map risk level to credit score for backward compatibility
      walletData: creditScoreResponse.walletData,
      timestamp: creditScoreResponse.timestamp,
      wave: 'Wave 2 - 0G AI/ML Engine',
      poweredBy: creditScoreResponse.poweredBy,
      modelVersion: creditScoreResponse.modelVersion,
      confidence: creditScoreResponse.confidence,
      factors: creditScoreResponse.factors,
      rawScore: creditScoreResponse.creditScore, // Include raw 0-1000 score
    };

    return res.status(200).json(response);
  } catch (error: any) {
    console.error('Error in getCreditScore API:', error);
    return res.status(500).json({ 
      error: 'Internal server error', 
      message: error?.message || 'unknown',
      poweredBy: '0G AI/ML Engine'
    });
  }
}


