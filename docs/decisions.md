# Decisions

Append-only journal of decisions and user feedback. Format: `YYYY-MM-DD - decision - short reason`. Exact days before 2026-09-23 are approximate (`2026-09-2x`).

## 2026-09-2x

- **Product**: CapitalRail, an IXS entry preflight agent (GO / NO-GO / WAIT before any deposit).
- **Name**: CapitalRail chosen over MandateForge and other candidates.
- **Code**: English identifiers, feature-based structure (`features/`, `shared/`).
- **Scope**: IXS vaults only, no non-IXS vaults (track fit).
- **Single CTA**: "Judge Demo" and "Run preflight" merged into one "Check entry".
- **Visuals**: no background particles or dust.
- **Logo**: abstract hex gate + dual rails (not a letter), simplified.
- **Footer**: official OpenServ logo.
- **Header**: Cloak-like, full width; wallet Connect button moved into the header.
- **Intro**: Three.js, inspired by Pioneers. No text over the animation; the app name appears under the logo at the end with a color sweep, holds ~0.9s. Plays on every refresh, skipped with `prefers-reduced-motion`.
- **UI details**: custom cursor, custom scrollbars, Cloak-style toasts.
- **Revenue display**: honest "Coming soon" roadmap rails, no fake APY.

## 2026-09-23

- **Docs**: `docs/` folder created as living documentation, plus Cursor rule `.cursor/rules/hackathon-docs.mdc`.
- **Language**: all project content (code, UI, docs, commits) in English; only chat replies to the user in French.
- **Header**: compact floating bar aligned with the main content column (max ~1052px inside the 1100px column) instead of full width; name hidden (sr-only) between md and lg to fit the nav.
- **Explainer + FAQ**: `HowItWorksSection` (6 steps), `WhyCapitalRailSection` (no custody, unsigned tx, attested snapshot, Avalanche deposit limit 0 refusal) and an accessible animated `FaqSection` (8 Q&As, "not financial advice") added before the footer; header nav gains "How" and "FAQ".
- **Preflight loop fix**: the live-flip effect depended on `result`, so every run re-armed a 350 ms rerun (endless "Preflight WAIT - 4 rails scanned" toasts). Preflight now runs only on explicit actions (Check entry, intent ready, agent rerun/patch) and once per real mandate change, compared against the last run key (ref); `runPreflight` is stable (mandate via ref), stale responses are ignored, toasts fire once per run.
- **False WAIT fix**: IXS MCP calls sometimes hung ~60 s then dropped (`terminated`); `vault_get` on the BSC sync rail failed, settlement became `unknown`, the sync-only mandate excluded it and only Avalanche limit-0 rails remained, so WAIT. MCP calls now use a 12 s timeout with 2 retries on network/429/5xx errors (tool errors never retried), REST calls a 10 s timeout, and scans with an unexplained failure on a permissionless rail are not cached. Default mandate (1 USDC, sync, BSC, no KYC) gives GO again in ~3-15 s instead of ~64 s.
- **Lint**: `set-state-in-effect` errors removed (`useSyncExternalStore` for reduced motion in `OpeningIntro` and client mount in `Toast`, render-time wallet address sync in `PreflightPage`); `npm run lint` has zero errors.
- **Agent widget**: launcher and panel moved from bottom-left to bottom-right (user expectation from his other sites); launcher shows an "Ask CapitalRail" label from `sm` up. Toasts stay top-right, so they never overlap it.
- **Local port**: CapitalRail runs on 3003 (3456 dropped; 3002 is ozc-signaletique, never kill it).
- **Guided flow**: the page becomes a four-step flow (Tell us, We check, Decision, Review & sign) with a stepper; mandate bar, intent chat, flip banner and tx pack panel are replaced by `IntentComposer`, `RulesEditor`, `CheckingPanel`, `VerdictCard`, `SignPanel`. Technical panels move into a collapsed "Details for experts"; `?judge=1` opens it and adds a demo bar.
- **Safety**: the placeholder demo wallet only gets a preview (`preview: true`, no tx pack); a real wallet with less USDC than the amount gets `INSUFFICIENT_BALANCE`; signing is disabled unless the connected wallet is the checked wallet and no check is running; approve must be mined before deposit; success screen shows BscScan / Snowtrace links and the position.
- **Chain is a hard rule**: a vault on another chain than the chosen one is `CHAIN_MISMATCH` (ineligible), no longer a ranking preference.
- **WAIT semantics**: WAIT only when a vault fitting every rule is blocked only by deposit limit 0; otherwise NO-GO with fixes.
- **IXS data change**: the BSC open vault now reports `async-erc7540` (was `sync`), so "instant withdrawals only" can give NO-GO; the demo mandate and the examples use "delayed withdrawals ok".
- **Lexicon**: user copy says vault, instant / delayed withdrawals, KYC; dev details (ids, hashes, calldata) only in expert details or "Transaction details".
- **Header**: nav reduced to "How it works" and "FAQ"; wallet dropdown (network, "Switch to BSC", "Disconnect"); mobile menu. Toasts moved below the header so they never cover the wallet button.
- **WalletConnect**: connector registered only when `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` is set; otherwise injected only.
- **Agent launcher**: logo-only (`CapitalRailMark`, no "Ask CapitalRail" label), float + glow ring + hover lift + open/close morph, all disabled with `prefers-reduced-motion`. Mirrors the OZC Signaletique chatbot pattern.
- **Agent teaser**: first after 7 s, then every 30 s, visible 5.5 s, dismissible; never during the intro, with the panel open, or with the tab hidden; on mobile never while the sign step is on screen; stops after 2 dismissals or once the agent was opened (sessionStorage). Text depends on phase: before a verdict, after GO, after WAIT / NO-GO. Clicking it opens the agent.
- **Hero**: the "How it works" toggle no longer sits on its own line; it is removed and replaced by an inline "How it works" link at the end of the tagline.

