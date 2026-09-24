# Demo scenarios (jury)

Public live: https://capitalrail.ozc.fr  
Repo: https://github.com/ThibautMilville/CapitalRail

Use the home guided flow (free text → editable rules → Check my entry) or `POST /api/preflight` with the demo wallet `0x0000000000000000000000000000000000000001` (preview: public rails only, never a tx pack).

Product overview and architecture: [README](../README.md).

## GO

**Goal:** decision `GO`, memo invites review of deposit only when GO; unsigned txs only with a real wallet (preview wallet = GO without tx pack).

| Field | Value |
| --- | --- |
| Free text | `500 USDC on BSC, no KYC, delayed withdrawals ok` |
| Amount | `500` (or `1` for a small demo) |
| Chain | BSC (`56`) |
| KYC | off |
| Instant withdrawals | off (delayed ok) |

**API:**

```bash
curl -s -X POST https://capitalrail.ozc.fr/api/preflight \
  -H 'content-type: application/json' \
  -d '{
    "walletAddress":"0x0000000000000000000000000000000000000001",
    "amount":"500",
    "preferences":{
      "allowKyc":false,
      "requireSyncSettlement":false,
      "preferredChainId":56
    }
  }' | jq '{decision,selectedVaultId,txPack:(.txPack!=null),memo:(.memoMarkdown|.[0:120]),next:(.userNextSteps)}'
```

**Expect:** `decision=GO` when the open BSC rail still builds. Memo may recommend the BSC rail. `txPack` is absent in preview. If the verifier hard-fails, decision becomes **NO-GO** and memo/steps are rewritten (no "proceed" / no sign CTA).

## WAIT (Avalanche limit 0)

**Goal:** clear `WAIT`, no unsigned txs, memo says WAIT / do not force deposit.

| Field | Value |
| --- | --- |
| Free text | `100 USDC on Avalanche, no KYC, delayed ok` |
| Amount | `100` (Avalanche HYB min is 100 USDC per IXS ops) |
| Chain | Avalanche (`43114`) |
| KYC | off |
| Instant withdrawals | off |

**API:** same as above with `"preferredChainId":43114` and `"amount":"100"`.

**Expect:** `decision=WAIT` while MCP reports deposit limit 0 on the open Avalanche rail (NAV staleness/drift - not permanently closed). Memo contains `Final decision: WAIT`. Next steps say re-check later / try another chain - never approve+deposit.

## NO-GO

Two honest paths:

### A) Hard mandate block (reproducible without SERV veto)

| Field | Value |
| --- | --- |
| Free text | `100 USDC on Avalanche, no KYC, I need instant withdrawals` |
| Amount | `100` |
| Chain | Avalanche (`43114`) |
| KYC | off |
| Instant withdrawals | **on** (`requireSyncSettlement: true`) |

**Expect:** `NO-GO` (async settlement violates mandate; limit 0 does not become WAIT). Memo: `Final decision: NO-GO`. No tx pack.

### B) Verifier veto (when SERV live)

Run the **GO** prompt. If the independent verifier returns a hard `fail`, CapitalRail sets `NO-GO`, replaces the ranking memo, and strips deposit invitations. Check Details → Memo & proof and the compact jury summary ("Verifier blocked").

## Consistency rules (must hold)

| Decision | Memo | Next steps | Unsigned txs | Sign UI |
| --- | --- | --- | --- | --- |
| GO | May recommend deposit | May say review approve then deposit | Only non-preview + GO | Shown |
| WAIT | Final decision WAIT | Re-check / other chain | Absent | Hidden |
| NO-GO | Final decision NO-GO | Loosen rules / do not sign | Absent | Hidden |

Screenshots: `docs/screenshots/` (embedded in README).
