# X thread - SERV Hackathon Edition 01

Prepared: 2026-09-24.

Language: English (international jury / builders). Public links only. Do not claim OpenJEV live (`openjev.configured=false` on prod health as of prep date).

French one-liner for the poster:

> Thread pret pour le concours SERV - CapitalRail, preflight IXS avant tout depot RWA. Copie-colle les tweets ci-dessous.

---

## Thread (copy-paste)

1/7
RWA vaults look "open" until your deposit reverts. CapitalRail is the IXS entry preflight for SERV Hackathon Edition 01: scan live rails, then GO / WAIT / NO-GO - before capital moves.

2/7
It checks capacity, KYC/whitelist, withdrawal mode, and balance across IXS HYB vaults (BSC + Avalanche). SERV decides GO / WAIT / NO-GO. Unsigned approve + deposit txs only when capacity is real - and only for your wallet.

3/7
Concrete case: Avalanche vault listed open, MCP deposit limit 0 (often NAV stale). Naive agents force it and fail. CapitalRail returns WAIT until a build succeeds. Preflight before deposit.

4/7
Rules = code. Judgment = SERV.
Code owns eligibility and the final safety override. SERV writes risk notes, ranking, memo, and a verifier that can veto a GO - never unlock one.

5/7
For agents: REST + OpenAPI, plus a thin MCP (`capitalrail_preflight`, `capitalrail_intent`). One call before you allocate. Rate-limited. No fake APY.

6/7
Live: https://capitalrail.ozc.fr
GitHub: https://github.com/ThibautMilville/CapitalRail
Track: RWA Vaults | Partner: IXS | SERV Hackathon Edition 01

7/7
Judges and builders: run a preflight, open the SERV trace, hit POST /api/preflight. Feedback welcome - CapitalRail, the entry gatekeeper for IXS RWA vaults.

---

## Notes

- Prod health at prep (2026-09-24): `ok`, `serv.configured=true`, tiers intent/risk/ranking/verification/agent on mini/gpt-5.4; `openjev.configured=false`.
- Character counts aim under ~260 with `n/7` prefixes so numbering fits.
- ASCII hyphens only.