## 2026-09-23 (jury review fixes)

- **SERV role**: "rules = code, judgment = SERV". The SERV eligibility step (which only restated `mandateViolation` / `capacityBlock`) is replaced by a deterministic `rules` trace step (authoritative, source `code`) plus a SERV `risk` step: fact-grounded risk notes (delayed ERC-7540 exit, ttm, small vault / concentration, KYC onboarding, capacity) and an independent per-vault cross-check. Disagreements with the rules are surfaced in `trace.disagreements`, never followed silently. Reason: the jury scored "SERV meaningful" 3/10.
- **Outcome ownership**: GO / WAIT / NO-GO is set by code; SERV ranks the eligible vaults with a rationale and writes the memo. The verifier returns pass / warn / fail; a `fail` citing a fact or rule vetoes a GO, anything softer is a warning. SERV can veto an entry, never unlock one.
- **Grounding check**: every number in a SERV risk note must appear in the payload; the deposit share of the vault is computed by code (`derived.amountShareOfVaultAssetsPct`).
- **Model routing**: defaults `SERV_MODEL_SMALL=gpt-5.4-mini`, `SERV_MODEL_LARGE=gpt-5.4` (large = ranking + memo only), env-overridable.
- **Cost estimate**: price table constant at OpenAI list prices (checked 2026-09-23), labeled as an estimate, overridable with `SERV_PRICES_JSON`; fallback steps show a projected cost "if live" from payload size.
- **Verdict card**: fallback badge removed from the card (now only in Details for experts); subtle "Powered by SERV Reasoning" pill; "Worth knowing" risk notes; "Copy as API call" copies a curl.
- **Cause ordering**: rules report chain, then mandate violations (settlement, KYC), then capacity; a pending whitelist outranks a 0 limit. WAIT now requires the limit-0 vault to have no whitelist or balance block.
- **Preview honesty**: preview copy says "IXS can prepare"; the placeholder wallet (`0x...0001`, which holds real third-party funds) never gets a balance read.
- **Rate limiting**: in-memory per-IP limiter on `/api/preflight`, `/api/intent`, `/api/agent`, `/api/position` (429 JSON + `Retry-After`); question / message length capped at 500.
- **Latency honesty**: CheckingPanel says "Live IXS check, usually 3-15 s" with a real elapsed counter; no streaming (not worth the complexity now).
- **Mobile teaser**: hidden while the composer, rules chips or sign step are on screen (IntersectionObserver on `[data-agent-avoid]`).
- **Revenue**: Business model section (`#business`, header nav) with 4 offers and a real counter "Failed deposits avoided on this instance" (WAIT + NO-GO served since server start, `GET /api/stats`, also in `/api/health`). No invented metrics.
- **Agent without context**: general questions (what, how, KYC, chains, withdrawals, SERV) are answered from static product facts (SERV when a key is set, keyword fallback otherwise) and end with an offer to run a check; deposit-like text still becomes a request.
- **Agent panel sizing**: fixed height per screen type, like the OZC Signaletique chatbot but truly fixed: desktop 410 x 590 (tablet 400 x 580) capped by `100dvh - 10.75rem`; mobile portrait full-width bottom sheet `min(78dvh, visual viewport - 0.75rem)`, safe-area aware, lifted above the on-screen keyboard via `visualViewport`; landscape phones use the full short height next to the launcher. Header and composer fixed, only the messages scroll (overscroll contained, app scrollbar, auto-scroll to the latest message); suggestion chips scroll horizontally so the footer height never changes.
- **Hygiene**: unused default SVGs removed from `public/`, MIT `LICENSE`, README rewritten (port 3003, SERV usage, business model, API with curl, TODO placeholders for live URL / video / real tx), `npm test` (node:test via tsx) covering the safety override, WAIT vs NO-GO, cause ordering, risk notes, rate limiter and the agent fallback.
- **Agent panel, no blur** (user feedback): the backdrop is now fully transparent with no `backdrop-filter` (it only catches click-outside-to-close), and the panel itself drops `backdrop-blur-xl` for a solid background, so the page behind stays sharp and undimmed.
- **Agent suggestion chips wrap** (user feedback): chips use `flex-wrap` (no horizontal scroll, no nowrap), the messages area has `overflow-x: hidden` and long words wrap; the panel keeps its fixed height, so extra chip lines only shrink the message list.
- **Publish (2026-09-23)**: public GitHub repo `ThibautMilville/CapitalRail` under the personal account (not an org). Pre-publish secret audit passed (`.env.local` gitignored and empty of secrets; placeholders only in `.env.example`). No deploy in this step; `SERV_API_KEY` still unset (fallback mode).
- **README cleanup (2026-09-23)**: public README rewritten as a product presentation only - removed Live URL / Demo video / real tx TODO slots, localhost ports, hackathon ops noise, and "remaining actions" style content; kept architecture, SERV usage, business model, API curls with `$BASE_URL`, and a generic Getting started. Deleted unused scaffolding `AGENTS.md`, `CLAUDE.md`, and empty `src/shared/three/`; both agent files added to `.gitignore` so `next dev` regeneration stays out of the public tree.
- **Local port back to 3456 (2026-09-23)**: CapitalRail dedicated port restored to 3456 after freeing ORGA (:5173) and ozc-signaletique (:3000/:3001); 3003 was only a temporary fallback while 3002 was busy.
- **Production on Dokploy OZC (2026-09-23)**: live at `https://capitalrail.ozc.fr`. Dokploy application (not compose/GHCR): public git clone of `ThibautMilville/CapitalRail` (`master`) + Nixpacks with Node 22 (`nixpacks.toml` + `engines.node`). No OZC GitHub app provider for the personal repo. `SERV_API_KEY` left empty on the host so SERV runs in fallback until added in Dokploy. Wildcard `*.ozc.fr` DNS already points at Cloudflare in front of the VPS.
- **CTA icons (2026-09-23)**: primary action buttons get compact inline SVG icons (`src/shared/ui/icons.tsx`, no icon library) - Connect wallet, Check my entry, Approve / Deposit, agent Send / Apply and re-check, verdict primary / Re-check, Copy as API call. Suggestion chips stay text-only.
- **Wallet connect toast (2026-09-23)**: success toast ("Wallet connected - 0x...") only when the user clicked Connect in this page session (`userInitiatedConnectRef`). Reload / wagmi reconnect during the Three.js intro never toasts. Intentional Disconnect → Connect still toasts.
- **Intro scroll lock (2026-09-23)**: no page scrollbar or scroll until the opening overlay fully exits (not just when `cr-intro-done` is set). CSS locks `html:not(.cr-intro-done)` from first paint; `cr-intro-scroll-lock` / `body.cr-intro-active` stay through the exit fade; wheel/touchmove prevented while the overlay is up.
- **Exit flow (2026-09-23)**: separate `/exit` page (header Enter / Exit) rather than stuffing redeem into the entry stepper. Uses IXS MCP `vault_build_request_redeem` / `vault_build_claim_redeem` / `vault_request_status`; share amounts in base units; honest async vs queued copy; status feed failures degrade to pasted request id. Post-deposit success links to Exit.
- **Agent chrome after intro (2026-09-23)**: the bottom-right launcher (CapitalRailMark in a circle, readable as a "k") and teaser were visible during the intro exit fade because `cr-intro-done` is set when exit starts and the shell reveals under a transparent overlay. Added `cr-intro-chrome-ready` only when the overlay is fully gone (or reduced-motion skip); CSS + teaser JS hide all agent UI until then.
- **Intro BR chrome mis-ID (2026-09-23)**: the dark circle with a "k >" mark during the Three.js intro was `.cr-intro-skip` (skip-forward SVG: bar + chevron), not CapitalRailMark / agent launcher. `cr-intro-chrome-ready` alone was the wrong target. Skip is now plain text, `opacity: 0` until hover/focus, Escape also skips; agent root uses `display: none` until `cr-intro-chrome-ready`.
- **Intro bottom-right circle (2026-09-23)**: the dark circle with a "k >" glyph during the Three.js intro was `.cr-intro-skip` (skip-forward SVG), not the agent launcher and not an extension. Previous `cr-intro-chrome-ready` hide was the wrong target. Skip is now plain uppercase text (no circular FAB). Agent hide CSS broadened to all `[class*="cr-agent-"]` until chrome-ready.

