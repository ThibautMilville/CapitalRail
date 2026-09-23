# Brainstorm

Ideas log. Status: `done`, `in progress`, `idea`, `rejected`. Append new ideas at the bottom with a date.

| Date | Idea | Status | Notes |
|---|---|---|---|
| 2026-09-2x | Evidence Board | done | Raw IXS facts behind each decision |
| 2026-09-2x | Live mandate flip | done | Changing a chip flips GO / NO-GO live |
| 2026-09-2x | Shadow contrast: naive agent vs CapitalRail | done | Shows the naive agent failing on the AVAX deposit limit 0 |
| 2026-09-2x | GO attestation (`snapshotHash` + `attestedAt`) | done | |
| 2026-09-2x | Intent chat | done | Start a request in natural language |
| 2026-09-2x | Pipeline diagrams (Cloak multichain gold style) | done | |
| 2026-09-2x | "Coming soon" roadmap rails | done | Honest, no fake APY |
| 2026-09-2x | Multi-step SERV pipeline + trace | done | eligibility -> ranking -> verification |
| 2026-09-2x | Decision agent (bottom-left) | done | Question the decision; moved bottom-right on 2026-09-23 |
| 2026-09-2x | Token / latency measurement | idea | Show SERV cost and speed per step |
| 2026-09-2x | Add non-IXS vaults | rejected | Out of track |
| 2026-09-2x | Names: MandateForge and others | rejected | CapitalRail chosen |
| 2026-09-23 | How it works / Why CapitalRail / FAQ sections | done | Honest explainer before the footer, FAQ accordion reuses the collapse animation |
| 2026-09-23 | Guided A-to-Z flow with stepper | done | Tell us -> We check -> Decision -> Review & sign |
| 2026-09-23 | Verdict card with one-click fixes | done | Try other chain, use my balance, allow delayed withdrawals, re-check |
| 2026-09-23 | Details for experts + `?judge=1` demo bar | done | SERV trace and raw data stay one click away for judges |
| 2026-09-23 | Post-deposit success screen with position | done | Explorer link + `/api/position` |
| 2026-09-23 | Agent teaser bubble | done | Contextual, rare, dismissible, sessionStorage |
| 2026-09-23 | "Notify me when it opens" on WAIT | idea | Button shown with a "Soon" tag, no backend yet |
| 2026-09-23 | Balance-aware amount suggestion | done | "Use my balance" fix on "Not enough USDC." |
| 2026-09-23 | Token / latency / cost per step in the trace | done | Tier, tokens, latency, estimated cost (list prices), projected cost in fallback |
| 2026-09-23 | SERV risk notes + rules cross-check with disagreements | done | Replaces the eligibility restatement; "rules = code, judgment = SERV" |
| 2026-09-23 | Copy as API call under the verdict | done | Curl for POST /api/preflight with the current rules |
| 2026-09-23 | Business model section + real "failed deposits avoided" counter | done | In-memory per instance, `/api/stats` |
| 2026-09-23 | Exit / redeem flow using IXS MCP | done | In-page `#exit` section on `/` (redirect from `/exit`); redeem + claim; status feed graceful fallback |
| 2026-09-23 | Blocked-demand dashboard for IXS | idea | Aggregate WAIT / NO-GO causes per vault for the issuer |
| 2026-09-23 | Public `/vaults` catalog page | done | Live inventory: REST `/vaults` (4) + MCP `vault_get` pricing; show chain, KYC, settlement, TVL, price/share, ttm as maturity (not APY), transparency when present; CTA Check entry / Exit. Prefer REST list over MCP `vaults_list` (only 2 whitelist vaults). Skip null metrics, inactive ixsRewards, subgraph/rpc/ratePool. |
| 2026-09-23 | OpenJEV (Jev) for GO/WAIT/NO-GO class | rejected | TypeSafe System One via openjev.sh; real API, not OpenServ. Outcome stays code-owned; no OPENJEV_API_KEY; would not help SERV-meaningful scoring. Optional advisory-only later if a key appears. |
| 2026-09-23 | Agent-facing REST + OpenAPI + thin MCP | done | Section `#agents`, `public/openapi.yaml` (preflight + intent only), curl/tool snippets, `mcp/server.ts` via `npm run mcp` |
