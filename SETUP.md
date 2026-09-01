# Credora setup

Run **indexer** + **frontend**. Legacy `backend/` is unused for current work.

## Prerequisites

- Node.js 22.5+ (indexer uses `node:sqlite`)
- npm 8+
- MetaMask (or another injected wallet) with 0G Galileo (chain id 16602)
- Optional: 0G Compute inference key from https://pc.0g.ai
- Optional: Galileo private key funded from https://faucet.0g.ai for 0G Storage writes and loan txs

## Project layout

```
credora/
├── contracts/              # Loan.sol (already deployed; do not redeploy for Phases 1–3)
├── indexer/                # Chain + storage worker and read API
├── frontend/               # App + Vercel/Vite API
│   ├── api/                # Scoring, Compute, profile, lender, analytics
│   └── src/                # React UI
└── docs/PHASE3.md          # Architecture and honesty rules
```

## 1. Indexer

```bash
cd indexer
npm install
cp env.example .env         # then fill secrets
npm run dev                 # worker + HTTP server on :3200
```

Minimum `.env` (see `indexer/env.example`):

```
INDEXER_SHARED_SECRET=      # same value as the app API
LOAN_CONTRACT_ADDRESS=0x994463b7c46889bF640fFc79f6B1368f9374e6A2
LOAN_DEPLOY_BLOCK=52485479
OG_RPC_URL=https://evmrpc-testnet.0g.ai
OG_CHAIN_ID=16602
```

`OG_STORAGE_PRIVATE_KEY` is required for 0G Storage **writes**. Without it, writes are BLOCKED; reads and indexing still work. Restart the indexer after schema changes so `assessment_cache` is created.

## 2. App + API

```bash
cd frontend
npm install
cp .env.example .env.local  # then fill secrets
npm run dev                 # http://localhost:3100
```

Server-only (never `VITE_`):

```
INDEXER_URL=http://localhost:3200
INDEXER_SHARED_SECRET=      # must match indexer
ZG_COMPUTE_API_KEY=         # optional; AI risk stays unavailable until set
ZG_COMPUTE_MODEL=
```

Browser-safe:

```
VITE_LOAN_CONTRACT_ADDRESS=0x994463b7c46889bF640fFc79f6B1368f9374e6A2
VITE_0G_CHAIN_ID=16602
VITE_WALLETCONNECT_PROJECT_ID=
```

## 3. Network

Add Galileo in the wallet:

- RPC: `https://evmrpc-testnet.0g.ai`
- Chain id: `16602`
- Explorer: `https://chainscan-galileo.0g.ai`
- Symbol: `0G`

Faucet: https://faucet.0g.ai

Borrow/repay needs more than ~1.05 0G on the signing wallet (Phase 2 E2E). Credit intelligence does not wait on that.

## Commands

From the repo root:

| Command | What it does |
| --- | --- |
| `npm run dev:indexer` | Indexer worker + API |
| `npm run dev:frontend` | Vite app + `/api` |
| `npm run preflight` | Credential-free indexer probes (blocked capabilities are OK) |
| `npm run test:indexer` | Indexer unit tests |
| `npm run test:api` | Scoring, AI schema, Compute fallback tests |
| `npm run e2e:0g` | Live 0G Storage/chain proof |
| `npm run e2e:compute` | Live 0G Compute proof (exit 2 = BLOCKED) |
| `npm run e2e:loan` | Live borrow/repay (BLOCKED without funds) |
| `npm run test:contracts` | Hardhat tests for the existing Loan.sol |

## Contract tests (optional)

```bash
cd contracts
npm install
npm test
```

Do not redeploy `Loan.sol`. Address: `0x994463b7c46889bF640fFc79f6B1368f9374e6A2`.

## Troubleshooting

- **API 503 / indexer unavailable** — indexer not running, or `INDEXER_SHARED_SECRET` mismatch.
- **Compute Unavailable** — `ZG_COMPUTE_API_KEY` / `ZG_COMPUTE_MODEL` unset. Deterministic score still works.
- **Records stay unverified** — no `OG_STORAGE_PRIVATE_KEY`, or the key is unfunded. Status stays pending/unverified; the UI must not say Verified.
- **Loan tx reverts** — balance below 0.5 0G, existing active loan, or insufficient gas/value for repay.
- **Restart indexer** after pulling schema/cache changes.

Details: [docs/PHASE3.md](docs/PHASE3.md).
