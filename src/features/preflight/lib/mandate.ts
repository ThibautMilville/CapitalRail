import { DEMO_WALLET_ADDRESS } from "@/shared/wallet/demo-wallet";

/** The user's rules, as edited in the UI ("" chain means any chain). */
export type MandateValues = {
  walletAddress: string;
  amount: string;
  allowKyc: boolean;
  requireSyncSettlement: boolean;
  preferredChainId: "" | "56" | "43114";
};

export const INITIAL_MANDATE: MandateValues = {
  walletAddress: DEMO_WALLET_ADDRESS,
  amount: "100",
  allowKyc: false,
  requireSyncSettlement: true,
  preferredChainId: "",
};

export function mandateKey(m: MandateValues) {
  return JSON.stringify({
    walletAddress: m.walletAddress.toLowerCase(),
    amount: m.amount,
    allowKyc: m.allowKyc,
    requireSyncSettlement: m.requireSyncSettlement,
    preferredChainId: m.preferredChainId,
  });
}

export function chainChoiceLabel(chain: MandateValues["preferredChainId"]) {
  if (chain === "56") return "BSC";
  if (chain === "43114") return "Avalanche";
  return "Any chain";
}

/** One-line plain-English summary of the rules. */
export function describeRules(m: MandateValues): string[] {
  return [
    `${m.amount} USDC`,
    chainChoiceLabel(m.preferredChainId),
    m.requireSyncSettlement ? "Instant withdrawals only" : "Delayed withdrawals ok",
    m.allowKyc ? "KYC vaults ok" : "No KYC",
  ];
}
