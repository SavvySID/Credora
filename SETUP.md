# 🚀 Credora Setup Guide - Wave 1 MVP

This guide will walk you through setting up and running the Credora AI-powered decentralized lending dApp.

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v16 or higher) - [Download here](https://nodejs.org/)
- **npm** (v8 or higher) - Comes with Node.js
- **MetaMask** browser extension - [Download here](https://metamask.io/)
- **Git** - [Download here](https://git-scm.com/)

## 🏗️ Project Structure

```
credora/
├── contracts/          # Solidity smart contracts
│   ├── Loan.sol       # Main loan contract
│   ├── scripts/       # Deployment scripts
│   └── test/          # Contract tests
├── backend/            # AI credit scoring service
│   └── server.js      # Express.js API server
├── frontend/           # React frontend
│   ├── src/           # Source code
│   ├── components/    # React components
│   └── pages/         # Page components
└── README.md          # Project documentation
```

## ⚡ Quick Start

### 1. Clone and Install

```bash
# Clone the repository
git clone <your-repo-url>
cd credora

# Install all dependencies
npm run install:all
```

### 2. Start Services

```bash
# Terminal 1: Start backend AI service
npm run dev:backend

# Terminal 2: Start frontend
npm run dev:frontend

# Terminal 3: Start local blockchain (optional)
cd contracts && npx hardhat node
```

### 3. Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **Local Blockchain**: http://localhost:8545 (if running)

## 🔧 Detailed Setup

### Smart Contracts Setup

```bash
cd contracts

# Install dependencies
npm install

# Compile contracts
npm run compile

# Run tests
npm test

# Deploy to local network
npx hardhat node
# In another terminal:
npx hardhat run scripts/deploy.js --network localhost
```

### Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Start development server
npm run dev
```

The backend provides:
- `/getCreditScore?wallet=<address>` - Get AI credit score
- `/health` - Health check endpoint
- `/` - API information

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

## 🧪 Testing

### Test the API

```bash
# Test credit scoring
curl "http://localhost:3001/getCreditScore?wallet=0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6"

# Test health check
curl "http://localhost:3001/health"
```

### Test Smart Contracts

```bash
cd contracts
npm test
```

### Test Frontend

1. Open http://localhost:3000
2. Connect MetaMask wallet
3. Navigate to Dashboard
4. Check credit score
5. Try requesting a loan

## 🔐 Environment Configuration

### For Testnet Deployment

1. Create `.env` file in `contracts/` directory:

```bash
# Copy example file
cp env.example .env

# Edit with your values
nano .env
```

2. Add your configuration:

```env
GOERLI_RPC_URL=https://goerli.infura.io/v3/YOUR-PROJECT-ID
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR-PROJECT-ID
PRIVATE_KEY=your_private_key_here
ETHERSCAN_API_KEY=your_etherscan_api_key_here
REPORT_GAS=true
```

3. Deploy to testnet:

```bash
npm run deploy:goerli
# or
npm run deploy:sepolia
```

## 🎯 Wave 1 MVP Features

### ✅ Implemented
- **Smart Contract**: Basic loan functionality with rule-based approval
- **AI Backend**: Rule-based credit scoring (High/Medium/Low)
- **Frontend**: React app with wallet connection and loan forms
- **Wallet Integration**: MetaMask support
- **Basic UI**: Dashboard, loan request, credit score display

### 🔄 Rule-based Logic
- **High Credit**: txCount > 10 AND balance > 0.5 ETH
- **Medium Credit**: txCount 5-10
- **Low Credit**: txCount < 5

### 📊 Mock Data
- Backend uses mock blockchain data for Wave 1
- Real blockchain integration coming in Wave 2

## 🚨 Troubleshooting

### Common Issues

1. **Port already in use**
   ```bash
   # Kill process using port 3000
   lsof -ti:3000 | xargs kill -9
   ```

2. **MetaMask not connecting**
   - Ensure MetaMask is unlocked
   - Check if you're on the right network
   - Try refreshing the page

3. **Contract compilation errors**
   ```bash
   cd contracts
   rm -rf cache artifacts
   npm run compile
   ```

4. **Backend API errors**
   - Check if backend is running on port 3001
   - Verify CORS settings
   - Check console for error messages

### Debug Mode

```bash
# Backend with debug logging
cd backend
DEBUG=* npm run dev

# Frontend with React DevTools
cd frontend
npm run dev
```

## 📚 Next Steps

### Wave 2 (Planned)
- Real blockchain data integration
- Enhanced credit scoring algorithms
- Lending pools implementation

### Wave 3 (Planned)
- Machine learning models
- Advanced risk assessment
- Privacy features

### Wave 4 (Planned)
- 0G chain integration
- Cross-chain functionality
- Advanced DeFi features

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

MIT License © 2025 Credora

---

**Need Help?** Check the main README.md or create an issue in the repository.