## 2026-09-23 (IXS data inventory for Vaults surface)

- Live probe of REST `GET /vaults` + MCP `tools/list` / `vault_get` / `vault_request_status` / `vaults_list`.
- **Decision (pending implement)**: prefer a dedicated `/vaults` catalog over stuffing more stats into expert Details. Source of truth for the list is REST (4 vaults); do not use MCP `vaults_list` alone (returns only 2 whitelist vaults). Enrich with `vault_get` pricing (`totalAssets`, `pricePerShare`, `settlement`).
- **Honesty**: show `ttm` as IXS-reported time to maturity, never as APY. Skip null `metrics`, inactive `ixsRewards`, broken `logoUrl`, raw `subgraphUrl` / `rpcUrl` / `ratePool*` in user UI.
- **Known IXS gaps**: `vault_request_status` still 404 on subgraph feed; MCP tool `vault_build_claim_deposit` unused (entry claim path for async deposits); BSC open vault settlement is live `sync` again (was `async-erc7540` earlier the same day).

- **Dokploy redeploy policy (2026-09-23)**: Do not redeploy Dokploy/production after each change unless the user explicitly asks; local verify is enough; push to git OK when committing.
- **Pipeline diagram restored (2026-09-23)**: `PipelineDiagram` was still in Experts only after the guided-flow redesign. It is wired back into the main journey: animated live schema inside CheckingPanel during "We check", again above VerdictCard when a result exists (and while re-checking), plus an idle schema in `HowItWorksSection`. Stepper kept. SVG def ids are unique per instance; SMIL pulses respect `prefers-reduced-motion`.

