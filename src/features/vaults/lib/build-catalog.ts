import { listVaults } from "@/shared/ixs/rest";
import { vaultGet } from "@/shared/ixs/mcp";
import { fetchVaultActivity, normalizeSubgraphUrl } from "@/features/vaults/lib/fetch-activity";
import type {
  VaultCatalogItem,
  VaultsCatalogResponse,
} from "@/features/vaults/lib/types";

function riskBulletsFrom(
  transparency: { riskBullets?: string[] | null } | null | undefined,
): string[] {
  const bullets = transparency?.riskBullets;
  if (!Array.isArray(bullets)) return [];
  return bullets
    .filter((b): b is string => typeof b === "string" && b.trim().length > 0)
    .map((b) => b.trim())
    .slice(0, 8);
}

async function enrichVault(
  listItem: Awaited<ReturnType<typeof listVaults>>[number],
): Promise<VaultCatalogItem> {
  const base: VaultCatalogItem = {
    vaultId: listItem.id,
    name: listItem.name,
    symbol: listItem.symbol,
    chainId: listItem.chainId,
    chainName: listItem.chainName,
    network: listItem.network,
    contractAddress: listItem.contractAddress,
    requiresWhitelist: listItem.requiresWhitelist,
    status: listItem.status,
    settlement: "unknown",
    totalAssets: null,
    totalSupply: null,
    pricePerShare: null,
    ttm: listItem.ttm ?? null,
    assetSymbol: listItem.underlyingAsset.symbol,
    assetDecimals: listItem.underlyingAsset.decimals,
    explorerUrl: listItem.explorerUrl ?? null,
    subgraphUrl: listItem.subgraphUrl
      ? normalizeSubgraphUrl(listItem.subgraphUrl)
      : null,
    riskBullets: riskBulletsFrom(listItem.transparency),
    transparencyDescription:
      typeof listItem.transparency?.description === "string"
        ? listItem.transparency.description
        : null,
    mcpOk: false,
  };

  try {
    const got = await vaultGet(listItem.id);
    const vault = got.vault ?? listItem;
    return {
      ...base,
      name: vault.name ?? base.name,
      symbol: vault.symbol ?? base.symbol,
      chainId: vault.chainId ?? base.chainId,
      chainName: vault.chainName ?? base.chainName,
      network: vault.network ?? base.network,
      contractAddress: vault.contractAddress ?? base.contractAddress,
      requiresWhitelist: vault.requiresWhitelist ?? base.requiresWhitelist,
      status: vault.status ?? base.status,
      settlement: got.settlement || base.settlement,
      totalAssets: got.pricing?.totalAssets ?? null,
      totalSupply: got.pricing?.totalSupply ?? null,
      pricePerShare: got.pricing?.pricePerShare ?? null,
      ttm: vault.ttm ?? base.ttm,
      assetSymbol: vault.underlyingAsset?.symbol ?? base.assetSymbol,
      assetDecimals: vault.underlyingAsset?.decimals ?? base.assetDecimals,
      explorerUrl: vault.explorerUrl ?? base.explorerUrl,
      subgraphUrl: vault.subgraphUrl
        ? normalizeSubgraphUrl(vault.subgraphUrl)
        : base.subgraphUrl,
      riskBullets: (() => {
        const bullets = riskBulletsFrom(vault.transparency);
        return bullets.length > 0 ? bullets : base.riskBullets;
      })(),
      transparencyDescription:
        typeof vault.transparency?.description === "string"
          ? vault.transparency.description
          : base.transparencyDescription,
      mcpOk: Boolean(got.ok),
    };
  } catch {
    return base;
  }
}

/** REST `/vaults` (4 items) + parallel MCP `vault_get` + optional subgraph activity. */
export async function buildVaultsCatalog(): Promise<VaultsCatalogResponse> {
  const listed = await listVaults();
  const vaults = await Promise.all(listed.map((item) => enrichVault(item)));
  const { activity, source, note } = await fetchVaultActivity(vaults);

  return {
    vaults,
    activity,
    activitySource: source,
    activityNote: note,
    fetchedAt: new Date().toISOString(),
  };
}
