export type SettlementKind = "sync" | "async-erc7540" | string;

export type UnderlyingAsset = {
  symbol: string;
  decimals: number;
  address: `0x${string}`;
};

export type IxsVaultTransparency = {
  description?: string | null;
  faq?: { question: string; answer: string }[] | null;
  riskBullets?: string[] | null;
};

export type IxsVaultListItem = {
  id: string;
  routeId: string;
  name: string;
  symbol: string;
  chainId: number;
  network: string;
  chainName: string;
  contractAddress: `0x${string}`;
  explorerUrl?: string;
  /** Goldsky (or other) subgraph HTTP endpoint; may omit trailing `/gn`. */
  subgraphUrl?: string | null;
  rpcUrl?: string;
  logoUrl?: string | null;
  underlyingAsset: UnderlyingAsset;
  productId?: string;
  requiresWhitelist: boolean;
  status: string;
  /** IXS-reported time to maturity - not APY. */
  ttm?: number | null;
  metrics?: unknown;
  transparency?: IxsVaultTransparency | null;
  actions?: string[];
};

export type IxsVaultsResponse = {
  items: IxsVaultListItem[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export type VaultPricing = {
  totalAssets?: string;
  totalSupply?: string;
  pricePerShare?: string;
};

export type VaultGetResult = {
  ok: boolean;
  settlement: SettlementKind;
  vault: IxsVaultListItem;
  pricing?: VaultPricing;
};

export type WhitelistCheckResult = {
  ok?: boolean;
  whitelisted?: boolean;
  isWhitelisted?: boolean;
  allowed?: boolean;
  raw?: string;
  [key: string]: unknown;
};

export type TxStep = {
  type: string;
  description?: string;
  tx: {
    to: `0x${string}`;
    data: `0x${string}`;
    value?: string;
  };
};

export type DepositBuildResult = {
  ok: boolean;
  settlement: SettlementKind;
  chainId: number;
  network: string;
  vault: { id: string; address: `0x${string}` };
  ownerAddress: `0x${string}`;
  asset: UnderlyingAsset;
  amount: { baseUnits: string; decimals: number };
  steps: TxStep[];
};

export type RedeemBuildResult = {
  ok: boolean;
  settlement: SettlementKind;
  chainId: number;
  network: string;
  vault: { id: string; address: `0x${string}` };
  ownerAddress: `0x${string}`;
  shares: { baseUnits: string; decimals: number; symbol?: string };
  steps: TxStep[];
};

export type ClaimBuildResult = {
  ok: boolean;
  settlement: SettlementKind;
  chainId: number;
  network: string;
  vault: { id: string; address: `0x${string}` };
  ownerAddress: `0x${string}`;
  requestId: string;
  steps: TxStep[];
};

export type VaultRequestItem = {
  requestId: string;
  type?: string;
  kind?: string;
  status: string;
  shareAmount?: string;
  assetAmount?: string;
  claimable?: boolean;
  [key: string]: unknown;
};

export type VaultRequestStatusResult = {
  ok?: boolean;
  requests?: VaultRequestItem[];
  items?: VaultRequestItem[];
  [key: string]: unknown;
};

export type PositionResult = {
  position: {
    vaultId: string;
    wallet: string;
    balances: {
      asset: { baseUnits: string; decimals: number; display: string };
      shares: { baseUnits: string; decimals: number; display: string };
      shareValueInAssets: {
        baseUnits: string;
        decimals: number;
        display: string;
      };
    };
    limits: {
      allowanceToVault: {
        baseUnits: string;
        decimals: number;
        display: string;
      };
      maxWithdraw: { baseUnits: string; decimals: number; display: string };
      maxRedeem: { baseUnits: string; decimals: number; display: string };
    };
  };
};

export type RailStatus = "open" | "blocked" | "gated";

export type RailSnapshot = {
  vaultId: string;
  name: string;
  symbol: string;
  chainId: number;
  chainName: string;
  network: string;
  contractAddress: `0x${string}`;
  requiresWhitelist: boolean;
  whitelistOk: boolean | null;
  settlement: SettlementKind;
  status: RailStatus;
  pricePerShare: string | null;
  totalAssets: string | null;
  ttm: number | null;
  assetSymbol: string;
  assetDecimals: number;
  assetAddress: `0x${string}`;
  walletAssetBalance: string | null;
  walletShareBalance: string | null;
  depositBuildOk: boolean;
  depositBuildError: string | null;
  reasonCodes: string[];
};