- **Multiline intent composers (2026-09-23)**: `IntentComposer` and agent composer use `textarea` (Enter = newline, Ctrl/Cmd+Enter or primary button submits). Paste of multiline text preserved; "Check my entry" / Send flow unchanged.

## 2026-09-23 (single-page Exit section + Vaults catalogue)

- **UX**: no Enter/Exit header modes or segmented control. Home keeps Enter/preflight at the top; Exit is a dedicated lower section (`#exit`) for redeem/claim. Header: Vaults, How, Business, FAQ + wallet. `/exit` redirects to `/#exit`; post-deposit success links to `#exit`.
- **Footer**: `.cr-app-shell` uses `min-height: 100dvh; display: flex; flex-direction: column` with page `flex-1` and footer after main (not position sticky/fixed).
- **Vaults**: `GET /api/vaults` = REST list + parallel `vault_get` + Goldsky activity probe. Page `/vaults` with catalogue cards, TVL donuts, activity list. RailBoard shows TVL + ttm. No fake APY; skip broken logos / null metrics in primary UI.
- **IXS gaps unchanged**: `vault_request_status` flaky; `vault_build_claim_deposit` unused - not blocking.

- **Business model stats layout (2026-09-23)**: "Failed deposits avoided" counter stacks under the section title at full width (`w-full`). Removed `md:flex-row` / `justify-between` that placed the card beside the title on desktop.

