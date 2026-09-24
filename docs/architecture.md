# Architecture

## Stack

- Next.js 16 (App Router, Turbopack), React 19, TypeScript.
- Tailwind CSS v4.
- three.js (raw, no wrapper) for the opening intro.
- wagmi + viem, injected connector, chains BSC (56) and Avalanche (43114).
- `openai` SDK pointed at SERV Reasoning, `zod` for schemas.

## Folder layout (feature-based)

```
src/
  app/
    api/agent/route.ts, api/health/route.ts, api/intent/route.ts,
    api/position/route.ts, api/preflight/route.ts, api/stats/route.ts,
    api/exit/positions|redeem|claim|requests/route.ts, api/vaults/route.ts
    exit/page.tsx (redirect to /#exit), vaults/page.tsx, layout.tsx, page.tsx,
    globals.css, icon.svg
  features/agent/
    lib/  agent-schema, answer-question, fallback-answer (+ .test)
    ui/   AgentWidget (bottom-right launcher, teaser, panel)
  features/exit/
    lib/  build-exit, scan-positions, types
    ui/   ExitPanel, ExitSignPanel
  features/vaults/
    lib/  build-catalog, fetch-activity, types
    ui/   VaultsPage, TvlDonut
  features/preflight/
    lib/  api-snippet, attest-snapshot, decide-preflight (+ .test),
          intent-schema, mandate, parse-intent, request-intent, run-preflight,
          scan-rails, types, verdict
    ui/   BusinessModelSection, CheckingPanel, ContrastPanel, EvidenceBoard, ExpertDetails,
          FaqSection, FlowStepper, HowItWorksSection, IntentComposer,
          JudgeDemoBar, PipelineDiagram, PreflightPage, RailBoard,
          ReasoningTrace, RoadmapRails, RulesEditor, SignPanel, VerdictCard,
          WhyCapitalRailSection
  shared/
    http/    rate-limit.ts, instance-stats.ts, safe-error.ts
    ixs/     mcp.ts, rest.ts, types.ts
    serv/    client.ts, config.ts, schema.ts, system-prompt.ts, trace-types.ts
    ui/      CapitalRailMark, CustomCursor, GlowTitle, OpeningIntro,
             opening-intro-scene, SiteFooter, SiteHeader, Toast
    wallet/  chains.ts, demo-wallet.ts, Providers.tsx
```

Snapshot as of 2026-09-23 (guided flow + in-page exit + vaults catalogue). Update when files are added or moved.

Removed on 2026-09-23: `IntentChat`, `MandateBar`, `MandateForm`, `FlipBanner`, `HowItWorks`, `DecisionMemo`, `TxPackPanel`, `shared/ui/Skeleton` (replaced by `IntentComposer`, `RulesEditor`, `VerdictCard`, `SignPanel`, `ExpertDetails`, `CheckingPanel`).

## Data flow

1. User types a request in `IntentComposer` (or asks the agent before any verdict).
2. `POST /api/intent` parses it into a mandate (amount, chain, constraints) shown as "We understood" pills. Chain is a hard rule.
3. `POST /api/preflight` runs `scanRails`:
   - IXS REST `GET /vaults`
   - IXS MCP `POST https://api-v2.ixs.finance/mcp` (JSON-RPC over SSE), tools `vault_get`, `vault_check_whitelist`, `vault_build_request_deposit`, plus exit tools `vault_build_request_redeem`, `vault_build_claim_redeem`, `vault_request_status`.
   - A `User-Agent` header is required, otherwise IXS returns 403.
4. `decidePreflight` ("rules = code, judgment = SERV", since 2026-09-23):
   - `rules` (code, authoritative): per vault eligible + most blocking reason (chain, then settlement / KYC, then capacity); outcome GO / WAIT / NO-GO.
   - `risk` (SERV small): fact-grounded risk notes + independent eligibility cross-check; disagreements with the rules go to `trace.disagreements`.
   - `ranking` (SERV large): best eligible vault, ranking with reasons, memo, next steps.
   - `verification` (SERV small): pass / warn / fail; a hard fail vetoes a GO.
   Each SERV step: strict JSON schema, zod, semantic checks (ids, eligibility, numbers must appear in the payload), deterministic fallback with the same shape. Payload includes `ixsOpsFacts` from `src/shared/ixs/ops-facts.ts` (IXS Discord ops anchors) so SERV may cite cutoff / limit-0 meaning / min deposit without inventing.
5. Deterministic safety override re-checks the final GO (e.g. deposit limit 0 forces NO-GO whatever the model says).
6. On GO: unsigned tx pack + `snapshotHash` / `attestedAt`. With the placeholder demo wallet (`0x...0001`) the response is `preview: true` and carries no tx pack.
7. With a real wallet, `scanRails` compares the wallet USDC balance with the amount and blocks the rail with `INSUFFICIENT_BALANCE`.
8. `SignPanel` signs approve then deposit in order (waits for each receipt), then shows explorer links and the position from `GET /api/position?vaultId&wallet` (`shares`, `shareValueInAssets`, `assetBalance`).

### Exit flow (`#exit` on `/`)

