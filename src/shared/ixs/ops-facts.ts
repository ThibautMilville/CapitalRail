/**
 * Operator facts from IXS Discord (Emirax/IXS → Tim/Cutoff, 24 Sep 2026).
 * Injected into SERV payloads so models may cite them without inventing.
 * Do not invent Singapore public holidays; that remains unanswered.
 */

export const IXS_HYB_AVALANCHE_OPEN_VAULT_ID = "6a952729732c2b84b55ce89d";

/** Avalanche HYB open vault (also referenced as 0xaD01…8bD9 on-chain). */
export const IXS_OPS_FACTS = {
  source:
    "IXS Discord (Emirax/IXS to Tim/Cutoff), 24 Sep 2026 - HYB Avalanche ops",
  vaultId: IXS_HYB_AVALANCHE_OPEN_VAULT_ID,
  depositLimitZeroMeaning:
    "MCP deposit limit 0 on this Avalanche vault relates to NAV staleness or drift, not a permanently closed vault. Integrators must not force a deposit when MCP / deposit build reports limit 0; CapitalRail keeps WAIT until a successful build.",
  minDepositUsdc: 100,
  settlementCutoff:
    "Daily cutoff 5:00 PM SGT (UTC+8) on Singapore business days Mon-Fri. Requests may be submitted anytime; they are processed against the next cutoff. Applies to deposits and redemptions.",
  redemptionClaim:
    "No separate claim step for this product: the operator finalizes and USDC goes to the receiver.",
  singaporePublicHolidays:
    "Singapore public holiday handling for the cutoff calendar is unanswered - do not invent a holiday list.",
} as const;

export type IxsOpsFacts = typeof IXS_OPS_FACTS;

/** Soft UI hint only when the mandate targets Avalanche and amount is below the HYB min. */
export function belowAvalancheHybMinDeposit(
  amount: string,
  preferredChainId: string,
): boolean {
  if (preferredChainId !== "43114") return false;
  const value = Number.parseFloat(amount);
  return Number.isFinite(value) && value > 0 && value < IXS_OPS_FACTS.minDepositUsdc;
}
