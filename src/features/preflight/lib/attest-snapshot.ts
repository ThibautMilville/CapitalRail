import { createHash } from "node:crypto";
import type { RailSnapshot } from "@/shared/ixs/types";
import type { MandatePreferences } from "./types";

export type SnapshotAttestation = {
  snapshotHash: `0x${string}`;
  attestedAt: string;
};

export function computeSnapshotAttestation(input: {
  rails: RailSnapshot[];
  walletAddress: string;
  amount: string;
  preferences: MandatePreferences;
}): SnapshotAttestation {
  const attestedAt = new Date().toISOString();
  const canonical = JSON.stringify({
    rails: input.rails,
    mandate: {
      walletAddress: input.walletAddress.toLowerCase(),
      amount: input.amount,
      preferences: {
        allowKyc: input.preferences.allowKyc,
        requireSyncSettlement: input.preferences.requireSyncSettlement,
        preferredChainId: input.preferences.preferredChainId ?? null,
      },
    },
  });

  const digest = createHash("sha256").update(canonical).digest("hex");
  return {
    snapshotHash: `0x${digest}`,
    attestedAt,
  };
}
