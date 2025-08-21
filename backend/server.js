const express = require('express');
const cors = require('cors');
const { ethers } = require('ethers');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Mock blockchain data for Wave 1 MVP
// In production, this would fetch real data from blockchain nodes
const mockWalletData = {
  // Example wallet with high credit score
  '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6': {
    balance: '2.5',
    txCount: 25,
    lastActivity: '2024-01-15'
  },
  // Example wallet with medium credit score
  '0x1234567890123456789012345678901234567890': {
    balance: '0.8',
    txCount: 8,
    lastActivity: '2024-01-10'
  },
  // Example wallet with low credit score
  '0x0987654321098765432109876543210987654321': {
    balance: '0.1',
    txCount: 3,
    lastActivity: '2024-01-05'
  }
};

/**
 * AI Credit Scoring Algorithm (Rule-based placeholder for Wave 1)
 * @param {string} wallet - Wallet address
 * @param {Object} walletData - Wallet data from blockchain
 * @returns {string} Credit score: "High", "Medium", or "Low"
 */
function calculateCreditScore(wallet, walletData) {
  console.log(`🔍 Calculating credit score for wallet: ${wallet}`);
  console.log(`📊 Wallet data:`, walletData);

  // Rule-based AI scoring (placeholder for real ML in later waves)
  const balance = parseFloat(walletData.balance);
  const txCount = walletData.txCount;

  // High credit score criteria
  if (txCount > 10 && balance > 0.5) {
    console.log(`✅ High credit score: txCount=${txCount}, balance=${balance} ETH`);
    return "High";
  }
  
  // Medium credit score criteria
  if (txCount >= 5 && txCount <= 10) {
    console.log(`🟡 Medium credit score: txCount=${txCount}, balance=${balance} ETH`);
    return "Medium";
  }
  
  // Low credit score criteria
  console.log(`🔴 Low credit score: txCount=${txCount}, balance=${balance} ETH`);
  return "Low";
}

/**
 * Get wallet data from blockchain (mock implementation for Wave 1)
 * @param {string} wallet - Wallet address
 * @returns {Object} Wallet data
 */
async function getWalletData(wallet) {
  // For Wave 1 MVP, return mock data
  // In production, this would fetch real blockchain data
  
  if (mockWalletData[wallet]) {
    return mockWalletData[wallet];
  }
  
  // Generate random mock data for new wallets
  const randomBalance = (Math.random() * 3).toFixed(2);
  const randomTxCount = Math.floor(Math.random() * 30) + 1;
  
  return {
    balance: randomBalance,
    txCount: randomTxCount,
    lastActivity: new Date().toISOString().split('T')[0]
  };
}

/**
 * Validate Ethereum address format
 * @param {string} address - Address to validate
 * @returns {boolean} True if valid
 */
function isValidEthereumAddress(address) {
  try {
    return ethers.isAddress(address);
  } catch (error) {
    return false;
  }
}

// API Routes

/**
 * GET /getCreditScore
 * Get credit score for a wallet address
 */
app.get('/getCreditScore', async (req, res) => {
  try {
    const { wallet } = req.query;
    
    // Validate wallet address
    if (!wallet) {
      return res.status(400).json({
        error: 'Wallet address is required',
        example: '/getCreditScore?wallet=0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6'
      });
    }
    
    if (!isValidEthereumAddress(wallet)) {
      return res.status(400).json({
        error: 'Invalid Ethereum address format'
      });
    }
    
    console.log(`🚀 Processing credit score request for wallet: ${wallet}`);
    
    // Get wallet data from blockchain (mock for Wave 1)
    const walletData = await getWalletData(wallet);
    
    // Calculate credit score using AI algorithm
    const creditScore = calculateCreditScore(wallet, walletData);
    
    // Prepare response
    const response = {
      wallet: wallet,
      creditScore: creditScore,
      walletData: {
        balance: `${walletData.balance} ETH`,
        transactionCount: walletData.txCount,
        lastActivity: walletData.lastActivity
      },
      timestamp: new Date().toISOString(),
      wave: "Wave 1 MVP - Rule-based AI placeholder"
    };
    
    console.log(`✅ Credit score calculated: ${creditScore}`);
    console.log(`📤 Sending response:`, response);
    
    res.json(response);
    
  } catch (error) {
    console.error('❌ Error calculating credit score:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * GET /health
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Credora AI Credit Scoring API',
    version: '1.0.0',
    wave: 'Wave 1 MVP',
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /
 * API information
 */
app.get('/', (req, res) => {
  res.json({
    name: 'Credora AI Credit Scoring API',
    description: 'AI-powered credit scoring service for decentralized lending',
    version: '1.0.0',
    wave: 'Wave 1 MVP - Rule-based AI placeholder',
    endpoints: {
      'GET /': 'API information',
      'GET /health': 'Health check',
      'GET /getCreditScore?wallet=<address>': 'Get credit score for wallet'
    },
    features: [
      'Rule-based credit scoring (High/Medium/Low)',
      'Mock blockchain data integration',
      'Ethereum address validation',
      'Credit score calculation based on balance and transaction count'
    ],
    nextWaves: [
      'Wave 2: Real blockchain data integration',
      'Wave 3: Machine learning models',
      'Wave 4: 0G chain integration'
    ]
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('❌ Unhandled error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: 'Something went wrong on the server'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    availableEndpoints: [
      'GET /',
      'GET /health',
      'GET /getCreditScore?wallet=<address>'
    ]
  });
});

// Start server
app.listen(PORT, () => {
  console.log('🚀 Credora AI Credit Scoring API started!');
  console.log(`📡 Server running on port ${PORT}`);
  console.log(`🌐 API available at http://localhost:${PORT}`);
  console.log(`🔍 Test endpoint: http://localhost:${PORT}/getCreditScore?wallet=0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6`);
  console.log(`📊 Wave: 1 MVP - Rule-based AI placeholder`);
  console.log('---');
});

module.exports = app;