- **IntentComposer layout (2026-09-23)**: textarea full width with `resize-none` (no native resize grip). "Check my entry" sits below in a `justify-end` row, not beside the field on `sm+`. Enter = newline, Ctrl/Cmd+Enter submit unchanged.

## 2026-09-23 (Jev / OpenJEV for GO-WAIT-NO-GO - not integrated)

- **What it is**: "Jev" here is TypeSafe's System One model, exposed publicly as **OpenJEV** (`https://openjev.sh`, `POST https://api.openjev.sh/v1/systemone`, env `OPENJEV_API_KEY`). Typed answers only: `choice`, `score`, `noul` - built for classify / route / score / rank. Not an OpenServ product; not mentioned in the SERV Hackathon brief. Distinct from `jevai.net` marketing site.
- **Why relevant on paper**: a `choice` over `GO` / `WAIT` / `NO-GO` with calibrated probabilities matches the preflight verdict shape.
- **Why we do not integrate now**:
  1. CapitalRail already owns the outcome in code (`codeDecision` + safety override); SERV does judgment (risk, ranking, memo, veto). Letting Jev set or soft-replace GO/WAIT/NO-GO would fight "rules = code, judgment = SERV".
  2. No `OPENJEV_API_KEY` in the project; unauthenticated calls return 401. A fake local "Jev-like" classifier would be dishonest.
  3. Hackathon scoring needs meaningful **SERV Reasoning**, not a second vendor. Jev would not help that criterion and would add key / rate-limit / privacy surface.
- **Closest alternative already in place**: deterministic rules filter for the class, SERV risk cross-check + disagreements, independent verifier that may veto a GO, never unlock one.
- **If revisited later**: optional, key-gated advisory `choice` in the trace only (disagreement when Jev != code at high confidence); never unlock a GO; never invent answers without a live OpenJEV response.

## 2026-09-23 (agent-facing surface vs Hatrey)

- **Positioning**: CapitalRail is a preflight gatekeeper other agents call before allocating to IXS vaults - not a desk. Humans keep the guided UI; agents use REST first.
- **Shipped**: home section `#agents` (nav Agents), static OpenAPI 3 at `public/openapi.yaml` documenting exactly `POST /api/preflight` and `POST /api/intent`, curl + OpenAI/Anthropic tool snippets, VerdictCard "Copy as API call" points at OpenAPI / `#agents`.
- **MCP**: thin stdio server `mcp/server.ts` (`npm run mcp`) with tools `capitalrail_preflight` and `capitalrail_intent` that HTTP-call the Next API via `CAPITALRAIL_BASE_URL` (default production). Does not weaken rate limits or Origin checks.
- **Honesty**: no API auth today; rate limited; browser cross-site Origin blocked. Documented in OpenAPI info + For agents section.

## 2026-09-23 (branded 404 + toast corner)

- **404**: root `src/app/not-found.tsx` (navy / emerald-cyan, CapitalRailMark, Geist via layout). Links home, `/vaults`, `/#agents`. No `global-not-found` (experimental; single root layout). `data-cr-skip-intro` + CSS `:has()` skip Three.js OpeningIntro on 404.
- **Toasts**: stack flush viewport top-right (`top` + safe-area only, high z-index above header); no longer offset under SiteHeader (`top-20` / `sm:top-24` removed).
- **Deploy**: production Dokploy app `l7HAVs_hx4Rzi4YGdPLQg` (`capitalrail.ozc.fr`) after push to `master`.

