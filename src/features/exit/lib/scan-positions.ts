import { listVaults, getPosition } from "@/shared/ixs/rest";
import { vaultGet } from "@/shared/ixs/mcp";
import type { ExitPosition } from "./types";

function hasPositiveBaseUnits(value: string | undefined): boolean {
  if (!value) return false;
  try {
    return BigInt(value) > BigInt(0);
  } catch {
    return false;
  }
}

/**
 * Lists IXS vaults where the wallet holds redeemable shares.
 * Settlement comes from vault_get (may differ from deposit settlement).
 */
export async function scanExitPositions(
  wallet: string,
): Promise<ExitPosition[]> {
  const vaults = await listVaults();
  const settled = await Promise.all(
    vaults.map(async (vault) => {
      try {
        const [{ position }, detail] = await Promise.all([
          getPosition(vault.id, wallet),
          vaultGet(vault.id).catch(() => null),
        ]);
        const shares = position.balances.shares;
        const maxRedeem = position.limits.maxRedeem;
        const redeemable = hasPositiveBaseUnits(
          maxRedeem.baseUnits !== "0" ? maxRedeem.baseUnits : shares.baseUnits,
        );
        if (!redeemable && !hasPositiveBaseUnits(shares.baseUnits)) return null;

        return {
          vaultId: vault.id,
          name: vault.name,
          symbol: vault.symbol,
          chainId: vault.chainId,
          chainName: vault.chainName,
          network: vault.network,
          requiresWhitelist: vault.requiresWhitelist,
          settlement: detail?.settlement ?? "unknown",
          contractAddress: vault.contractAddress,
          shares: {
            baseUnits: shares.baseUnits,
            decimals: shares.decimals,
            display: shares.display,
          },
          shareValueInAssets: {
            baseUnits: position.balances.shareValueInAssets.baseUnits,
            decimals: position.balances.shareValueInAssets.decimals,
            display: position.balances.shareValueInAssets.display,
          },
          maxRedeem: {
            baseUnits: maxRedeem.baseUnits,
            decimals: maxRedeem.decimals,
            display: maxRedeem.display,
          },
        } satisfies ExitPosition;
      } catch {
        return null;
      }
    }),
  );

  return settled.filter((row): row is ExitPosition => row != null);
}
