import { getPosition, listVaults, toBaseUnits } from "@/shared/ixs/rest";
import {
  isDepositLimitZeroError,
  vaultBuildRequestDeposit,
  vaultCheckWhitelist,
  vaultGet,
} from "@/shared/ixs/mcp";
import type { RailSnapshot, RailStatus, WhitelistCheckResult } from "@/shared/ixs/types";
import { isDemoWallet } from "@/shared/wallet/demo-wallet";

export type ScanRailsInput = {
  walletAddress: `0x${string}`;
  amount: string;
};

function readWhitelistFlag(result: WhitelistCheckResult): boolean | null {
  if (typeof result.whitelisted === "boolean") return result.whitelisted;
  if (typeof result.isWhitelisted === "boolean") return result.isWhitelisted;
  if (typeof result.allowed === "boolean") return result.allowed;
  return null;
}

export async function scanRails(input: ScanRailsInput): Promise<RailSnapshot[]> {
  const vaults = await listVaults();
  const demoWallet = isDemoWallet(input.walletAddress);

  return Promise.all(
    vaults.map(async (vault): Promise<RailSnapshot> => {
      const reasonCodes: string[] = [];
      let settlement = "unknown";
      let pricePerShare: string | null = null;
      let totalAssets: string | null = null;
      let whitelistOk: boolean | null = null;
      let depositBuildOk = false;
      let depositBuildError: string | null = null;
      let walletAssetBalance: string | null = null;
      let walletShareBalance: string | null = null;

      try {
        const got = await vaultGet(vault.id);
        settlement = got.settlement ?? "unknown";
        pricePerShare = got.pricing?.pricePerShare ?? null;
        totalAssets = got.pricing?.totalAssets ?? null;
      } catch (error) {
        reasonCodes.push("BUILD_FAILED");
        depositBuildError =
          error instanceof Error ? error.message : "vault_get failed";
      }

      if (vault.requiresWhitelist) {
        try {
          const whitelist = await vaultCheckWhitelist(
            vault.id,
            input.walletAddress,
          );
          whitelistOk = readWhitelistFlag(whitelist);
          if (whitelistOk === false) {
            reasonCodes.push("WHITELIST_REQUIRED");
          }
        } catch {
          whitelistOk = null;
          reasonCodes.push("WHITELIST_REQUIRED");
        }
      } else {
        whitelistOk = true;
      }

      const assetAmount = toBaseUnits(
        input.amount,
        vault.underlyingAsset.decimals,
      );
      let balanceTooLow = false;

      // The placeholder address holds real third-party funds: never read or show them.
      if (!demoWallet) {
        try {
          const position = await getPosition(vault.id, input.walletAddress);
          const asset = position.position.balances.asset;
          walletAssetBalance = asset.display;
          walletShareBalance = position.position.balances.shares.display;
          if (/^\d+$/.test(asset.baseUnits)) {
            balanceTooLow = BigInt(asset.baseUnits) < BigInt(assetAmount);
          }
        } catch {
          // Position reads are best-effort.
        }
      }

      try {
        await vaultBuildRequestDeposit({
          vaultId: vault.id,
          ownerAddress: input.walletAddress,
          assetAmount,
        });
        depositBuildOk = true;
        reasonCodes.push(balanceTooLow ? "INSUFFICIENT_BALANCE" : "OK");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        depositBuildError = message;
        depositBuildOk = false;
        if (isDepositLimitZeroError(message)) {
          reasonCodes.push("DEPOSIT_LIMIT_ZERO");
        } else if (!reasonCodes.includes("WHITELIST_REQUIRED")) {
          reasonCodes.push("BUILD_FAILED");
        }
      }

      let status: RailStatus = "blocked";
      if (vault.requiresWhitelist && whitelistOk !== true) {
        status = "gated";
      } else if (depositBuildOk) {
        status = "open";
      }

      return {
        vaultId: vault.id,
        name: vault.name,
        symbol: vault.symbol,
        chainId: vault.chainId,
        chainName: vault.chainName,
        network: vault.network,
        contractAddress: vault.contractAddress,
        requiresWhitelist: vault.requiresWhitelist,
        whitelistOk,
        settlement,
        status,
        pricePerShare,
        totalAssets,
        ttm: vault.ttm ?? null,
        assetSymbol: vault.underlyingAsset.symbol,
        assetDecimals: vault.underlyingAsset.decimals,
        assetAddress: vault.underlyingAsset.address,
        walletAssetBalance,
        walletShareBalance,
        depositBuildOk,
        depositBuildError,
        reasonCodes: [...new Set(reasonCodes)],
      };
    }),
  );
}
