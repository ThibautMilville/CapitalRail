import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { RailSnapshot } from "@/shared/ixs/types";
import { checkRateLimit } from "@/shared/http/rate-limit";
import {
  applySafetyGuard,
  decidePreflight,
  deriveFacts,
  fallbackRisk,
  normalizeVerification,
  rulesFilter,
  type DecidePreflightInput,
} from "./decide-preflight";

delete process.env.SERV_API_KEY;

function rail(overrides: Partial<RailSnapshot>): RailSnapshot {
  return {
    vaultId: "vault",
    name: "IX High Yield Bond USDC",
    symbol: "ixHYB",
    chainId: 56,
    chainName: "BSC",
    network: "bsc",
    contractAddress: "0x0000000000000000000000000000000000000abc",
    requiresWhitelist: false,
    whitelistOk: true,
    settlement: "async-erc7540",
    status: "open",
    pricePerShare: "1.08 USDC",
    totalAssets: "1000",
    ttm: 3.07,
    assetSymbol: "USDC",
    assetDecimals: 18,
    assetAddress: "0x0000000000000000000000000000000000000def",
    walletAssetBalance: null,
    walletShareBalance: null,
    depositBuildOk: true,
    depositBuildError: null,
    reasonCodes: ["OK"],
    ...overrides,
  };
}

const LIMIT_ZERO = {
  status: "blocked" as const,
  depositBuildOk: false,
  depositBuildError: "Deposit amount exceeds the current vault limit of 0 USDC.",
  reasonCodes: ["DEPOSIT_LIMIT_ZERO"],
};

/** Mirrors the live IXS set: BSC open (GO path), BSC KYC, Avalanche open (limit 0), Avalanche KYC. */
const LIVE_LIKE: RailSnapshot[] = [
  rail({ vaultId: "bsc-open" }),
  rail({
    vaultId: "bsc-kyc",
    requiresWhitelist: true,
    whitelistOk: false,
    status: "gated",
    depositBuildOk: false,
    reasonCodes: ["WHITELIST_REQUIRED", "DEPOSIT_LIMIT_ZERO"],
  }),
  rail({ vaultId: "avax-open", chainId: 43114, chainName: "Avalanche", ...LIMIT_ZERO }),
  rail({
    vaultId: "avax-kyc",
    chainId: 43114,
    chainName: "Avalanche",
    requiresWhitelist: true,
    whitelistOk: false,
    status: "gated",
    depositBuildOk: false,
    reasonCodes: ["WHITELIST_REQUIRED", "DEPOSIT_LIMIT_ZERO"],
  }),
];

function input(
  preferences: Partial<DecidePreflightInput["preferences"]>,
  rails: RailSnapshot[] = LIVE_LIKE,
  amount = "1",
): DecidePreflightInput {
  return {
    walletAddress: "0x0000000000000000000000000000000000000001",
    amount,
    preferences: {
      allowKyc: false,
      requireSyncSettlement: false,
      ...preferences,
    },
    rails,
  };
}

describe("decidePreflight (fallback, no SERV key)", () => {
  it("returns GO on the open BSC rail with the rules / risk / ranking / verification trace", async () => {
    const result = await decidePreflight(input({ preferredChainId: 56 }));
    assert.equal(result.decision, "GO");
    assert.equal(result.selectedVaultId, "bsc-open");
    assert.deepEqual(
      result.trace.steps.map((step) => step.id),
      ["rules", "risk", "ranking", "verification"],
    );
    assert.equal(result.trace.steps[0]?.source, "code");
    assert.ok(result.trace.steps.slice(1).every((step) => step.source === "fallback"));
    assert.equal(result.trace.totals.servLive, false);
    assert.deepEqual(result.disagreements, []);
    assert.ok(
      result.riskNotes.some(
        (note) => note.vaultId === "bsc-open" && note.category === "exit_delay",
      ),
    );
  });

  it("says WAIT when a rail fitting every rule is only blocked by deposit limit 0", async () => {
    const result = await decidePreflight(input({ preferredChainId: 43114 }));
    assert.equal(result.decision, "WAIT");
    assert.equal(result.selectedVaultId, null);
  });

  it("says NO-GO (not WAIT) when the limit-0 rail also breaks a mandate rule", async () => {
    const result = await decidePreflight(
      input({ preferredChainId: 43114, requireSyncSettlement: true }),
    );
    assert.equal(result.decision, "NO-GO");
  });

  it("says NO-GO (not WAIT) when KYC is allowed but the wallet is not whitelisted", async () => {
    const rails = LIVE_LIKE.filter((item) => item.vaultId === "avax-kyc");
    const result = await decidePreflight(
      input({ preferredChainId: 43114, allowKyc: true }, rails),
    );
    assert.equal(result.decision, "NO-GO");
  });

  it("says NO-GO when the only fitting rail is blocked by the wallet balance", async () => {
    const rails = [
      rail({
        vaultId: "bsc-open",
        walletAssetBalance: "0.5 USDC",
        reasonCodes: ["INSUFFICIENT_BALANCE"],
      }),
    ];
    const result = await decidePreflight(input({}, rails, "10"));
    assert.equal(result.decision, "NO-GO");
    assert.equal(result.rejected[0]?.reasonCode, "INSUFFICIENT_BALANCE");
  });
});

