import { isAddress } from 'ethers';

// Mock wallet data for Wave 1
const mockWalletData: Record<string, { balance: string; txCount: number; lastActivity: string }> = {
  '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6': { balance: '2.5', txCount: 25, lastActivity: '2024-01-15' },
  '0x1234567890123456789012345678901234567890': { balance: '0.8', txCount: 8, lastActivity: '2024-01-10' },
  '0x0987654321098765432109876543210987654321': { balance: '0.1', txCount: 3, lastActivity: '2024-01-05' },
};

function calculateCreditScore(walletData: { balance: string; txCount: number }) {
  const balance = parseFloat(walletData.balance);
  const txCount = walletData.txCount;
  if (txCount > 10 && balance > 0.5) return 'High' as const;
  if (txCount >= 5 && txCount <= 10) return 'Medium' as const;
  return 'Low' as const;
}

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

    const walletData = mockWalletData[wallet] || {
      balance: (Math.random() * 3).toFixed(2),
      txCount: Math.floor(Math.random() * 30) + 1,
      lastActivity: new Date().toISOString().split('T')[0],
    };

    const creditScore = calculateCreditScore(walletData);

    return res.status(200).json({
      wallet,
      creditScore,
      walletData: {
        balance: `${walletData.balance} ETH`,
        transactionCount: walletData.txCount,
        lastActivity: walletData.lastActivity,
      },
      timestamp: new Date().toISOString(),
      wave: 'Wave 1 MVP - Rule-based AI placeholder',
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'Internal server error', message: error?.message || 'unknown' });
  }
}


