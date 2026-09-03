# Architecture and local setup

Credora is a credit-intelligence app on 0G Galileo (chain id 16602). It scores wallets from public chain data, can call 0G Compute for a separate risk write-up, and writes assessments to 0G Storage when the indexer is running.

It is not a lending pool. `Loan.sol` records a request and a repay. Principal is not sent to the borrower.

The contract on Galileo is `0x994463b7c46889bF640fFc79f6B1368f9374e6A2`. Do not change or redeploy it.

Scoring details and honesty rules: [PHASE3.md](PHASE3.md). Env files and commands: [SETUP.md](../SETUP.md).

---

## 1. Architecture

There are four pieces:

| Piece | Path | What it does |
| --- | --- | --- |
| Contract | `contracts/Loan.sol` | Already deployed. Request and repay only. |
| Indexer | `indexer/` | Polls Galileo and Chain Scan, writes records to 0G Storage, serves the index and an SSE stream. |
| API | `frontend/api/` + `frontend/api-lib/` | Deterministic score, 0G Compute risk, credit profile, lender lookup, analytics. |
| App | `frontend/src/` | Wallet UI (wagmi + RainbowKit). Talks to `/api` only. |

`backend/` is leftover Wave 1 Express code. The current app does not use it.

```
                    wallet (Galileo 16602)
                              |
                              v
                     frontend (port 3100)
                              |
                              v
                    /api  (Vite or Vercel)
                     |              |
          score / profile      0G Compute
                     |         (risk JSON)
                     v
              indexer (port 3200)
                     |
         +-----------+-----------+
         |           |           |
         v           v           v
    0G Chain    0G Storage    SSE /stream
    + Chain Scan  (records)   (local only)
```

Authoritative data is chain state, Chain Scan history, and 0G Storage documents. The SQLite file at `indexer/data/credora-index.db` is a cache. You can delete it; the worker rebuilds from chain and storage.

### Two ways the API gets wallet facts

1. **Indexer running** (`INDEXER_URL` + matching `INDEXER_SHARED_SECRET`). Features, loans, records, analytics, and the borrower roster come from the index. Storage writes and the live stream work here.
2. **Indexer not reachable** (typical public Vercel deploy). The API reads Galileo RPC and Chain Scan itself (`frontend/api-lib/galileo.ts`). Score and Compute still run. Loans, verified records, analytics, and the lender roster stay empty or unavailable. That is intentional, not mocked.

### What the API actually computes

- **Credora score** (`credora-onchain-v1`): integer 0-1000 from balance, nonce, account age, recency, and repayment rate. Same inputs always give the same number. This is not ML and is not produced by Compute.
- **AI risk**: 0G Compute returns JSON (`riskLevel`, `riskScore` 0-1000 where higher means more risk, factors, summary). Validated before it is shown. If the router is down or the key is missing, the UI says unavailable. The Credora score does not change.
- **Verified**: only after the indexer writes a record to 0G Storage, reads it back, and the content hash matches. The UI must not say Verified before that.

---

## 2. 0G modules

### 0G Chain (Galileo)

Public RPC: `https://evmrpc-testnet.0g.ai`

Used for:

- Wallet connect and loan txs (`requestLoan`, `repayLoan`)
- `eth_getBalance` and `eth_getTransactionCount` for scoring
- Indexer log follow for `Loan.sol` events

Chain Scan (`https://chainscan-galileo.0g.ai/open/api`) is the explorer API. The indexer and the Galileo fallback use `txlist` for first-seen / last activity and tx mix. That history is what account-age and recency factors are built from.

### 0G Storage

Indexer URL: `https://indexer-storage-testnet-turbo.0g.ai`  
SDK: `@0gfoundation/0g-storage-ts-sdk` in `indexer/`

Used for Credora records (credit assessments, AI assessments, related metadata). Flow:

1. Worker uploads the record.
2. Worker downloads it by root hash.
3. Content hash must match (`recordId`). Only then is the record marked verified.

Uploads pay an on-chain fee, so `OG_STORAGE_PRIVATE_KEY` must be a funded Galileo key. Leave it blank and writes report BLOCKED. Reads and scoring still work.

Do not put this key on Vercel. Storage writes belong on the indexer process.

### 0G Compute

Router: `https://router-api.0g.ai/v1` (OpenAI-compatible `chat/completions`)

