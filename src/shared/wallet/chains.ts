import { avalanche, bsc } from "viem/chains";

export const supportedChains = [bsc, avalanche] as const;

export const SUPPORTED_CHAIN_IDS: readonly number[] = [bsc.id, avalanche.id];

export function chainLabel(chainId: number): string {
  if (chainId === 56) return "BSC";
  if (chainId === 43114) return "Avalanche";
  return `Chain ${chainId}`;
}

export function explorerName(chainId: number): string {
  if (chainId === 56) return "BscScan";
  if (chainId === 43114) return "Snowtrace";
  return "explorer";
}

export function explorerTxUrl(chainId: number, hash: string): string | null {
  if (chainId === 56) return `https://bscscan.com/tx/${hash}`;
  if (chainId === 43114) return `https://snowtrace.io/tx/${hash}`;
  return null;
}
