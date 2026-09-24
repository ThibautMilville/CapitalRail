# CapitalRail

IXS entry preflight for the SERV Hackathon Edition 01 (RWA Vaults track, partner IXS).

Before any capital moves, CapitalRail checks the live IXS vaults (capacity, whitelist / KYC, withdrawal mode, balance) and answers **GO / WAIT / NO-GO** with reasons and fact-grounded risk notes. Only on GO, and only for your connected wallet, it prepares **unsigned** approve + deposit transactions that you sign yourself.

| | |
| --- | --- |
| Live | https://capitalrail.ozc.fr |
| Repo | https://github.com/ThibautMilville/CapitalRail |
| License | MIT |

## Why this product

IXS exposes one High Yield Bond product across four vaults (BSC / Avalanche, KYC vs open). The open Avalanche vault is listed as open but MCP can report a deposit limit of `0` (often NAV staleness/drift, not permanently closed). A naive agent that reads "open" and deposits - or that forces a deposit past limit 0 - gets a failed or stuck transaction. CapitalRail treats that as the product: **preflight before deposit**, KEEP WAIT until MCP build succeeds.

Settlement for async HYB rails: daily cutoff **5:00 PM SGT (UTC+8)** on Singapore business days (Mon-Fri), for deposits and redemptions. Min deposit on Avalanche HYB: **100 USDC**. Redemptions: no separate claim step (operator finalizes).

## How it works

A four-step guided flow:

1. **Tell us** - amount, chain, KYC preference, and withdrawal mode (or free-text intent).
2. **We check** - live scan of IXS rails (REST + MCP), then rules and SERV judgment.
3. **Decision** - GO / WAIT / NO-GO with rejected vaults, risk notes, ranking, and an investment memo.
4. **Review & sign** - on GO only: unsigned approve + deposit calldata for the connected wallet.

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
- **Fallback**: without `SERV_API_KEY`, or when a call fails or does not validate, each SERV step runs a deterministic fallback with the same output shape and the reason is recorded. The app stays fully usable in fallback.

## Key features

- Live IXS vault scan (capacity, KYC / whitelist, settlement mode, balance)
- Authoritative code rules + SERV risk notes, ranking, memo, and verifier
- Unsigned tx pack only on GO for the checked connected wallet
- Decision agent for general questions or follow-ups on the last preflight
- Rate-limited API for agents and wallets
- Honest instance counter of avoided failed deposits (WAIT + NO-GO)

## Tech stack

Next.js (App Router), React, TypeScript, Tailwind CSS, wagmi / viem, zod, Three.js (intro), OpenAI-compatible SERV client, IXS REST + MCP.

## Business model

1. **Preflight API for agents and wallets**: one call before any deposit (free tier, then pay-per-check).
2. **White-label "Can I enter?" widget + blocked-demand dashboard** for RWA issuers such as IXS: see how much demand is blocked by capacity, KYC or withdrawal rules.
3. **Capacity alerts**: get notified when a vault on WAIT reopens.
4. **Referral on validated deposits**, subject to an agreement with IXS.

No invented metrics: the page shows a real counter "Failed deposits avoided on this instance" (WAIT + NO-GO served by this server since start, in-memory), exposed on `GET /api/stats` and `GET /api/health`.

## For agents

CapitalRail is a **preflight gatekeeper** other agents call before allocating to IXS vaults - not a trading desk.

| | |
| --- | --- |
| OpenAPI 3 | [`/openapi.yaml`](./public/openapi.yaml) (live: https://capitalrail.ozc.fr/openapi.yaml) |
| UI | Section `#agents` on the home page (nav: Agents) |
| Tools | `POST /api/preflight` (GO / WAIT / NO-GO) and `POST /api/intent` (message → mandate) |

Copy-paste curls, OpenAI/Anthropic tool JSON, and Cursor MCP config live in the For agents section. No API auth today; rate limited per IP; browser cross-site Origin blocked.

**Agent rule**: when `decision` is WAIT / reason `DEPOSIT_LIMIT_ZERO`, do not force a deposit (limit 0 may mean NAV stale). Wait for a successful MCP build. Async rails settle against the daily SGT cutoff.

### MCP (optional)

Thin stdio MCP that HTTP-calls the same REST API:

```bash
# default CAPITALRAIL_BASE_URL=https://capitalrail.ozc.fr
npm run mcp
```

Cursor example (`mcp.json`):

```json
{
  "mcpServers": {
    "capitalrail": {
      "command": "npx",
      "args": ["tsx", "mcp/server.ts"],
      "cwd": "/absolute/path/to/CapitalRail",
      "env": {
        "CAPITALRAIL_BASE_URL": "https://capitalrail.ozc.fr"
      }
    }
  }
}
```

Tools: `capitalrail_preflight`, `capitalrail_intent`.

## API

All endpoints are rate limited per IP (in-memory): 429 with `{ "error", "code": "RATE_LIMITED", "retryAfterSec" }` and a `Retry-After` header.

Replace `$BASE_URL` with your deployed host (for example `https://your-host.example`).

```bash
# Health: IXS reachability, SERV key presence, routed models, instance stats
curl -s "$BASE_URL/api/health"

# Preflight: GO / WAIT / NO-GO, rejected vaults, risk notes, disagreements, trace
curl -s -X POST "$BASE_URL/api/preflight" \
  -H 'Content-Type: application/json' \
  -d '{
    "walletAddress": "0x0000000000000000000000000000000000000001",
    "amount": "1",
    "preferences": { "allowKyc": false, "requireSyncSettlement": false, "preferredChainId": 56 }
  }'

# Intent: free text (max 500 chars) to a mandate
curl -s -X POST "$BASE_URL/api/intent" \
  -H 'Content-Type: application/json' \
  -d '{ "message": "500 USDC on BSC, no KYC, delayed withdrawals ok" }'

# Agent: general question (context null) or follow-up on the last preflight
curl -s -X POST "$BASE_URL/api/agent" \
  -H 'Content-Type: application/json' \
  -d '{ "question": "How does KYC work?", "context": null }'

# Instance stats
curl -s "$BASE_URL/api/stats"
```

The placeholder wallet `0x...0001` gets a public-data preview (`preview: true`, no tx pack, no balance read). The UI has a **Copy as API call** button under each verdict that copies the matching curl.

## Getting started

```bash
git clone https://github.com/ThibautMilville/CapitalRail.git
cd CapitalRail
cp .env.example .env.local
# optional: set SERV_API_KEY from https://console.openserv.ai
npm install
npm run build
npm run start
```

Checks: `npx tsc --noEmit`, `npm run lint`, `npm test` (node:test via tsx).

## Project structure

```
src/
  app/api/          agent, health, intent, position, preflight, stats, exit/*, vaults
  features/agent/   decision agent (lib + widget)
  features/preflight/
    lib/            scan-rails, decide-preflight (+ tests), run-preflight, verdict, api-snippet, agent-api-docs
    ui/             guided flow, verdict card, ForAgentsSection, business model section
  shared/
    http/           rate-limit, instance-stats, origin
    ixs/            REST + MCP clients
    serv/           SERV client, routing + price table, schemas, prompts, trace types
    wallet/         wagmi providers, chains, demo wallet
mcp/
  server.ts         thin MCP (capitalrail_preflight, capitalrail_intent) → HTTP API
public/
  openapi.yaml      OpenAPI 3 for the two agent tools
```

## Safety

- No private keys on the server, nothing signed server-side, no custody.
- IXS MCP only returns unsigned calldata.
- SERV cannot invent vault facts, cannot unlock a vault the rules block, and every GO is re-checked by code.
- Not financial advice.
