# X thread - SERV Hackathon Edition 01

Prepared: 2026-09-24 (updated with screenshot map).

Language: English (international jury / builders). Public links only. Do not claim OpenJEV live (`openjev.configured=false` on prod health as of prep date).

French one-liner for the poster:

> Thread pret pour le concours SERV - CapitalRail, preflight IXS avant tout depot RWA. Copie-colle les tweets ci-dessous. Images dans docs/screenshots/.

---

## Screenshot → tweet map

Attach from `docs/screenshots/` (also usable as media for X):

| Tweet | Image file | What it shows |
| --- | --- | --- |
| 1/7 | `landing-hero.png` | Hero / start of preflight flow |
| 2/7 | `progress-analyzing.png` | Progress during analysis (not frozen) |
| 3/7 | `wait-avalanche.png` | Avalanche limit 0 → WAIT, refuses unsafe entry |
| 4/7 | `go-result.png` + optional `nogo-veto.png` | GO with jury SERV summary; or NO-GO / veto consistency |
| 5/7 | `vaults-loaded.png` | Live IXS vault catalogue (not stuck on Loading) |
| 6/7 | (link card or `go-result.png`) | Live URL + GitHub |
| 7/7 | none required | CTA for judges |

Filenames use ASCII hyphens only.

---

## Thread (copy-paste)

1/7
RWA vaults look "open" until your deposit reverts. CapitalRail is the IXS entry preflight for SERV Hackathon Edition 01: scan live rails, then GO / WAIT / NO-GO - before capital moves.
[attach: landing-hero.png]

2/7
An agent sees an open vault and tries to deposit. CapitalRail checks actual capacity, access, and settlement. Progress is visible while it runs (scan → rules → SERV risk → ranking → verification → decision).
[attach: progress-analyzing.png]

3/7
Concrete case: Avalanche vault listed open, MCP deposit limit 0 (often NAV stale). Naive agents force it and fail. CapitalRail returns WAIT and refuses unsafe entry until a build succeeds.
[attach: wait-avalanche.png]

4/7
Rules = code. Judgment = SERV.
Code owns eligibility and the final safety override. SERV writes risk notes, ranking, memo, and a verifier that can veto a GO - never unlock one. Memo and next steps always match the final decision (no "proceed" on NO-GO).
[attach: go-result.png and/or nogo-veto.png]

5/7
For agents: REST + OpenAPI, plus a thin MCP (`capitalrail_preflight`, `capitalrail_intent`). Live vault catalogue on /vaults. One call before you allocate. Rate-limited. No fake APY.
[attach: vaults-loaded.png]

6/7
Live: https://capitalrail.ozc.fr
GitHub: https://github.com/ThibautMilville/CapitalRail
Track: RWA Vaults | Partner: IXS | SERV Hackathon Edition 01
Demo prompts: docs/demo-scenarios.md

7/7
Judges and builders: run a preflight, open the compact SERV summary + full trace, hit POST /api/preflight. Feedback welcome - CapitalRail, the entry gatekeeper for IXS RWA vaults.
@openservai

---

## Notes

- Prod health at prep (2026-09-24): `ok`, `serv.configured=true`, tiers intent/risk/ranking/verification/agent on mini/gpt-5.4; `openjev.configured=false`.
- Character counts aim under ~260 with `n/7` prefixes so numbering fits.
- ASCII hyphens only.
- Reproduce GO/WAIT/NO-GO: `docs/demo-scenarios.md`.
