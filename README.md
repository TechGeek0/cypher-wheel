# Cypher Wheel — holder-weighted raffle with buyback + burn

A working raffle wheel for a Pump.fun token. Holders get sqrt-weighted tickets,
a provably-fair draw picks a winner each round, a slice of the SOL pot buys the
token back and burns it, and the rest is paid to the winner.

```
buy → pool grows → snapshot holders → weighted tickets →
commit-reveal draw → buyback+burn a cut → pay winner → repeat
```

## What's in here

```
backend/   Node/Express. Snapshot, ticket engine, RNG, Jupiter buyback, payout, scheduler, API.
frontend/  React + Vite. The wheel, prize pool, countdown, leaderboard, spin history.
```

The frontend runs standalone with live demo data if the backend isn't up yet —
open it and the wheel spins immediately. Point it at the backend to go real.

## Run it

**Frontend (works on its own):**
```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
```

**Backend:**
```bash
cd backend
npm install
cp .env.example .env     # then fill it in (see below)
npm run dev             # http://localhost:8787
```

The frontend proxies `/api` to `:8787`, so with both running it uses real data.

## Configure the backend (`.env`)

| Key | What it is |
|-----|------------|
| `RPC_URL` | Helius mainnet RPC (free key at helius.dev) |
| `TOKEN_MINT` | Your token's mint — paste it right after launch |
| `POOL_WALLET_SECRET` | Base58 secret of the wallet that holds + pays the pot |
| `EXCLUDED_ADDRESSES` | Comma-separated: bonding curve / LP, creator, treasury — never win |
| `ROUND_INTERVAL_SECONDS` | Time between spins (default 3600) |
| `MIN_BALANCE` | Min token balance to qualify for a ticket |
| `WEIGHTING` | `sqrt` (recommended), `linear`, or `tiered` |
| `BUYBACK_PERCENT` | % of each pot spent on buyback before payout |
| `BUYBACK_MODE` | `burn` or `pool` |
| `DRY_RUN` | **`true` = simulate, move no funds. Start here.** |

## Launch-day runbook

1. **Now (before mint):** start the frontend so the wheel/landing is live. The
   demo-data fallback means you have something to show instantly.
2. **At mint:** paste `TOKEN_MINT` into `.env`. Add the bonding-curve/LP address
   and your creator wallet to `EXCLUDED_ADDRESSES` — this is the #1 thing people
   check for "is it rigged."
3. **Keep `DRY_RUN=true`** and run a few manual spins:
   ```bash
   curl -X POST localhost:8787/api/spin -H "x-admin-key: changeme"
   ```
   Confirm the winner, ticket math, and buyback/prize split look right in the logs
   and at `/api/rounds`.
4. **Fund the pool wallet** with a seed amount so the first pots aren't dust.
5. **Flip `DRY_RUN=false`** only once you've verified a dry round end-to-end and
   double-checked the pool wallet secret is the right one. This moves real SOL.

## Provably fair

Each round:
- A `serverSeed` is generated and its `sha256` (`commitment`) is recorded **before**
  any entropy exists.
- A fresh finalized Solana `blockhash` is captured as public entropy.
- `winningTicket = HMAC_SHA256(serverSeed, blockhash) mod totalTickets`.
- The seed is revealed after. Anyone can verify via `GET /api/verify/:id`.

The server can't pick the blockhash; the public can't know the seed — so neither
side can grind the outcome.

## API

| Route | Purpose |
|-------|---------|
| `GET /api/state` | pool, next spin, config, last round, live holder preview |
| `GET /api/leaderboard` | current holders → tickets → odds |
| `GET /api/rounds?limit=` | spin history |
| `GET /api/verify/:id` | recompute and confirm a round was fair |
| `POST /api/spin` | manual spin (header `x-admin-key`) |

## Tuning the wheel

- **Whales dominating?** `sqrt` already softens this; switch to `tiered` and edit
  the ladder in `backend/src/services/tickets.js`.
- **Snapshot sniping** (buy at T-1, dump at T+1): the spin already fires at an
  unannounced interval tick. For more protection, add time-weighted holding —
  the snapshot service is the place to do it.

## A note on framing

A balance-weighted draw with SOL payouts looks a lot like a lottery, which carries
gambling-law exposure in many jurisdictions. The usual safer framing is a
**holder rewards / giveaway** with no separate paid ticket. Keep your copy on that
side of the line. This isn't legal advice — worth a real check for your audience.
