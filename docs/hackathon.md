# Hackathon brief

## Contest

- **Event**: SERV Hackathon Edition 01.
- **Track**: RWA Vaults.
- **Partner**: IXS (tokenized real-world asset vaults, BSC and Avalanche).
- **Deadline**: 2026-09-28 00:00 UTC.
- **Judging criteria**: creativity, user-readiness, revenue potential.

## Constraints

- SERV Reasoning must be used meaningfully (not just OpenAI with a different base URL).
- A starter API credit is provided for SERV Reasoning.
- The `$SERV` token is separate from the API: using the API does not require holding the token.

## SERV vs OpenAI (user explanation)

- **SERV Reasoning** is the OpenServ inference API. It splits a task into bounded, structured steps, enforces output schemas, validates results and keeps traces.
- It exposes an **OpenAI-compatible SDK** (the `openai` package with a different base URL and key).
- **Model routing**: simple steps can be routed to smaller models to reduce cost.
- **SERV does not hold funds**. It only reasons.
- **IXS** provides the products (vaults) and the tools that build unsigned transactions.
- **The app keeps control** of execution: nothing is signed or sent without the user.

One-line thesis:

> "IXS provides the products and onchain tools; SERV helps the agent decide what to propose and why; the app keeps control of what is actually executed."

## Submission checklist

- [ ] Public repository
- [ ] Demo video (~2 min)
- [ ] Live URL
- [ ] Project description (problem, how SERV is used, how IXS is used, revenue model)
