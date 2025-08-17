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

### 1. Clone the Repo

```bash
git clone https://github.com/<your-username>/credora.git
cd credora
```

### 2. Smart Contracts

```bash
cd contracts
npm install
npx hardhat compile
npx hardhat test
```

### 3. Backend AI Service

```bash
cd backend
npm install   # or pip install -r requirements.txt
npm run start
```

### 4. Frontend

```bash
cd frontend
npm install
npm run dev
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

---

## License

MIT License © 2025 Credora

---

