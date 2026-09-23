import type { SettlementKind } from "@/shared/ixs/types";

export type VaultCatalogItem = {
  vaultId: string;
  name: string;
  symbol: string;
  chainId: number;
  chainName: string;
  network: string;
  contractAddress: `0x${string}`;
  requiresWhitelist: boolean;
  status: string;
  settlement: SettlementKind;
  /** Human USDC total assets from MCP vault_get pricing, or null. */
  totalAssets: string | null;
  totalSupply: string | null;
  pricePerShare: string | null;
  /** IXS time to maturity - never treat as APY. */
  ttm: number | null;
  assetSymbol: string;
  assetDecimals: number;
  explorerUrl: string | null;
  subgraphUrl: string | null;
  riskBullets: string[];
  transparencyDescription: string | null;
  mcpOk: boolean;
};

export type VaultActivityKind = "deposit" | "redeem" | "other";

export type VaultActivityItem = {
  id: string;
  vaultId: string;
  chainId: number;
  kind: VaultActivityKind;
  label: string;
  status: string | null;
  /** Human-readable amount when known (e.g. "103 USDC"), else null. */
  amountDisplay: string | null;
  actor: string | null;
  timestampSec: number | null;
  txHash: string | null;
  explorerTxUrl: string | null;
};

export type VaultsCatalogResponse = {
  vaults: VaultCatalogItem[];
  activity: VaultActivityItem[];
  activitySource: "subgraph" | "unavailable";
  activityNote: string | null;
  fetchedAt: string;
};