describe("rulesFilter cause ordering", () => {
  it("reports WHITELIST_REQUIRED before DEPOSIT_LIMIT_ZERO when KYC is not allowed", () => {
    const rules = rulesFilter(input({}));
    const kyc = rules.find((entry) => entry.vaultId === "bsc-kyc");
    assert.equal(kyc?.eligible, false);
    assert.equal(kyc?.reasonCode, "WHITELIST_REQUIRED");
  });

  it("reports the chain before anything else", () => {
    const rules = rulesFilter(input({ preferredChainId: 56 }));
    assert.equal(
      rules.find((entry) => entry.vaultId === "avax-open")?.reasonCode,
      "CHAIN_MISMATCH",
    );
  });

  it("reports a settlement violation before a capacity block", () => {
    const rules = rulesFilter(input({ requireSyncSettlement: true }));
    assert.equal(
      rules.find((entry) => entry.vaultId === "avax-open")?.reasonCode,
      "SETTLEMENT_ASYNC_UNSUPPORTED_BY_MANDATE",
    );
  });
});

describe("safety override and verifier", () => {
  it("forces NO-GO when a GO selects a rail with deposit limit 0", () => {
    const { decision, guard } = applySafetyGuard(input({}), {
      decision: "GO",
      selectedVaultId: "avax-open",
      rejected: [],
      memoMarkdown: "memo",
      userNextSteps: [],
    });
    assert.equal(decision.decision, "NO-GO");
    assert.equal(decision.selectedVaultId, null);
    assert.equal(guard.applied, true);
  });

  it("leaves a valid GO untouched", () => {
    const { decision, guard } = applySafetyGuard(input({}), {
      decision: "GO",
      selectedVaultId: "bsc-open",
      rejected: [],
      memoMarkdown: "memo",
      userNextSteps: [],
    });
    assert.equal(decision.decision, "GO");
    assert.equal(guard.applied, false);
  });

  it("downgrades a verifier fail without a hard fact to a warning", () => {
    const soft = normalizeVerification({
      verdict: "fail",
      issues: [{ vaultId: null, kind: "risk_understated", issue: "Exit delay not in memo." }],
    });
    assert.equal(soft.verdict, "warn");
    const hard = normalizeVerification({
      verdict: "fail",
      issues: [{ vaultId: "x", kind: "rule_violation", issue: "Limit is 0." }],
    });
    assert.equal(hard.verdict, "fail");
  });
});

describe("fact-grounded risk notes", () => {
  it("computes the deposit share of the vault from payload facts only", () => {
    assert.deepEqual(deriveFacts(rail({ totalAssets: "1" }), "1"), {
      amountShareOfVaultAssetsPct: 50,
    });
    assert.deepEqual(deriveFacts(rail({ totalAssets: null }), "1"), {
      amountShareOfVaultAssetsPct: null,
    });
  });

  it("flags concentration on a tiny vault and cites the reported numbers", () => {
    const rails = [rail({ vaultId: "tiny", totalAssets: "1.088596" })];
    const risk = fallbackRisk(input({}, rails, "100"), rulesFilter(input({}, rails, "100")));
    const note = risk.riskNotes.find((item) => item.category === "low_tvl_concentration");
    assert.equal(note?.severity, "high");
    assert.match(note?.note ?? "", /1\.088596/);
  });
});

describe("rate limiter", () => {
  it("blocks after the limit within the window and resets after it", () => {
    const rule = { name: "test", limit: 2, windowMs: 1000 };
    const now = 1_000_000;
    assert.equal(checkRateLimit(rule, "ip", now).ok, true);
    assert.equal(checkRateLimit(rule, "ip", now).ok, true);
    const blocked = checkRateLimit(rule, "ip", now + 10);
    assert.equal(blocked.ok, false);
    assert.equal(checkRateLimit(rule, "ip", now + 1001).ok, true);
  });
});
