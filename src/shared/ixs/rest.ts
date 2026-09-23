import type { IxsVaultListItem, IxsVaultsResponse, PositionResult } from "./types";

const USER_AGENT = "CapitalRail/0.1";
const REST_TIMEOUT_MS = 10_000;

function baseUrl() {
  return process.env.IXS_API_BASE_URL ?? "https://api-v2.ixs.finance";
}

async function ixsFetch<T>(path: string): Promise<T> {
  const response = await fetch(`${baseUrl()}${path}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": USER_AGENT,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(REST_TIMEOUT_MS),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `IXS REST ${path} failed: ${response.status} ${body.slice(0, 200)}`,
    );
  }

  return response.json() as Promise<T>;
}

export async function listVaults(): Promise<IxsVaultListItem[]> {
  const data = await ixsFetch<IxsVaultsResponse>("/vaults");
  return data.items ?? [];
}

export async function getPosition(vaultId: string, wallet: string) {
  return ixsFetch<PositionResult>(`/vaults/${vaultId}/positions/${wallet}`);
}

export function toBaseUnits(amountHuman: string, decimals: number): string {
  const cleaned = amountHuman.trim();
  if (!/^\d+(\.\d+)?$/.test(cleaned)) {
    throw new Error(`Invalid amount: ${amountHuman}`);
  }

  const [whole, frac = ""] = cleaned.split(".");
  const fracPadded = (frac + "0".repeat(decimals)).slice(0, decimals);
  const raw = `${whole}${fracPadded}`.replace(/^0+(?=\d)/, "");
  return raw === "" ? "0" : raw;
}
