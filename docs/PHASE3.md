# Phase 3 — AI credit intelligence

Phase 3 adds real 0G Compute risk assessments, caching, reputation, a lender desk, and analytics on top of the Phase 1 indexer and Phase 2 Galileo loan flows.

It does **not** change or redeploy `Loan.sol` (`0x994463b7c46889bF640fFc79f6B1368f9374e6A2` on chain 16602).

## Architecture

```
Wallet / Galileo RPC ──► frontend (wagmi)
                              │
                              ▼
                     frontend/api
                     (score, Compute, profile)
                              │
                              ▼
                          indexer
              ┌─────────────┼──────────────┐
              ▼             ▼              ▼
         0G Chain     0G Storage      0G Compute
         + Chain Scan  (records)      (risk JSON)
```

Authoritative sources: chain state, Chain Scan activity, 0G Storage documents. SQLite is a derived index and cache only.

## Deterministic score (baseline)

Model id: `credora-onchain-v1` in `frontend/api/_lib/scoring.ts`.

- Output: integer **0–1000**
- **creditBand:** Building (0–399) · Established (400–699) · Excellent (700–1000)
- `riskLevel` on this object still names the **rating band** (High = best band). Do not use it as AI risk.
- Factors, methodology, confidence, completeness are always returned
- AI cannot modify this number
- Record `source` = `derived`, `eventType` = `credit_assessment`

Repeated POSTs with the same `sourceDataHash` + model reuse the cached record (no duplicate assessments).

## AI risk (separate)

Implemented in `api/_lib/compute.ts` (`assessBorrowerRisk`) and `api/_lib/riskEngine.ts`.

0G Compute returns structured JSON validated by Zod (`api/_lib/riskSchema.ts`):

| Field | Meaning |
| --- | --- |
| `riskLevel` | Low / Medium / High — **actual risk** |
| `riskScore` | 0–1000, **higher = more risk** |
| `keyRiskFactors` / `positiveFactors` | Short strings from the facts |
| `assessmentSummary` | Short narrative |
| `confidence` | 0–1 |

Record `source` = `compute` only after a validated inference. If the key, model, timeout, or schema fails: `available: false` and an honest `blockedReason`. No hardcoded scores.

Prompt input is structured facts only (balance, nonce, age, recency, tx mix, loans, overdue, deterministic score/factors, completeness). The model is instructed not to invent loans, txs, balances, or scores.

Transport: `POST {ZG_COMPUTE_ROUTER_URL}/chat/completions`, temperature 0. Secrets stay on the API server (`ZG_COMPUTE_*`), never `VITE_`.

## sourceDataHash and cache

`indexer/src/lib/sourceHash.ts` hashes canonical JSON with **keccak256** (same `contentHash` as records). `fetchedAt` is excluded.

Cache key: `wallet + sourceDataHash + eventType + model` in SQLite `assessment_cache`.

- Hit: reuse the stored assessment; do not call Compute
- Miss (e.g. balance change → new hash): run Compute (AI) or scoring (deterministic) and insert

## 0G Storage verification

A record is **verified** only after:

1. write to 0G Storage  
2. retrieve by root hash  
3. content hash (`recordId`) matches  

Pending / failed / unverified are distinct UI states. Writes without `OG_STORAGE_PRIVATE_KEY` are BLOCKED.

## Reputation

Pure rules in `indexer/src/lib/reputation.ts` (mirrored for the API profile). Earned badges only:

- Verified Credit Record
- On-chain Active (activity in last 7 days)
- Established Wallet (age ≥ 30 days and nonce ≥ 10)
- Consistent Repayer (repaid ≥ 1, rate = 1, overdue = 0)
- Verified Profile (any 0G-verified record)

There is no “AI Approved” badge.

## Lender desk

Routes: `/lender`, `/lender/:address`. APIs: `GET /api/lender/borrowers`, `GET /api/credit-profile?address=`.

Roster = wallets that already have indexed loans **or** assessments. Unknown addresses show empty intelligence. This is **not** a marketplace: no Fund / Approve / Invest.

## Analytics

`GET /api/analytics` → indexer `GET /analytics/summary`. Counts from the index only. Charts omit themselves when there is not enough real data (“Insufficient data”). Defaulted stays unsupported unless a real `LoanDefaulted` event exists.

## Loan.sol limitations (honest)

- No lender pool and no principal disbursement
- One loan per borrower
- Events have no loan id (derived off-chain)
- `LoanDefaulted` is not used in product copy; **Overdue** = due time passed while active
- Accounting-only: request/repay still need native 0G for gas (and repay value)

## Environment variables

**Indexer** (`indexer/.env`): `INDEXER_SHARED_SECRET`, `LOAN_CONTRACT_ADDRESS`, `LOAN_DEPLOY_BLOCK`, `OG_RPC_URL`, `OG_CHAIN_ID`, `OG_STORAGE_PRIVATE_KEY` (writes), Chain Scan URLs, `DATABASE_PATH`.

**API** (`frontend/.env.local`): `INDEXER_URL`, `INDEXER_SHARED_SECRET`, `ZG_COMPUTE_API_KEY`, `ZG_COMPUTE_MODEL`, `ZG_COMPUTE_ROUTER_URL`, `ZG_COMPUTE_TIMEOUT_MS`.

**Browser:** `VITE_LOAN_CONTRACT_ADDRESS`, `VITE_0G_CHAIN_ID`, `VITE_WALLETCONNECT_PROJECT_ID`, `VITE_INDEXER_STREAM_URL`.

## PASS vs BLOCKED

| Check | PASS means | BLOCKED means |
| --- | --- | --- |
| `npm run preflight` | Public probes work | Storage writes / loan indexing / Compute creds missing (allowed) |
| `npm run e2e:0g` | Real storage or chain proof succeeded | Missing funded storage key or network |
| `npm run e2e:compute` | Live router returned valid risk JSON | No key/model (exit 2). Never mocked as PASS |
| `npm run e2e:loan` | On-chain request + repay | Insufficient Galileo 0G (not a Phase 3 blocker) |
| Unit tests | Schema, hash, score, cache, badges | N/A |

Code that calls Compute is **not** the same as Compute being integrated. Integration requires a successful `e2e:compute` (or an equivalent live POST `/api/risk-assessment` with `available: true`).
