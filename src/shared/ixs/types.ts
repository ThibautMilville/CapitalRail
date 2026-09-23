export type SettlementKind = "sync" | "async-erc7540" | string;

export type UnderlyingAsset = {
  symbol: string;
  decimals: number;
  address: `0x${string}`;
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
  rpcUrl?: string;
  underlyingAsset: UnderlyingAsset;
  productId?: string;
  requiresWhitelist: boolean;
  status: string;
  ttm?: number | null;
  actions?: string[];
};

export type IxsVaultsResponse = {
  items: IxsVaultListItem[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export type VaultGetResult = {
  ok: boolean;
  settlement: SettlementKind;
  vault: IxsVaultListItem;
  pricing?: {
    totalAssets?: string;
    totalSupply?: string;
    pricePerShare?: string;
  };
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
