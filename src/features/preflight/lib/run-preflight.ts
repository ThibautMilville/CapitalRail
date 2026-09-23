import { z } from "zod";
import { toBaseUnits } from "@/shared/ixs/rest";
import { vaultBuildRequestDeposit } from "@/shared/ixs/mcp";
import type { DepositBuildResult, RailSnapshot } from "@/shared/ixs/types";
import { amountSchema } from "@/shared/validation/amount";
import { isDemoWallet } from "@/shared/wallet/demo-wallet";
import { computeSnapshotAttestation } from "./attest-snapshot";
import { decidePreflight } from "./decide-preflight";
import { scanRails } from "./scan-rails";
import type { PreflightResponse } from "./types";

const SCAN_CACHE_TTL_MS = 5 * 60 * 1000;

type ScanCacheEntry = {
  rails: RailSnapshot[];
  at: number;
};

const scanCache = new Map<string, ScanCacheEntry>();

function scanCacheKey(walletAddress: string, amount: string) {
  return `${walletAddress.toLowerCase()}:${amount}`;
}

/**
 * A permissionless rail failing with an unexplained BUILD_FAILED is usually a
 * transient IXS/MCP error; caching it would pin a wrong WAIT/NO-GO for the TTL.
 */
function isCacheableScan(rails: RailSnapshot[]) {
  return !rails.some(
    (rail) =>
      !rail.requiresWhitelist &&
      (rail.reasonCodes.includes("BUILD_FAILED") ||
        rail.settlement === "unknown"),
  );
}

export const preflightBodySchema = z.object({
  walletAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid wallet address"),
  amount: amountSchema,
  preferences: z.object({
    allowKyc: z.boolean(),
    requireSyncSettlement: z.boolean(),
    preferredChainId: z.union([z.literal(56), z.literal(43114)]).optional(),
  }),
  /** When false (default), reuse recent rail scan for this wallet+amount. */
  forceRescan: z.boolean().optional(),
});

export async function runPreflight(
  body: z.infer<typeof preflightBodySchema>,
): Promise<PreflightResponse> {
  const walletAddress = body.walletAddress as `0x${string}`;
  const key = scanCacheKey(body.walletAddress, body.amount);
  const cached = scanCache.get(key);
  const cacheFresh =
    cached != null && Date.now() - cached.at < SCAN_CACHE_TTL_MS;

  let rails: RailSnapshot[];
  if (!body.forceRescan && cacheFresh && cached) {
    rails = cached.rails;
  } else {
    rails = await scanRails({
      walletAddress,
      amount: body.amount,
    });
    if (isCacheableScan(rails)) {
      scanCache.set(key, { rails, at: Date.now() });
    } else {
      scanCache.delete(key);
    }
  }

  const decision = await decidePreflight({
    walletAddress: body.walletAddress,
    amount: body.amount,
    preferences: body.preferences,
    rails,
  });

  const preview = isDemoWallet(walletAddress);
  let txPack: DepositBuildResult | undefined;
  if (!preview && decision.decision === "GO" && decision.selectedVaultId) {
    const selected = rails.find(
      (rail) => rail.vaultId === decision.selectedVaultId,
    );
    if (selected) {
      txPack = await vaultBuildRequestDeposit({
        vaultId: selected.vaultId,
        ownerAddress: body.walletAddress,
        assetAmount: toBaseUnits(body.amount, selected.assetDecimals),
      });
    }
  }

  const attestation = computeSnapshotAttestation({
    rails,
    walletAddress: body.walletAddress,
    amount: body.amount,
    preferences: body.preferences,
  });

  return {
    rails,
    decision: decision.decision,
    selectedVaultId: decision.selectedVaultId,
    rejected: decision.rejected,
    memoMarkdown: decision.memoMarkdown,
    userNextSteps: decision.userNextSteps,
    reasoning: decision.reasoning,
    rationale: decision.rationale,
    verification: decision.verification,
    riskNotes: decision.riskNotes,
    intentReading: decision.intentReading,
    disagreements: decision.disagreements,
    trace: decision.trace,
    txPack,
    preview,
    walletAddress,
    scannedAt: attestation.attestedAt,
    snapshotHash: attestation.snapshotHash,
    attestedAt: attestation.attestedAt,
  };
}
