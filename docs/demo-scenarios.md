# Demo scenarios (jury)

Public live: https://capitalrail.ozc.fr  
Repo: https://github.com/ThibautMilville/CapitalRail

Use the home guided flow (free text → editable rules → Check my entry) or `POST /api/preflight` with the demo wallet `0x0000000000000000000000000000000000000001` (preview: public rails only, never a tx pack).

Product overview and architecture: [README](../README.md).

## GO (public preview - disconnect wallet)

**Goal:** decision `GO`, memo may invite deposit review; unsigned txs only with a real funded wallet (preview wallet = GO without tx pack).

**Critical:** disconnect any connected wallet first. A connected wallet with less USDC than the amount is honest **NO-GO** (`INSUFFICIENT_BALANCE`), even when the BSC open rail builds. The earlier "3/3 GO" checks used the preview address `0x…0001`, not an empty connected wallet.

| Field | Value |
| --- | --- |
| Free text | `100 USDC on BSC, no KYC, delayed withdrawals ok` |
| Amount | `100` (prefer over `500`: larger tickets often trip soft SERV notes) |
| Chain | BSC (`56`) |
| KYC | **off** |
| Instant withdrawals | **off** (delayed ok) |
| Wallet | disconnected → demo preview `0x…0001` |

**Toggles:** leave "Allow KYC vaults" off; leave chain on BSC. Do **not** need "Allow any chain".

**API:**

```bash
curl -s -X POST https://capitalrail.ozc.fr/api/preflight \
  -H 'content-type: application/json' \
  -d '{
    "walletAddress":"0x0000000000000000000000000000000000000001",
    "amount":"100",
    "preferences":{
      "allowKyc":false,
      "requireSyncSettlement":false,
      "preferredChainId":56
    }
  }' | jq '{decision,selectedVaultId,txPack:(.txPack!=null),memo:(.memoMarkdown|.[0:120]),next:(.userNextSteps)}'
```

**Expect:** `decision=GO` when the open BSC rail still builds (vault `6a26624ca7d16b245d665475` as of 2026-09-24). Memo may recommend the BSC rail. `txPack` is absent in preview. Soft SERV verifier complaints become **warnings** (they no longer veto a code-valid GO). Hard veto only if code confirms the selected rail is invalid.

### Live IXS rails (2026-09-24 probe)

| Vault | Chain | Access | Settlement | Typical status |
| --- | --- | --- | --- | --- |
| `6a26624c…5475` ixv1 | BSC 56 | permissionless | sync | **open**, `depositBuildOk` |
| `6a8ecb61…e88f` ix7540v1 | BSC 56 | KYC / whitelist | async-erc7540 | gated unless wallet cleared |
| `6a952729…e89d` IXHYB | Avalanche 43114 | permissionless | async-erc7540 | often limit 0 → WAIT |
| `6a9a59c6…e7e3` IXHYB | Avalanche 43114 | KYC / whitelist | async-erc7540 | gated |

**Allow KYC vaults:** does **not** unlock GO by itself. Whitelist still required → still **NO-GO** (not WAIT) until IXS clears the wallet. Preview of a gated vault stays gated (`depositBuildOk` false).

## WAIT (Avalanche limit 0)

**Goal:** clear `WAIT`, no unsigned txs, memo says WAIT / do not force deposit.

| Field | Value |
| --- | --- |
| Free text | `100 USDC on Avalanche, no KYC, delayed ok` |
| Amount | `100` (Avalanche HYB min is 100 USDC per IXS ops) |
| Chain | Avalanche (`43114`) |
| KYC | off |
| Instant withdrawals | off |
| Wallet | preview or connected (limit 0 dominates) |

**API:** same as above with `"preferredChainId":43114` and `"amount":"100"`.

**Expect:** `decision=WAIT` while MCP reports deposit limit 0 on the open Avalanche rail (NAV staleness/drift - not permanently closed). Memo contains `Final decision: WAIT`. Next steps say re-check later / try another chain - never approve+deposit.

## NO-GO

### A) Hard mandate block (reproducible without SERV veto)

| Field | Value |
| --- | --- |
| Free text | `100 USDC on Avalanche, no KYC, I need instant withdrawals` |
| Amount | `100` |
| Chain | Avalanche (`43114`) |
| KYC | off |
| Instant withdrawals | **on** (`requireSyncSettlement: true`) |

**Expect:** `NO-GO` (async settlement violates mandate; limit 0 does not become WAIT). Memo: `Final decision: NO-GO`. No tx pack.

### B) Connected wallet underfunded (common jury trap)

| Field | Value |
| --- | --- |
| Free text | `100 USDC on BSC, no KYC, delayed withdrawals ok` |
| Wallet | connected with 0 or &lt;100 USDC on BSC |
| Toggles shown | Allow any chain, Allow KYC vaults, Re-check now |

**Expect:** `NO-GO`, headline **Not enough USDC**, reasons include open-rail balance shortfall and (if KYC off) the gated BSC KYC rail. Jury: 0 eligible. Toggling Allow KYC does not help without whitelist. Fix: disconnect for preview GO, or fund / lower amount.

### C) Verifier hard veto (rare after 2026-09-24 harden)

Only when code also confirms the selected rail is invalid (safety / rules). Soft SERV `fact_mismatch` no longer flips a valid GO to NO-GO.

## Consistency rules (must hold)

| Decision | Memo | Next steps | Unsigned txs | Sign UI |
| --- | --- | --- | --- | --- |
| GO | May recommend deposit | May say review approve then deposit | Only non-preview + GO | Shown |
| WAIT | Final decision WAIT | Re-check / other chain | Absent | Hidden |
| NO-GO | Final decision NO-GO | Loosen rules / do not sign | Absent | Hidden |

Screenshots: `docs/screenshots/` (embedded in README).
