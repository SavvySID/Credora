# Credora frontend

Wallet UI and local/Vercel API for Credora on 0G Galileo.

```bash
cd frontend
npm install
npm run dev     # http://localhost:3100
```

Pair with the indexer (`npm run dev:indexer` from the repo root). Setup: [SETUP.md](../SETUP.md). Architecture: [docs/PHASE3.md](../docs/PHASE3.md).

---

## Routes

| Route               | Notes                                                    |
| ------------------- | -------------------------------------------------------- |
| `/`                 | Marketing landing                                        |
| `/dashboard`        | Primary product surface                                  |
| `/borrow`           | Request a loan (`/loan-request` redirects here)          |
| `/credit-score`     | Deterministic score + AI risk when available             |
| `/loans`            | Indexed loans                                            |
| `/loans/:loanId`    | Loan detail                                              |
| `/activity`         | Activity feed                                            |
| `/lender`           | Indexed borrower lookup (not a funding desk)             |
| `/lender/:address`  | Borrower intelligence                                    |
| `/analytics`        | Indexed counts only                                      |
| `/account`          | Wallet, network, profile and 0G service status           |
| `*`                 | Not-found state                                          |

Wallet connection is the only authentication step. Gated routes share `ConnectGate`.

---

## How scoring works

- Live scoring and AI risk live in `api/` (deterministic `credora-onchain-v1`, 0G Compute JSON).
- The browser talks to `/api` and the indexer stream; it does not invent scores.
- Loan terms mirror `Loan.sol`: 5% fixed interest, 30-day term, >0.5 0G minimum balance, requests capped at 2× balance.
- Wallet access runs through wagmi + RainbowKit.

---

## Design system

Tokens live in `tailwind.config.js`; base styles in `src/styles/index.css`.

- **Canvas** warm off-white `#F6F5F1`, white surfaces, warm hairline borders.
- **Brand** deep ink-teal ramp (`brandsolid` for primary actions, `brand-500` for accents and data).
- **Semantic** positive / caution / critical / info.
- **Type** Inter for UI, Inter Tight for display, JetBrains Mono for addresses and hashes. Financial figures use tabular numerals.

Charts are hand-built SVG in `src/components/charts/`.

### Light and dark themes

Colour tokens resolve through CSS variables. A `dark` class on `<html>` re-themes the app.

- `src/contexts/ThemeContext.tsx` holds `light` / `dark` / `system` and persists to `localStorage`.
- An inline script in `index.html` applies the class before first paint.
- `ThemeToggle` / `ThemeSelect` live in `src/components/ui/ThemeToggle.tsx`.

### Structure

```
src/
├── components/
│   ├── ui/
│   ├── charts/
│   ├── layout/
│   ├── credit/
│   ├── lender/
│   ├── loans/
│   ├── activity/
│   └── wallet/
├── contexts/
├── services/
├── hooks/
├── lib/
└── pages/
api/
├── _lib/          scoring, compute, indexer client, risk schema
├── credit-score.ts
├── credit-profile.ts
├── risk-assessment.ts
├── lender/
└── analytics.ts
```

---

## Scripts

| Command             | Description                      |
| ------------------- | -------------------------------- |
| `npm run dev`       | Dev server on port 3100          |
| `npm run build`     | Typecheck, then production build |
| `npm run typecheck` | `tsc --noEmit` for app and API   |
| `npm run test:api`  | API unit tests                   |
| `npm run preview`   | Serve the production build       |