Used only for structured borrower-risk JSON. Key is created at https://pc.0g.ai with `inference` permission. Model id comes from `GET /v1/models` (this deploy uses `ZG_COMPUTE_MODEL`).

The key lives in `frontend/.env.local` as `ZG_COMPUTE_API_KEY`. Never prefix it with `VITE_`. The browser never sees it.

If Compute times out or returns junk, the API returns `available: false` and a reason. There is no canned High / Medium / Low fallback.

### Event stream (not a 0G product)

The sidebar "Stream" light is the indexer SSE endpoint `GET http://localhost:3200/stream`. It pushes indexed record events to the dashboard. It is Credora's own stream over public chain data, not a separate 0G Stream service.

On Vercel that URL is unset, so Stream stays grey.

---

## 3. Run it locally

Need Node 22.5+ (indexer uses `node:sqlite`), npm 8+, and a wallet that can add a custom chain.

### Galileo in the wallet

| | |
| --- | --- |
| RPC | `https://evmrpc-testnet.0g.ai` |
| Chain id | `16602` |
| Explorer | `https://chainscan-galileo.0g.ai` |
| Symbol | `0G` |
| Faucet | https://faucet.0g.ai |

### Indexer

```bash
cd indexer
npm install
cp env.example .env
```

Minimum `.env`:

```
INDEXER_SHARED_SECRET=          # any long random string; must match the app
LOAN_CONTRACT_ADDRESS=0x994463b7c46889bF640fFc79f6B1368f9374e6A2
LOAN_DEPLOY_BLOCK=52485479
OG_RPC_URL=https://evmrpc-testnet.0g.ai
OG_CHAIN_ID=16602
```

Optional: `OG_STORAGE_PRIVATE_KEY` (funded) if you want verified records.

```bash
npm run dev
```

Indexer listens on http://localhost:3200. Health: http://localhost:3200/health (needs the shared secret header if you curl it from the API path; the worker process itself is up if the port is open).

### App + API

```bash
cd frontend
npm install
cp .env.example .env.local
```

Server-only (no `VITE_` prefix):

```
INDEXER_URL=http://localhost:3200
INDEXER_SHARED_SECRET=          # same string as indexer/.env
ZG_COMPUTE_ROUTER_URL=https://router-api.0g.ai/v1
ZG_COMPUTE_API_KEY=             # optional
ZG_COMPUTE_MODEL=               # optional, from GET /v1/models
```

Browser-safe:

```
VITE_API_BASE_URL=/api
VITE_LOAN_CONTRACT_ADDRESS=0x994463b7c46889bF640fFc79f6B1368f9374e6A2
VITE_0G_CHAIN_ID=16602
VITE_0G_EXPLORER_URL=https://chainscan-galileo.0g.ai
VITE_WALLETCONNECT_PROJECT_ID=61504cb93d71213589068e461ce421ad
VITE_INDEXER_STREAM_URL=http://localhost:3200/stream
```

```bash
npm run dev
```

App: http://localhost:3100

Start the indexer first. Then open the app, connect a Galileo wallet, and check Credit score. The number should come back without Compute. Run AI assessment only if you set a Compute key.

### From the repo root

```bash
npm run dev:indexer
npm run dev:frontend
```

Useful checks:

```bash
npm run preflight      # indexer probes; blocked storage/compute is fine
npm run test:indexer
npm run test:api
npm run e2e:0g         # live storage/chain proof
npm run e2e:compute    # live Compute; exit 2 means no key (BLOCKED, not a fake pass)
```

`e2e:loan` needs a funded signer (more than about 1.05 0G). Credit scoring does not depend on it.

### What you should see

| Setup | Score | AI risk | Verified | Loans / analytics / stream |
| --- | --- | --- | --- | --- |
| Indexer + frontend, no Compute key | works | unavailable | only if storage key is funded | works once the worker has data |
| Indexer + frontend + Compute key | works | works when the router answers | same as above | same as above |
| Frontend only (or public Vercel, no hosted indexer) | works via Galileo RPC | works if the Compute key is on the API | no | empty or unavailable |

### Common failures

- API 503 on profile / analytics / lender roster: indexer not running, or `INDEXER_SHARED_SECRET` does not match.
- Compute unavailable: key or model unset, or the router timed out. Score is unchanged.
- Records stay unverified: no funded `OG_STORAGE_PRIVATE_KEY`.
- Loan tx reverts: under 0.5 0G, already have an active loan, or not enough value/gas to repay.

Do not run `backend/`. It is the old mock scorer.
