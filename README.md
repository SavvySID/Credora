# Credora

## 🚀 Overview

Credora is an **AI-powered decentralized lending protocol** that provides fair, transparent, and data-driven credit decisions on-chain.

This is the base infrastructure:

* Borrowers can request loans directly on-chain.
* Lenders can provide funds through smart contracts.
* A simple AI-based scoring system evaluates wallet activity before approving a loan.

---

## Features

* **Wallet Connect**: Borrowers connect via MetaMask.
* **Loan Requests**: Users can request a loan amount directly from the frontend.
* **Rule-Based Eligibility**: Borrowers must meet basic wallet conditions (e.g., minimum balance, minimum transactions).
* **Repayment with Interest**: Borrowers can repay loans with a fixed interest rate.
* **Basic AI Scoring (Placeholder)**:

  * Backend simulates an AI score using dummy wallet transaction data.
  * Outputs: `High / Medium / Low` risk.
  * Used to approve or deny loan requests.

---

## 🛠️ Tech Stack

* **Smart Contracts**: Solidity (Hardhat/Foundry)
* **Frontend**: React + TypeScript
* **Wallet Integration**: MetaMask + Ethers.js
* **Backend (AI Simulation)**: Node.js/Python service returning mock credit scores
* **Blockchain**: Ethereum Testnet (Sepolia/Goerli recommended)

---

## 📂 Project Structure

```
credora/
│── contracts/        # Solidity smart contracts (Loan.sol)
│── frontend/         # React + TypeScript frontend
│── backend/          # AI scoring service (Node.js/Python)
│── test/             # Smart contract tests
│── scripts/          # Deployment scripts
│── README.md         # Project documentation
```

---

## ⚙️ Installation & Setup

### Prerequisites

- **Node.js** (v16 or higher)
- **npm** (v8 or higher)
- **MetaMask** browser extension
- **Ethereum testnet** (Goerli/Sepolia) with test ETH

### 1. Clone and Setup

```bash
git clone https://github.com/<your-username>/credora.git
cd credora
npm run install:all
```

### 2. Smart Contracts

```bash
# Navigate to contracts directory
cd contracts

# Install dependencies
npm install

# Compile contracts
npm run compile

# Run tests
npm test

# Deploy to local network (for testing)
npx hardhat node
npx hardhat run scripts/deploy.js --network localhost

# Deploy to testnet (optional)
# First, create .env file with your private key and RPC URLs
npx hardhat run scripts/deploy.js --network goerli
```

### 3. Backend AI Service

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Start the service
npm run dev
# or
npm start
```

The backend will run on `http://localhost:3001`

### 4. Frontend

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

The frontend will run on `http://localhost:3000`

### 5. Quick Start (All Services)

From the root directory:

```bash
# Terminal 1: Start backend
npm run dev:backend

# Terminal 2: Start frontend  
npm run dev:frontend

# Terminal 3: Start local blockchain (optional)
cd contracts && npx hardhat node
```

---

## How It Works (Wave 1)

1. Borrower connects wallet → requests loan.
2. Frontend calls backend AI service → generates dummy credit score.
3. If score passes threshold → loan request is sent to smart contract.
4. Loan is disbursed from lender’s pool.
5. Borrower repays loan + fixed interest.

---

## Current Limitations

* AI scoring is **mocked** (no real ML yet).
* Only **rule-based eligibility** in smart contract.
* No lending pools (direct borrowing only).
* No privacy/reputation features (coming in later waves).

## 🧪 Testing the API

### Test Credit Score Endpoint

```bash
# Test with example wallet
curl "http://localhost:3001/getCreditScore?wallet=0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6"

# Expected response:
{
  "wallet": "0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6",
  "creditScore": "High",
  "walletData": {
    "balance": "2.5 ETH",
    "transactionCount": 25,
    "lastActivity": "2024-01-15"
  },
  "timestamp": "2024-01-15T10:30:00.000Z",
  "wave": "Wave 1 MVP - Rule-based AI placeholder"
}
```

### Test Health Check

```bash
curl "http://localhost:3001/health"
```

---

## License

MIT License © 2025 Credora

---

