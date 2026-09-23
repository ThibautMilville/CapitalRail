import type { SettlementKind, TxStep } from "@/shared/ixs/types";

export type ExitPosition = {
  vaultId: string;
  name: string;
  symbol: string;
  chainId: number;
  chainName: string;
  network: string;
  requiresWhitelist: boolean;
  settlement: SettlementKind;
  contractAddress: `0x${string}`;
  shares: { baseUnits: string; decimals: number; display: string };
  shareValueInAssets: { baseUnits: string; decimals: number; display: string };
  maxRedeem: { baseUnits: string; decimals: number; display: string };
};

export type ExitPositionsResponse = {
  wallet: string;
  positions: ExitPosition[];
};

export type ExitTxPack = {
  kind: "redeem" | "claim";
  settlement: SettlementKind;
  chainId: number;
  network: string;
  vault: { id: string; address: `0x${string}` };
  ownerAddress: `0x${string}`;
  shares?: { baseUnits: string; decimals: number };
  requestId?: string;
  steps: TxStep[];
  /** True when IXS says a later claim step is required (ERC-7540). */
  needsClaim: boolean;
};

export type ExitBuildResponse = {
  pack: ExitTxPack;
};
