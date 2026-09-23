import type { IxsVaultListItem, IxsVaultsResponse, PositionResult } from "./types";

const USER_AGENT = "CapitalRail/0.1";
const REST_TIMEOUT_MS = 10_000;
const DEFAULT_BASE = "https://api-v2.ixs.finance";

function assertPublicHttpsUrl(raw: string, label: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`${label} is not a valid URL`);
  }
  if (url.protocol !== "https:") {
    throw new Error(`${label} must use https`);
  }
  const host = url.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".local") ||
    host === "0.0.0.0" ||
    host.startsWith("127.") ||
    host.startsWith("10.") ||
    host.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host) ||
    host === "[::1]"
  ) {
    throw new Error(`${label} points to a private host`);
  }
  return url.origin + (url.pathname === "/" ? "" : url.pathname.replace(/\/$/, ""));
}

function baseUrl() {
  const raw = process.env.IXS_API_BASE_URL?.trim() || DEFAULT_BASE;
  return assertPublicHttpsUrl(raw, "IXS_API_BASE_URL");
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
