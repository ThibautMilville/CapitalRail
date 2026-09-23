import type { MandateValues } from "./mandate";

/** Request body for POST /api/preflight from the UI rules. */
export function preflightRequestBody(values: MandateValues, forceRescan = false) {
  return {
    walletAddress: values.walletAddress,
    amount: values.amount,
    preferences: {
      allowKyc: values.allowKyc,
      requireSyncSettlement: values.requireSyncSettlement,
      preferredChainId: values.preferredChainId
        ? (Number(values.preferredChainId) as 56 | 43114)
        : undefined,
    },
    forceRescan,
  };
}

/** Ready-to-paste curl for the same check, for agents and wallets. */
export function preflightCurl(values: MandateValues, origin: string): string {
  const body = JSON.stringify(preflightRequestBody(values), null, 2);
  return [
    `curl -s -X POST ${origin}/api/preflight \\`,
    `  -H 'Content-Type: application/json' \\`,
    `  -d '${body.replace(/'/g, "'\\''")}'`,
  ].join("\n");
}
