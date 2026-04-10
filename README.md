# StellarForecast — Prediction Markets with AI Agent Oracles

**Live demo:** [stellar-forecast.vercel.app](https://stellar-forecast.vercel.app)

StellarForecast is the first prediction market on Stellar — and the first anywhere where an **AI agent acts as the oracle**. Users create real-world questions ("Will BTC hit $100k by May 1?"), bet USDC on YES or NO, and when the market closes a **Claude AI agent** researches the outcome, pays for price data via **x402 micropayments**, and resolves the market on-chain. Winners collect automatically.

### Why this is different

Prediction markets are a proven category — Polymarket does over $1B in volume. But every existing market relies on human oracle committees or centralized price feeds. StellarForecast replaces that with an autonomous AI agent that:

- **Pays for its own data** — the oracle uses x402 HTTP micropayments to buy price/event data from a paid feed, on-demand, per-resolution. No API keys hardcoded, no subscription billing.
- **Posts evidence on-chain** — the resolution includes an IPFS hash of what the agent found, so anyone can verify the decision.
- **Earns for honest work** — the oracle collects a 2% fee from each resolved market in USDC, creating a real economic loop: agent fetches data → pays for it → earns more than it spent.

This makes it a genuine **agent-to-agent commerce** story on Stellar: the oracle is an economic actor, not just a cron job.

---

## Table of Contents

- [What It Does](#what-it-does)
- [How It Works](#how-it-works)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Live Demo Setup](#live-demo-setup)
  - [Prerequisites](#prerequisites)
  - [Step 1 — Clone and Install](#step-1--clone-and-install)
  - [Step 2 — Deploy the Smart Contract](#step-2--deploy-the-smart-contract)
  - [Step 3 — Initialize the Contract](#step-3--initialize-the-contract)
  - [Step 4 — Start the Oracle and Data Feed](#step-4--start-the-oracle-and-data-feed)
  - [Step 5 — Start the Frontend](#step-5--start-the-frontend)
- [Environment Variables](#environment-variables)
- [Demo Walkthrough (for Screen Recording)](#demo-walkthrough-for-screen-recording)
- [Smart Contract Reference](#smart-contract-reference)
- [Project Structure](#project-structure)

---

## What It Does

| Step | Who does it | What happens on-chain |
|---|---|---|
| **Create a market** | Any user with a Stellar wallet | A binary YES/NO question is stored in the Soroban contract with an end time |
| **Bet YES or NO** | Any user | USDC is transferred from your wallet and locked in the contract escrow |
| **Oracle resolution** | Claude AI agent (autonomous) | Agent pays x402 micropayment for price data → evaluates outcome → calls `resolve()` on-chain with evidence hash → earns 2% fee |
| **Claim winnings** | Winners | Contract verifies you bet on the right side, calculates your share, transfers USDC to your wallet |

The entire flow — from bet to payout — runs without any human intervention or centralized backend holding funds.

---

## How It Works

```
  User                  Soroban Contract         Oracle Agent (Claude)     Data Feed (x402)
  ────                  ────────────────         ─────────────────────     ────────────────
  Connect wallet
  Create Market  ──────► Store question
  Bet YES/NO     ──────► Lock USDC in escrow

  (end_time passes — market moves to Closed state)

                                                 Poll: any closed markets?
                                                 Yes — fetch question
                                                 Pay x402 micropayment ──► Gate check
                                                                      ◄─── Price/event data
                                                 Claude reasons over data
                                                 POST resolve() ──────────► Contract verifies
                                                                             oracle address
                        Outcome stored on-chain ◄── Resolution accepted
                        Oracle fee paid to agent

  Claim Winnings ──────► Verify: winner?
                ◄─────── Transfer USDC share
```

**Every step uses real Stellar transactions:**
- Creating a market = Soroban contract call
- Betting = USDC transfer locked in the contract
- Oracle buying data = x402 USDC micropayment to the data feed's Stellar account
- Resolution = signed contract call from the oracle's Stellar keypair
- Claiming = USDC transfer from contract escrow to winner's wallet

**Trust model:**
- The oracle is fully autonomous — it runs on a schedule, no human triggers needed
- Evidence of each resolution is an IPFS hash posted on-chain, anyone can verify
- Only the designated oracle address can call `resolve()` — enforced by the contract
- All user funds live in the contract, never in any backend or oracle wallet

---

## Architecture

```
stellar-predict/
├── frontend/         Next.js app — user interface
├── contracts/        Soroban smart contract (Rust → WASM)
├── oracle/           Autonomous AI agent (Claude) that resolves markets
├── data-feed/        Price/event data API (x402 payment protocol)
├── deploy.js         Script to deploy the contract to Stellar
└── initialize.js     Script to configure the deployed contract
```

### Component Roles

**Frontend** — Next.js 14 app. Lets users connect a Stellar wallet, browse markets, place bets, and claim winnings. Talks to the blockchain via Soroban RPC. Has a thin API layer (`/api/`) that handles transaction submission and oracle status checks.

**Smart Contract** — Written in Rust using the Soroban SDK. Deployed to Stellar Testnet. Manages market state, holds all USDC in escrow, enforces rules (e.g., only the oracle can resolve), and handles payouts. State machine: `Open → Closed → Resolved`.

**Oracle** — An Express.js service that runs autonomously. Every few minutes it polls the contract for markets past their end time, uses Claude AI to evaluate the outcome based on fetched data, then calls `resolve()` on the contract with the result and an evidence hash.

**Data Feed** — A small Express.js service that exposes price and market data (sourced from CoinGecko). It uses the **x402 Payment Required** protocol — callers must include a micropayment proof in the request header to access data.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14, React 18, TypeScript, TailwindCSS, Framer Motion |
| Blockchain | Stellar Testnet, Soroban smart contracts |
| Smart Contract | Rust, Soroban SDK v22, compiled to WASM |
| Wallet | Stellar Wallets Kit (supports Freighter, xBull, etc.) |
| AI Oracle | Anthropic Claude (via `@anthropic-ai/sdk`) |
| Stablecoin | Circle USDC (Stellar testnet) |
| Data Layer | x402 HTTP micropayment protocol, CoinGecko API |
| Backend | Express.js (TypeScript) |

---

## Live Demo Setup

> **Note:** This runs on **Stellar Testnet**. No real money is involved. Wallets are funded via Stellar Friendbot.

### Prerequisites

- Node.js 18+
- Rust + `cargo` installed
- Stellar CLI (`stellar`) installed — [install guide](https://developers.stellar.org/docs/tools/stellar-cli)
- A Stellar Testnet wallet (e.g., [Freighter browser extension](https://www.freighter.app/))
- An Anthropic API key (for the oracle) — [get one here](https://console.anthropic.com/)

Verify your setup:
```bash
node --version      # v18+
cargo --version
stellar --version
```

---

### Step 1 — Clone and Install

```bash
git clone https://github.com/your-username/stellar-predict.git
cd stellar-predict

# Install all service dependencies
cd frontend  && npm install && cd ..
cd oracle    && npm install && cd ..
cd data-feed && npm install && cd ..
```

---

### Step 2 — Deploy the Smart Contract

```bash
# From the project root
node deploy.js
```

This script will:
1. Generate a temporary admin keypair and fund it via Friendbot
2. Compile the Rust contract to WASM
3. Upload and deploy it to Stellar Testnet
4. Write the contract ID to `.env.local`

Copy the contract ID printed in the terminal — you'll need it in the next step.

---

### Step 3 — Initialize the Contract

```bash
node initialize.js
```

This will:
1. Generate a dedicated oracle keypair and fund it via Friendbot
2. Set up the USDC trustline on the oracle account
3. Call `initialize()` on the contract with the oracle address, USDC token address, and 2% fee
4. Save the oracle secret key to `oracle/.env`

---

### Step 4 — Start the Oracle and Data Feed

```bash
# Option A — use the helper script
chmod +x start-workers.sh
./start-workers.sh

# Option B — start them separately
cd data-feed && npm run start &   # Runs on port 4001
cd oracle    && npm run start &   # Runs on port 3001
```

Verify both are running:
```bash
curl http://localhost:3001/health   # Oracle status
curl http://localhost:4001/health   # Data feed status
```

---

### Step 5 — Start the Frontend

```bash
cd frontend
cp .env.example .env.local
# Edit .env.local and set NEXT_PUBLIC_CONTRACT_ID to the contract ID from Step 2

npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Environment Variables

### `frontend/.env.local`
```env
NEXT_PUBLIC_CONTRACT_ID=C...        # From deploy.js output
RPC_URL=https://soroban-testnet.stellar.org
HORIZON_URL=https://horizon-testnet.stellar.org
```

### `oracle/.env`
```env
CONTRACT_ID=C...                    # Same contract ID
RPC_URL=https://soroban-testnet.stellar.org
HORIZON_URL=https://horizon-testnet.stellar.org
ORACLE_SK=SD...                     # Oracle secret key (from initialize.js)
DATA_FEED_URL=http://localhost:4001
ANTHROPIC_API_KEY=sk-ant-...        # Your Anthropic API key
PORT=3001
```

### `data-feed/.env`
```env
PORT=4001
PROVIDER_SK=SD...                   # Secret key for x402 payment receipts
PROVIDER_PK=GB...                   # Public key for x402 payment receipts
```

---

## Demo Walkthrough (for Screen Recording)

Target: **3 minutes**. Use the live app at [stellar-forecast.vercel.app](https://stellar-forecast.vercel.app) — no local setup needed for the demo.

> Prep before recording: Install [Freighter wallet](https://www.freighter.app/), switch it to **Testnet**, and fund it at [friendbot.stellar.org](https://friendbot.stellar.org) with your public key. Have a second Freighter profile ready (or use incognito + a second account).

---

### Scene 1 — Open the live app (0:00–0:20)
- Navigate to [stellar-forecast.vercel.app](https://stellar-forecast.vercel.app)
- Say: *"This is StellarForecast — a prediction market on Stellar where AI agents act as oracles."*
- Scroll through the existing markets to show what a live market looks like

### Scene 2 — Connect your wallet (0:20–0:40)
- Click **Connect Wallet** → select **Freighter** → approve in the extension
- Your Stellar address appears in the navbar — you're connected to Testnet with testnet USDC

### Scene 3 — Create a market (0:40–1:10)
- Click **Create Market**, fill in:
  - **Question:** `Will BTC be above $80,000 on April 15, 2025?`
  - **End Time:** 3 minutes from now (so the oracle fires during the demo)
  - **Initial Stake:** `10` USDC
- Click **Create** → approve the Freighter popup
- Say: *"That's a real Soroban transaction — the market is now stored on-chain, funds locked in the contract."*
- Return to home and show your market in the list

### Scene 4 — Place bets (1:10–1:45)
- Open your market → choose **YES** → enter `25 USDC` → approve
- Switch to your second wallet (incognito window) → connect it → bet **NO** with `15 USDC`
- Say: *"Both bets are locked in the smart contract. Nobody can touch these funds except the contract logic."*

### Scene 5 — The oracle resolves (1:45–2:20)
- Wait for the end time to pass (or show the terminal if running locally)
- Refresh the market page — the status changes from **Open** to **Closed**
- Within a minute it flips to **Resolved** with an outcome and evidence hash
- Say: *"The oracle — a Claude AI agent — detected this market was ready, paid for live price data via an x402 micropayment, and submitted the resolution on-chain. Here's the evidence hash: anyone can verify what the agent found."*
- If running locally, switch to the terminal and show:
  ```
  [Oracle] Found 1 market(s) to resolve
  [Oracle] Paying x402 data fee for BTC price...
  [Oracle] Claude verdict: YES — BTC price $82,400
  [Oracle] Submitting resolve() to contract...
  [Oracle] Market resolved. tx=abc123...
  ```

### Scene 6 — Claim winnings (2:20–2:50)
- Switch to the wallet that bet YES
- The market page shows a **Claim Winnings** button
- Click it → approve → show the USDC balance increase
- Say: *"The contract calculated the payout: your share of the total pool, minus the 2% fee that went to the oracle agent for doing its job."*

### Scene 7 — The code story (2:50–3:00, optional)
Point to three files that tell the whole story:
- [contracts/src/lib.rs](contracts/src/lib.rs) — the Soroban contract: escrow, state machine, payout math
- [oracle/src/index.ts](oracle/src/index.ts) — Claude calling `anthropic.messages.create()` and posting the result on-chain
- [data-feed/src/index.ts](data-feed/src/index.ts) — the x402 gate: no payment proof, no data

---

## Smart Contract Reference

### Functions

| Function | Who can call | Description |
|---|---|---|
| `initialize(token, oracle, fee_bps)` | Admin (once) | Set up contract with USDC address, oracle address, and fee in basis points |
| `create_market(creator, question, end_time)` | Anyone | Create a new binary market |
| `bet(bettor, market_id, outcome, amount)` | Anyone | Place a YES/NO bet with USDC |
| `resolve(oracle, market_id, outcome, evidence)` | Oracle only | Resolve a closed market with outcome and IPFS evidence hash |
| `claim(claimant, market_id)` | Winners only | Claim proportional USDC payout from resolved market |

### Market State Machine

```
Open ──(end_time passes)──► Closed ──(oracle resolves)──► Resolved
 │                                                              │
 └── betting allowed                                 winners can claim
```

### Payout Formula

```
winner_payout = (user_bet / total_winning_pool) × (total_pool × (1 - fee))
```

With the default 2% fee: if the total pool is 1000 USDC and you bet 100 USDC on the winning side (total winning bets = 400 USDC), you receive `(100/400) × 980 = 245 USDC`.

### Error Codes

| Code | Name | Meaning |
|---|---|---|
| 1 | AlreadyInitialized | Contract already set up |
| 2 | NotInitialized | Contract not yet initialized |
| 3 | MarketNotFound | Market ID does not exist |
| 4 | MarketNotOpen | Betting period has ended |
| 5 | MarketNotClosed | Market not yet ready for resolution |
| 6 | MarketNotResolved | Market not yet resolved, cannot claim |
| 7 | UnauthorizedOracle | Caller is not the oracle address |
| 8 | InvalidOutcome | Outcome must be YES or NO |
| 9 | ZeroAmount | Bet amount must be greater than 0 |
| 10 | BettingClosed | Market end time has passed |
| 11 | AlreadyClaimed | This address has already claimed winnings |
| 12 | NoBet | Address has no bet on this market |
| 13 | NotWinner | Bettor chose the wrong outcome |
| 14 | EndTimePast | Market end time is in the past |

---

## Project Structure

```
stellar-predict/
│
├── contracts/                     Soroban smart contract
│   ├── src/lib.rs                 Contract logic (market CRUD, betting, payouts)
│   └── Cargo.toml                 Rust dependencies
│
├── frontend/                      Next.js 14 web app
│   └── src/
│       ├── app/
│       │   ├── page.tsx           Home page — market listing
│       │   ├── create/page.tsx    Create market form
│       │   ├── market/[id]/       Individual market detail + betting UI
│       │   └── api/
│       │       ├── markets/       GET all markets from contract
│       │       ├── submit-tx/     POST signed XDR transactions
│       │       └── oracle/        Oracle health + status
│       ├── components/
│       │   ├── MarketCard.tsx     Market preview card
│       │   ├── Navbar.tsx         Navigation + wallet button
│       │   └── WalletConnect.tsx  Wallet connection modal
│       └── lib/
│           ├── stellar.ts         Stellar SDK helpers and contract client
│           └── types.ts           TypeScript interfaces
│
├── oracle/                        Autonomous AI oracle service
│   └── src/index.ts              Polls contract, uses Claude to resolve markets
│
├── data-feed/                     x402 data feed API
│   └── src/index.ts              Serves price data gated behind micropayments
│
├── deploy.js                      Deploy contract to Stellar Testnet
├── initialize.js                  Configure the deployed contract
├── start-workers.sh               Helper to start oracle + data-feed together
└── .env.example                   Root env template
```

---

## Deployed Contract & Live App

| | Link |
|---|---|
| Live app | [stellar-forecast.vercel.app](https://stellar-forecast.vercel.app) |
| Stellar Testnet contract | `CBCUO5ELKJXQS2K2QI625CXZYS3DCHCBFIOYW5YPMDCX7EOB235C2QHH` |
| Contract explorer | [Stellar Expert](https://stellar.expert/explorer/testnet/contract/CBCUO5ELKJXQS2K2QI625CXZYS3DCHCBFIOYW5YPMDCX7EOB235C2QHH) |

---

## License

MIT
