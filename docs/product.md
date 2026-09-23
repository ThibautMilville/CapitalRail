# Product

## Vision

CapitalRail is an **IXS entry preflight agent**. Before any capital moves, it:

1. scans the live IXS rails (vaults, limits, whitelists),
2. applies the hard rules in code (**GO / NO-GO / WAIT**) and lets SERV do the judgment: risk notes grounded in IXS facts, an independent cross-check of the rules, ranking with a rationale, the memo and a verifier that can veto a GO,
3. packs **unsigned** transactions only when capacity is real.

## Product thesis

A naive agent reads "vault open" and tries to deposit. On the Avalanche IX High Yield Bond USDC vault, the deposit limit is `0`: the transaction fails or gets stuck. CapitalRail checks real capacity (limit, whitelist, deposit mode) before proposing anything, and prevents that failure.

## Target users

- Treasurers and allocators who want exposure to tokenized RWA without failed transactions.
- DeFi users who want to understand why a vault is or is not accessible.
- Agent builders who need a reliable "can I enter?" step before execution.

## UX

Guided flow in four steps, shown by a stepper: **Tell us -> We check -> Decision -> Review & sign**.

1. **Tell us**: one sentence ("500 USDC, no KYC, instant withdrawals") or examples; the parsed rules appear as "We understood" pills, editable ("Edit rules": amount, Any chain / BSC / Avalanche, instant withdrawals only, allow KYC vaults). Single CTA: "Check my entry".
2. **We check**: four plain-language checks animate while IXS is scanned.
3. **Decision**: verdict card ("You can enter." / "Not right now." / "No vault fits your rules." / "Not enough USDC."), plain reasons, "Worth knowing" risk notes, one-click fixes ("Try BSC instead", "Use my balance", "Allow delayed withdrawals", "Re-check now"), a subtle "Powered by SERV Reasoning" pill, "Show reasoning" and "Copy as API call". The SERV / fallback status lives in Details for experts. Preview (no wallet) says "IXS can prepare".
4. **Review & sign**: only on GO. Requires a connected wallet matching the checked wallet; re-checks with the real balance and whitelist, then signs approve then deposit, and ends on a success screen with the explorer link and the resulting position.

- **Details for experts** (collapsed): SERV trace, all vaults, evidence, naive agent vs CapitalRail, pipeline, memo and proof. `?judge=1` opens it by default and shows a demo bar (Avalanche WAIT -> Try BSC -> GO -> sign).
- **Decision agent (bottom-right)**: logo-only launcher with a contextual teaser; before a verdict it turns free text into rules, after a verdict it explains the decision and can apply rule changes.
- **Vocabulary**: "vault" not "rail", "instant / delayed withdrawals" not "sync / async", "KYC" not "whitelist" in user copy.
- Explainer sections (How it works, Why CapitalRail, Business model, FAQ) stay at the bottom; header nav is "How it works", "Business" and "FAQ" plus the wallet menu.
- **Agent panel**: fixed height (desktop / tablet card, mobile bottom sheet), only messages scroll. Without a check it answers general questions and offers to run one.

## Revenue (Business model section, 2026-09-23)

1. Preflight API for agents and wallets: free tier, then pay-per-check ("Copy as API call" under each verdict).
2. White-label "Can I enter?" widget + blocked-demand dashboard for RWA issuers such as IXS.
3. Capacity alerts for allocators on WAIT.
4. Referral on validated deposits, subject to an agreement with IXS.

- Real counter "Failed deposits avoided on this instance" (WAIT + NO-GO served since server start). **No fake APY**, no invented numbers; honest "Coming soon" roadmap rails stay.

## Out of scope

- No non-IXS vaults (decision: stays within the RWA Vaults / IXS track).
- No custody, no automatic signing.