## 2026-09-24 (IXS Discord ops facts - Emirax/IXS to Tim/Cutoff)

- **Source**: IXS Discord, 24 Sep 2026 (Emirax/IXS -> Tim/Cutoff). Encoded in `src/shared/ixs/ops-facts.ts` as `IXS_OPS_FACTS`, injected into SERV risk/ranking/verification payloads as `ixsOpsFacts`.
- **MCP limit 0**: on Avalanche HYB open vault `6a952729732c2b84b55ce89d`, limit 0 relates to NAV staleness/drift - not permanently closed. CapitalRail still WAIT / refuses when MCP build fails with limit 0; no Avalanche `deposit()` bypass; safety override unchanged.
- **Min deposit**: 100 USDC on that Avalanche product. Soft UI hint in RulesEditor when chain=Avalanche and amount < 100; BSC small demos (e.g. 1 USDC) not hard-blocked.
- **Settlement**: daily cutoff 5:00 PM SGT (UTC+8), Singapore business days Mon-Fri; requests anytime, processed against next cutoff; deposits and redemptions. Singapore public holidays unanswered - not invented.
- **Redemption**: no separate claim step (operator finalizes USDC to receiver). FAQ / Exit copy updated; optional MCP claim UI kept as fallback.
- **Copy surfaces**: VerdictCard/verdict WAIT, decide-preflight explain + fallback risk/memo, Contrast/Why/Evidence/Pipeline/FAQ/How/Agents/OpenAPI/README - NAV-staleness + do-not-force-deposit language; differentiation vs Cutoff stays gatekeeper.
- **No Dokploy redeploy** in this change unless the user asks.

## 2026-09-24 (model routing cost cut + ranking why harden)

- **Reversal vs 2026-09-23 OpenJEV rejection (scope only)**: OpenJEV stays rejected for GO/WAIT/NO-GO. Now allowed for the **fast intent path only** (choice/noul for KYC / sync / chain; amount via regex) when `OPENJEV_API_KEY` is set. Without the key, intent uses SERV `fast` (`gpt-5.4-mini`). Never unlocks a GO.
- **Model policy** (`src/shared/serv/model-policy.ts`): tiers `fast` / `small` / `large`. Defaults: intent+verification=`fast`, risk+ranking+agent=`small`. Ranking moved off `gpt-5.4` onto mini by default (restore with `SERV_TIER_RANKING=large`). Env: `SERV_MODEL_FAST|SMALL|LARGE`, optional `SERV_TIER_*`.
- **Ranking fallback fix**: live prod saw intermittent `ranking.0.why` > 300 chars -> schema fail -> fallback. Server-side truncate of bounded strings before zod (`sanitizeServPayload`); ranking prompt now requires `why` <= 280 chars. Keep zod max at 300.
- **Health**: `/api/health` reports `models`, `tiers`, and `openjev` (configured flag + steps) with no secrets.

## 2026-09-24 (jury fix - decision copy alignment + demo UX)

- **Bug**: after verifier veto (or NO-GO/WAIT), ranking memo/nextSteps could still say proceed / prepare deposit while decision was NO-GO.
- **Fix**: `alignDecisionCopy` (`src/features/preflight/lib/align-decision-copy.ts`) regenerates memo + next steps whenever final decision is not GO (veto, safety override, or code WAIT/NO-GO). Unsigned tx pack only on GO (`run-preflight`); SignPanel only mounts on GO.
- **Progress UI**: `CheckingPanel` shows explicit pipeline steps (scan → rules → SERV risk → ranking → verification → decision) with timed active state.
- **Jury traces**: compact `JuryTraceSummary` on result (rules / SERV / verifier / final) - not raw JSON; full JSON stays under Details.
- **Demo**: `docs/demo-scenarios.md` with exact GO / WAIT / NO-GO prompts; README expanded (architecture, IXS sources, SERV place, guardrails, screenshots).
- **Vaults**: skeleton cards instead of lone Loading text on first paint.
