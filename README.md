# Credora

Credora is a credit-intelligence and accounting-only lending app on **0G Galileo** (chain id 16602).

Borrowers request and repay loans through the existing `Loan.sol` deployment. Credit standing comes from a **deterministic on-chain score**. AI risk is a **separate** 0G Compute assessment and never replaces that score.

## What this repo is

| Layer | Path | Role |
| --- | --- | --- |
| Contract | `contracts/Loan.sol` | Deployed on Galileo. Do not change or redeploy for current phases. |
| Indexer | `indexer/` | Reads chain + Chain Scan, writes Credora records to 0G Storage, serves the derived index. |
| API | `frontend/api/` | Scoring, 0G Compute risk engine, credit profile, lender, analytics. |
| App | `frontend/` | Wallet UI (wagmi + RainbowKit). |

Legacy `backend/` is unused for Phase 1–3.

## Features that are real

- Wallet connect on 0G Galileo
- `requestLoan` / `repayLoan` against the deployed contract (accounting only; principal is not disbursed)
- Deterministic Credora score `credora-onchain-v1` (0–1000, bands Building / Established / Excellent)
- Indexed wallet activity from 0G Chain Scan
- Credora records in 0G Storage; **verified** only after write → retrieve → content hash
- Structured AI risk via 0G Compute when an inference key is configured
- Assessment cache keyed by `wallet + sourceDataHash + eventType + model`
- Reputation badges from indexed facts (no “AI Approved”)
- Lender desk (lookup + indexed roster) and analytics from the index only

## What this is not

- Not a lending pool. Credora does not fund borrowers.
- Not dummy / placeholder AI. Missing Compute credentials yield `available: false`.
- Loan.sol is one loan per borrower, no disbursement, no honest `LoanDefaulted` in current usage. Overdue means `dueTime` passed while the loan is still active.

## Quick start

See [SETUP.md](SETUP.md) for environment files and commands.

```bash
# Indexer
cd indexer && npm install && npm run dev

# App (Vite + /api middleware)
cd frontend && npm install && npm run dev
```

App: http://localhost:3100  
Indexer: http://localhost:3200

## Tests

```bash
npm run test:indexer
npm run test:api
npm run preflight
npm run e2e:0g
npm run e2e:compute   # PASS, FAIL, or BLOCKED if no Compute key
npm run test:contracts
```

`e2e:loan` stays BLOCKED until the Galileo signer has enough 0G for borrow + repay. That is not a Phase 3 requirement.

Architecture, scoring, cache, and PASS vs BLOCKED: [docs/PHASE3.md](docs/PHASE3.md).

## License

MIT
