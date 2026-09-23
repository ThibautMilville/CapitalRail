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
- **Wallet connect toast (2026-09-23)**: success toast ("Wallet connected - 0x...") only on a real disconnected → connected transition after wagmi status has settled once. Skip the first settled observation (reload / reconnect hydration during the Three.js intro). Intentional Disconnect → Connect still toasts.