1. `GET /api/exit/positions?wallet` lists vaults with share balance / maxRedeem via REST positions + `vault_get` settlement.
2. `POST /api/exit/redeem` calls `vault_build_request_redeem` (share amount in base units). IXS HYB ops (24 Sep 2026): no separate claim - operator finalizes USDC to the receiver; requests process against the next daily SGT cutoff. UI still keeps an optional claim fallback when MCP exposes one.
3. `POST /api/exit/claim` calls `vault_build_claim_redeem` when a request id is claimable (fallback path).
4. `GET /api/exit/requests` wraps `vault_request_status` (IXS feed can be down; the UI then accepts a pasted request id).

`ExitPanel` is embedded in `PreflightPage` below the entry flow; `/exit` only redirects to `/#exit`.

### Vaults catalogue (`/vaults`, `GET /api/vaults`)

1. REST `GET /vaults` is the source of truth for the list (4 items) - do not use MCP `vaults_list` alone.
2. Parallel MCP `vault_get` enriches settlement + pricing (`totalAssets`, `pricePerShare`, `totalSupply`).
3. Optional Goldsky activity via each vault `subgraphUrl` (normalize trailing `/gn`): ERC-7540 `depositRequests` / `redeemRequests`, or managed `vaultActivities`. Honest empty state when probes fail - no invented txs.
4. UI: cards, TVL donuts (by vault and by chain), recent activity list. `ttm` labeled as time to maturity, never APY.

## Live IXS vaults (IX High Yield Bond USDC)

| Chain | Access | Vault id | Notes |
|---|---|---|---|
| Avalanche | open | `6a952729732c2b84b55ce89d` | async; MCP limit 0 often = NAV stale (WAIT, never force); min 100 USDC; cutoff 5:00 PM SGT |
| Avalanche | whitelist | `6a9a59c6ef910c9d0495e7e3` | |
| BSC | whitelist | `6a8ecb61732c2b84b55ce88f` | |
| BSC | open | `6a26624ca7d16b245d665475` | the only GO path; reported `sync` earlier, `async-erc7540` on 2026-09-23 (value can change between scans) |

USDC decimals: 18 on BSC, 6 on Avalanche.

## Environment variables

| Name | Scope | Notes |
|---|---|---|
| `SERV_API_KEY` | server-only | Currently NOT set: the app runs in deterministic fallback |
| `SERV_MODEL_SMALL` | server | Default `gpt-5.4-mini` (intent, risk, verification, agent) |
| `SERV_MODEL_LARGE` | server | Default `gpt-5.4` (ranking + memo) |
| `SERV_PRICES_JSON` | server | Optional price table override for the cost estimate |
| `IXS_API_BASE_URL` | server | `https://api-v2.ixs.finance` |
| `IXS_MCP_URL` | server | `https://api-v2.ixs.finance/mcp` |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | public | Optional; the WalletConnect connector is only registered when set, injected wallet works without it |

## Production

- URL: https://capitalrail.ozc.fr (Dokploy OZC, Nixpacks Node 22, Traefik + Let's Encrypt).
- `SERV_API_KEY` may be empty on the host: SERV steps run in deterministic fallback until the key is set in Dokploy.

## Local run

```bash
npm run build
fuser -k 3456/tcp; nohup npm run start -- -p 3456 > /tmp/capitalrail.log 2>&1 &
```

- Local URL: http://localhost:3456 (dedicated CapitalRail port; 3003 was a temporary fallback).
- If `EADDRINUSE`: `fuser -k 3456/tcp`.
- Restart the server after each build, otherwise CSS assets return 500.

## Rate limits and stats (2026-09-23)

- In-memory per-IP limits per minute: preflight 12, intent 20, agent 20, position 30 (`src/shared/http/rate-limit.ts`). IP from `cf-connecting-ip`, then `x-real-ip`, then the last `x-forwarded-for` hop. Resets on restart.
- `GET /api/stats` (also inside `/api/health`): real counts of GO / WAIT / NO-GO served by this instance since start.

## Tests

- `npm test` runs `tsx --test 'src/**/*.test.ts'` (node:test).

## In progress (to be confirmed)

- Live SERV run once `SERV_API_KEY` is available (routing and prompts are ready, only fallback verified so far).

Done: multi-step pipeline (code rules -> SERV risk notes + cross-check -> ranking -> verifier, traced, deterministic fallback without `SERV_API_KEY`), model routing via env, bottom-right decision agent on `/api/agent` (also answers general questions without a check).

## Agent API surface (2026-09-23)

- Static OpenAPI 3: `public/openapi.yaml` (served at `/openapi.yaml`) - documents only `POST /api/preflight` and `POST /api/intent`.
- UI: `ForAgentsSection` (`#agents`) with curls, tool JSON, MCP Cursor config; header link Agents.
- Thin MCP: `mcp/server.ts` (`npm run mcp`), tools `capitalrail_preflight` / `capitalrail_intent`, env `CAPITALRAIL_BASE_URL` (default `https://capitalrail.ozc.fr`). Proxies to the Next routes; no duplicated decision logic.
- Snippets: `src/features/preflight/lib/agent-api-docs.ts`.
