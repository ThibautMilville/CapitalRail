# CapitalRail docs

Living documentation for the CapitalRail hackathon entry (SERV Hackathon Edition 01, RWA Vaults track, partner IXS). The user and future agents update it progressively.

## Index

| File | Content |
|---|---|
| [hackathon.md](./hackathon.md) | Contest brief, constraints, SERV vs OpenAI, submission checklist |
| [product.md](./product.md) | Vision, product thesis, target users, UX, revenue, out of scope |
| [architecture.md](./architecture.md) | Stack, folder layout, data flow, IXS vaults, env vars, local run |
| [brainstorm.md](./brainstorm.md) | Ideas log with status |
| [decisions.md](./decisions.md) | Dated decision journal and user feedback |
| [expectations.md](./expectations.md) | Quality bar checklist and open questions |

## How to maintain

- Read these files before any significant work.
- Journal style, append-only for `decisions.md` and `brainstorm.md`: add new entries, do not rewrite history. If a decision is reversed, add a new entry that references the old one.
- Date every entry as `YYYY-MM-DD`.
- Keep files short and factual. Link to code paths instead of copying code.
- Mark unconfirmed work as "in progress" and update it once confirmed.
- Everything is written in English. Only ASCII hyphens `-` (never U+2014 or U+2013).
- Check before finishing: `rg "[\x{2013}\x{2014}]" docs/` must return nothing.
