# CapitalRail

IXS entry preflight for the SERV Hackathon Edition 01 (RWA Vaults track, partner IXS).

Before any capital moves, CapitalRail checks the live IXS vaults (capacity, whitelist / KYC, withdrawal mode, balance) and answers **GO / WAIT / NO-GO** with reasons and fact-grounded risk notes. Only on GO, and only for your connected wallet, it prepares **unsigned** approve + deposit transactions that you sign yourself.

| | |
| --- | --- |
| Repo | https://github.com/ThibautMilville/CapitalRail |
| Live URL | TODO: add the deployed URL |
| Demo video | TODO: add the video link |
| Real deposit tx (1 USDC, BSC) | TODO: add the BscScan link of a real deposit made through CapitalRail |
| License | MIT |

## Why this product

IXS exposes one High Yield Bond product across four vaults (BSC / Avalanche, KYC vs open). The open Avalanche vault is listed as open but reports a deposit limit of `0`: a naive agent that reads "open" and deposits gets a failed or stuck transaction. CapitalRail treats that as the product: **preflight before deposit**.

## SERV usage: rules = code, judgment = SERV

CapitalRail does not ask a model to re-apply rules that code can check exactly. The split is explicit and visible in the trace:

| Step | Who | Tier (default model) | Output |
| --- | --- | --- | --- |
| Intent (`POST /api/intent`) | SERV | small (`gpt-5.4-mini`) | mandate from fuzzy free text |
| 1. Rules filter | **code** (authoritative) | - | per vault: eligible + most blocking reason; outcome GO / WAIT / NO-GO |
| 2. Risk notes + rules cross-check | SERV | small (`gpt-5.4-mini`) | fact-grounded risk notes (delayed ERC-7540 exit, time to maturity, small vault / concentration, KYC onboarding, capacity) + SERV's own eligibility view per vault |
| 3. Ranking + memo | SERV | large (`gpt-5.4`) | best eligible vault with a rationale, full ranking, investment memo, next steps |
| 4. Independent verifier | SERV | small (`gpt-5.4-mini`) | pass / warn / fail with typed issues; a hard `fail` vetoes a GO |
| Safety override | **code** | - | re-checks the final GO (open, buildable, inside the mandate) |
| Decision agent (`POST /api/agent`) | SERV | small (`gpt-5.4-mini`) | answers, cited facts, optional rule change to re-check |

- **SERV can veto an entry, never unlock one.** Where SERV's cross-check disagrees with the code rules, or the verifier contradicts the proposal, the disagreement is listed in the trace (`disagreements`) with how it was resolved.
- **Grounding**: every SERV step gets a strict JSON schema (`response_format: json_schema`, `strict: true`), is validated with zod, and passes semantic checks (every vault id exists, the selection is eligible, and every number in a risk note must appear in the payload). Numbers the model needs (for example the share of the vault your deposit would represent) are computed by code and passed as `derived` facts.
- **Model routing**: `SERV_MODEL_SMALL` (default `gpt-5.4-mini`) and `SERV_MODEL_LARGE` (default `gpt-5.4`), see `.env.example` and `src/shared/serv/config.ts`.
- **Trace**: per step the source (code / SERV / fallback), tier, model, latency, prompt / completion tokens and an **estimated cost** (OpenAI list prices checked 2026-09-23, labeled as an estimate; SERV billing may differ; override with `SERV_PRICES_JSON`). In fallback the trace shows a projected cost "if live", from payload size.
- **Fallback**: without `SERV_API_KEY`, or when a call fails or does not validate, each SERV step runs a deterministic fallback with the same output shape and the reason is recorded. The app is fully usable in fallback; the badge lives in "Details for experts", the verdict card only shows a subtle "Powered by SERV Reasoning" pill.

## Business model

1. **Preflight API for agents and wallets**: one call before any deposit (free tier, then pay-per-check).
2. **White-label "Can I enter?" widget + blocked-demand dashboard** for RWA issuers such as IXS: see how much demand is blocked by capacity, KYC or withdrawal rules.
3. **Capacity alerts**: get notified when a vault on WAIT reopens.
4. **Referral on validated deposits**, subject to an agreement with IXS.

No invented metrics: the page shows a real counter "Failed deposits avoided on this instance" (WAIT + NO-GO served by this server since start, in-memory), exposed on `GET /api/stats` and `GET /api/health`.

## API

All endpoints are rate limited per IP (in-memory): 429 with `{ "error", "code": "RATE_LIMITED", "retryAfterSec" }` and a `Retry-After` header.

```bash
# Health: IXS reachability, SERV key presence, routed models, instance stats
curl -s http://localhost:3003/api/health

# Preflight: GO / WAIT / NO-GO, rejected vaults, risk notes, disagreements, trace
curl -s -X POST http://localhost:3003/api/preflight \
  -H 'Content-Type: application/json' \
  -d '{
    "walletAddress": "0x0000000000000000000000000000000000000001",
    "amount": "1",
    "preferences": { "allowKyc": false, "requireSyncSettlement": false, "preferredChainId": 56 }
  }'

# Intent: free text (max 500 chars) to a mandate
curl -s -X POST http://localhost:3003/api/intent \
  -H 'Content-Type: application/json' \
  -d '{ "message": "500 USDC on BSC, no KYC, delayed withdrawals ok" }'

# Agent: general question (context null) or follow-up on the last preflight
curl -s -X POST http://localhost:3003/api/agent \
  -H 'Content-Type: application/json' \
  -d '{ "question": "How does KYC work?", "context": null }'

# Instance stats
curl -s http://localhost:3003/api/stats
```

The placeholder wallet `0x...0001` gets a public-data preview (`preview: true`, no tx pack, no balance read). The UI has a **Copy as API call** button under each verdict that copies the matching curl.

## Setup

```bash
cp .env.example .env.local
# optional: set SERV_API_KEY from https://console.openserv.ai
npm install
npm run dev -- -p 3003
```

Open http://localhost:3003. Production-like run:

```bash
npm run build
fuser -k 3003/tcp; nohup npm run start -- -p 3003 > /tmp/capitalrail.log 2>&1 &
```

Checks: `npx tsc --noEmit`, `npm run lint`, `npm test` (node:test via tsx).

## Project structure

```
src/
  app/api/          agent, health, intent, position, preflight, stats
  features/agent/   decision agent (lib + bottom-right widget)
  features/preflight/
    lib/            scan-rails, decide-preflight (+ tests), run-preflight, verdict, api-snippet
    ui/             guided flow, verdict card, reasoning trace, business model section
  shared/
    http/           rate-limit, instance-stats
    ixs/            REST + MCP clients
    serv/           SERV client, routing + price table, schemas, prompts, trace types
    wallet/         wagmi providers, chains, demo wallet
```

## Demo (2 min)

1. Open `/?judge=1` (experts details and the demo bar open).
2. Avalanche, delayed withdrawals ok: **WAIT** (open vault, deposit limit 0).
3. "Try BSC instead": **GO**, with risk notes (delayed exit, small vault) and the trace: code rules, SERV risk notes, ranking, verifier.
4. Connect a wallet on BSC, re-check with the real balance, sign approve then deposit.

## Safety

- No private keys on the server, nothing signed server-side, no custody.
- IXS MCP only returns unsigned calldata.
- SERV cannot invent vault facts, cannot unlock a vault the rules block, and every GO is re-checked by code.
- Not financial advice.
