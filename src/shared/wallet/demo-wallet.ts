/** Placeholder owner used before a wallet is connected. Never build a tx pack for it. */
export const DEMO_WALLET_ADDRESS =
  "0x0000000000000000000000000000000000000001" as const;

export function isDemoWallet(address: string): boolean {
  return address.toLowerCase() === DEMO_WALLET_ADDRESS;
}
