import {
  vaultBuildClaimRedeem,
  vaultBuildRequestRedeem,
} from "@/shared/ixs/mcp";
import { toBaseUnits } from "@/shared/ixs/rest";
import type { ExitBuildResponse, ExitTxPack } from "./types";

function needsClaimStep(settlement: string, steps: { type: string; description?: string }[]) {
  if (settlement.startsWith("async")) return true;
  const mentionsClaim = steps.some(
    (step) =>
      /claim/i.test(step.type) ||
      /claim/i.test(step.description ?? "") ||
      /vault_request_status/i.test(step.description ?? ""),
  );
  const saysNoClaim = steps.some((step) =>
    /no separate claim/i.test(step.description ?? ""),
  );
  return mentionsClaim && !saysNoClaim;
}

export async function buildRedeemPack(input: {
  vaultId: string;
  ownerAddress: string;
  /** Human share amount, or base-units integer string when `asBaseUnits`. */
  shareAmount: string;
  shareDecimals: number;
  asBaseUnits?: boolean;
}): Promise<ExitBuildResponse> {
  const baseUnits = input.asBaseUnits
    ? input.shareAmount.replace(/^0+(?=\d)/, "") || "0"
    : toBaseUnits(input.shareAmount, input.shareDecimals);

  if (!/^\d+$/.test(baseUnits) || BigInt(baseUnits) <= BigInt(0)) {
    throw new Error("Share amount must be a positive integer in base units");
  }

  const built = await vaultBuildRequestRedeem({
    vaultId: input.vaultId,
    ownerAddress: input.ownerAddress,
    shareAmount: baseUnits,
  });

  const pack: ExitTxPack = {
    kind: "redeem",
    settlement: built.settlement,
    chainId: built.chainId,
    network: built.network,
    vault: {
      id: input.vaultId,
      address: built.vault.address,
    },
    ownerAddress: built.ownerAddress,
    shares: built.shares,
    steps: built.steps,
    needsClaim: needsClaimStep(built.settlement, built.steps),
  };

  return { pack };
}

export async function buildClaimPack(input: {
  vaultId: string;
  ownerAddress: string;
  requestId: string;
}): Promise<ExitBuildResponse> {
  const built = await vaultBuildClaimRedeem(input);
  const pack: ExitTxPack = {
    kind: "claim",
    settlement: built.settlement,
    chainId: built.chainId,
    network: built.network,
    vault: {
      id: input.vaultId,
      address: built.vault.address,
    },
    ownerAddress: built.ownerAddress,
    requestId: built.requestId ?? input.requestId,
    steps: built.steps,
    needsClaim: false,
  };
  return { pack };
}
