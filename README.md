# Credora

> **Architecture (submission requirement):** [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
>
> Covers the system diagram, which 0G modules are used and how, and local reproduction steps.

> **0G proof pack (submission requirement):** Galileo testnet (chain id 16602), not 0G mainnet.
>
> - **Contract:** [`0x994463b7c46889bF640fFc79f6B1368f9374e6A2`](https://chainscan-galileo.0g.ai/address/0x994463b7c46889bF640fFc79f6B1368f9374e6A2) (`Loan.sol`)
> - **Explorer:** [chainscan-galileo.0g.ai](https://chainscan-galileo.0g.ai/address/0x994463b7c46889bF640fFc79f6B1368f9374e6A2)
> - **Live demo:** [credora-frontend-puce.vercel.app](https://credora-frontend-puce.vercel.app)
> - **0G Chain:** wallet connect, `requestLoan` / `repayLoan`, balance and nonce for the Credora score
> - **0G Compute:** structured AI risk on the live demo (`POST /api/risk-assessment`). Independent of the score.
> - **0G Storage:** write → retrieve → hash on the indexer. Not on the public Vercel URL (no hosted indexer).

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

## Documentation

| What judges asked for | Where it is |
| --- | --- |
| Architecture | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| Which 0G modules, and how | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#2-0g-modules) |
| Local deploy / reproduce | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#3-run-it-locally) and [SETUP.md](SETUP.md) |
| Scoring, cache, PASS vs BLOCKED | [docs/PHASE3.md](docs/PHASE3.md) |

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

Architecture and 0G modules: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Scoring rules: [docs/PHASE3.md](docs/PHASE3.md).

## License

MIT
