import type { MandatePatch } from "@/features/agent/lib/agent-schema";
import type { RailSnapshot } from "@/shared/ixs/types";
import { chainLabel } from "@/shared/wallet/chains";
import type { MandateValues } from "./mandate";
import type { PreflightResponse } from "./types";

export type VerdictAction =
  | { kind: "patch"; id: string; label: string; patch: MandatePatch; primary?: boolean }
  | { kind: "recheck"; id: string; label: string; primary?: boolean }
  | { kind: "notify"; id: string; label: string };

export type VerdictView = {
  tone: "go" | "wait" | "nogo";
  headline: string;
  summary: string;
  reasons: string[];
  actions: VerdictAction[];
};

export function formatUsdc(display: string | null): string | null {
  const value = Number.parseFloat(display ?? "");
  if (!Number.isFinite(value)) return null;
  return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export function withdrawalLabel(settlement: string): string {
  if (settlement === "sync") return "instant withdrawals";
  if (settlement.startsWith("async")) return "delayed withdrawals";
  return "unknown withdrawals";
}

export function railTitle(rail: RailSnapshot): string {
  return `${chainLabel(rail.chainId)} ${rail.requiresWhitelist ? "KYC" : "open"} vault`;
}

export function humanReason(
  rail: RailSnapshot,
  code: string,
  amount: string,
): string {
  const chain = chainLabel(rail.chainId);
  switch (code) {
    case "DEPOSIT_LIMIT_ZERO":
      return `The ${railTitle(rail)} reports MCP deposit limit 0 (often NAV stale/drift - not permanently closed). CapitalRail will not force a deposit.`;
    case "WHITELIST_REQUIRED":
      return `The ${railTitle(rail)} needs KYC / whitelist approval for this wallet.`;
    case "SETTLEMENT_ASYNC_UNSUPPORTED_BY_MANDATE":
      return `The ${railTitle(rail)} only offers delayed withdrawals (processed against the next daily cutoff).`;
    case "CHAIN_MISMATCH":
      return `${chain} is outside your chosen chain.`;
    case "INSUFFICIENT_BALANCE":
      return `You hold ${formatUsdc(rail.walletAssetBalance) ?? "less"} ${rail.assetSymbol} on ${chain}, less than ${amount}.`;
    case "BUILD_FAILED":
      return `The ${railTitle(rail)} could not prepare a deposit right now.`;
    default:
      return `The ${railTitle(rail)} is not available (${code.toLowerCase().replace(/_/g, " ")}).`;
  }
}

function floorAmount(display: string | null): string | null {
  const value = Number.parseFloat(display ?? "");
  if (!Number.isFinite(value) || value <= 0) return null;
  const floored = Math.floor(value * 100) / 100;
  return floored > 0 ? String(floored) : null;
}

function isOpen(rail: RailSnapshot) {
  return rail.status === "open" && rail.depositBuildOk;
}

export function buildVerdict(
  result: PreflightResponse,
  mandate: MandateValues,
): VerdictView {
  const railById = new Map(result.rails.map((rail) => [rail.vaultId, rail]));
  const amount = mandate.amount;

  if (result.decision === "GO") {
    const rail = result.selectedVaultId
      ? railById.get(result.selectedVaultId)
      : undefined;
    const chain = rail ? chainLabel(rail.chainId) : "the selected";
    return {
      tone: "go",
      headline: "You can enter.",
      summary: result.preview
        ? `The ${chain} vault has room for ${amount} USDC right now (public-data preview).`
        : `The ${chain} vault has room for ${amount} USDC right now.`,
      reasons: rail
        ? [
            result.preview
              ? `Open to deposits: IXS can prepare a ${amount} USDC deposit on ${chain} once your wallet is connected.`
              : `Open to deposits: IXS prepared a ${amount} USDC deposit on ${chain}.`,
            `Offers ${withdrawalLabel(rail.settlement)}.`,
            rail.requiresWhitelist
              ? "Your wallet is on the vault whitelist."
              : "No KYC needed (permissionless access).",
          ]
        : [],
      actions: [],
    };
  }

  const seen = new Set<string>();
  const reasons: string[] = [];
  let chainFiltered = false;
  for (const entry of result.rejected) {
    const rail = railById.get(entry.vaultId);
    if (!rail) continue;
    if (entry.reasonCode === "CHAIN_MISMATCH") {
      chainFiltered = true;
      continue;
    }
    const text = humanReason(rail, entry.reasonCode, amount);
    if (!seen.has(text)) {
      seen.add(text);
      reasons.push(text);
    }
  }
  if (chainFiltered && mandate.preferredChainId) {
    reasons.push(
      `Only ${chainLabel(Number(mandate.preferredChainId))} vaults were checked (your rule).`,
    );
  }

  const actions: VerdictAction[] = [];
  const lowBalance = result.rails.find((rail) =>
    rail.reasonCodes.includes("INSUFFICIENT_BALANCE"),
  );
  const balanceShortfall = Boolean(lowBalance);
  const balanceAmount = lowBalance
    ? floorAmount(lowBalance.walletAssetBalance)
    : null;
  if (balanceAmount) {
    actions.push({
      kind: "patch",
      id: "use-balance",
      label: `Use ${balanceAmount} USDC`,
      patch: { amount: balanceAmount },
      primary: true,
    });
  }

  if (mandate.preferredChainId) {
    const chosen = Number(mandate.preferredChainId);
    const other = result.rails.find(
      (rail) => rail.chainId !== chosen && isOpen(rail),
    );
    if (other) {
      actions.push({
        kind: "patch",
        id: "try-other-chain",
        label: `Try ${chainLabel(other.chainId)} instead`,
        patch: { preferredChainId: String(other.chainId) as "56" | "43114" },
        primary: !balanceAmount,
      });
    } else {
      actions.push({
        kind: "patch",
        id: "any-chain",
        label: "Allow any chain",
        patch: { preferredChainId: "" },
      });
    }
  }

  const codes = new Set(result.rejected.map((entry) => entry.reasonCode));
  if (mandate.requireSyncSettlement && codes.has("SETTLEMENT_ASYNC_UNSUPPORTED_BY_MANDATE")) {
    actions.push({
      kind: "patch",
      id: "allow-delayed",
      label: "Allow delayed withdrawals",
      patch: { requireSyncSettlement: false },
    });
  }
  if (!mandate.allowKyc && codes.has("WHITELIST_REQUIRED")) {
    actions.push({
      kind: "patch",
      id: "allow-kyc",
      label: "Allow KYC vaults",
      patch: { allowKyc: true },
    });
  }

  actions.push({
    kind: "recheck",
    id: "recheck",
    label: "Re-check now",
    primary: actions.every((action) => !("primary" in action && action.primary)),
  });

  if (result.decision === "WAIT") {
    actions.push({ kind: "notify", id: "notify", label: "Notify me when it opens" });
    return {
      tone: "wait",
      headline: "Not right now.",
      summary:
        "A vault that fits your rules exists, but MCP reports deposit limit 0 (often NAV staleness/drift - not permanently closed). CapitalRail refuses to force a deposit until the build succeeds.",
      reasons: reasons.slice(0, 3),
      actions,
    };
  }

  const vetoed =
    result.verification?.verdict === "fail" &&
    (result.disagreements ?? []).some(
      (item) => item.step === "verification" && /veto/i.test(item.resolution),
    );

  const openCapacity = result.rails.some((rail) => isOpen(rail));

  return {
    tone: "nogo",
    headline: balanceShortfall
      ? "Not enough USDC."
      : vetoed
        ? "Verifier blocked this entry."
        : "No vault fits your rules.",
    summary: balanceShortfall
      ? balanceAmount
        ? "The vault is open, but your wallet holds less than the amount you asked for. Lower the amount, fund the wallet, or disconnect to run the public preview."
        : "The vault is open, but this wallet holds 0 USDC for the ticket size. Fund it, lower the amount, or disconnect to use the public preview (demo address)."
      : vetoed
        ? "Rules found a candidate, but the independent verifier vetoed GO. Nothing was prepared for signing."
        : openCapacity && codes.has("WHITELIST_REQUIRED")
          ? "Capacity exists, but whitelist / KYC is not cleared for this wallet. Allowing KYC vaults still needs onboarding - it does not unlock GO by itself. Try the permissionless BSC rail, or disconnect for the public preview."
          : "Nothing was prepared. Loosen one rule below and we re-check instantly.",
    reasons: reasons.slice(0, 3),
    actions,
  };
}
