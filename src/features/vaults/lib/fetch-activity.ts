import { explorerTxUrl } from "@/shared/wallet/chains";
import type { VaultActivityItem, VaultCatalogItem } from "@/features/vaults/lib/types";

const USER_AGENT = "CapitalRail/0.1";
const SUBGRAPH_TIMEOUT_MS = 8_000;

/** REST sometimes omits trailing `/gn`; vault_get usually includes it. */
export function normalizeSubgraphUrl(raw: string): string | null {
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== "https:") return null;
    let path = url.pathname.replace(/\/$/, "");
    if (!path.endsWith("/gn")) path = `${path}/gn`;
    return `${url.origin}${path}`;
  } catch {
    return null;
  }
}

function shortAddr(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = value.startsWith("0x") ? value : `0x${value}`;
  if (v.length < 12) return v;
  return `${v.slice(0, 6)}...${v.slice(-4)}`;
}

function formatBaseUnits(base: string, decimals: number, symbol: string): string | null {
  try {
    const raw = BigInt(base);
    if (decimals === 0) return `${raw.toString()} ${symbol}`;
    const neg = raw < BigInt(0);
    const abs = neg ? -raw : raw;
    const str = abs.toString().padStart(decimals + 1, "0");
    const whole = str.slice(0, -decimals).replace(/^0+(?=\d)/, "") || "0";
    const frac = str.slice(-decimals).replace(/0+$/, "");
    const num = frac ? `${whole}.${frac.slice(0, 6)}` : whole;
    return `${neg ? "-" : ""}${num} ${symbol}`;
  } catch {
    return null;
  }
}

type GraphQlResponse = {
  data?: Record<string, unknown>;
  errors?: { message?: string }[];
};

async function graphql(
  endpoint: string,
  query: string,
  variables?: Record<string, unknown>,
): Promise<GraphQlResponse> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": USER_AGENT,
    },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
    signal: AbortSignal.timeout(SUBGRAPH_TIMEOUT_MS),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Subgraph HTTP ${response.status}: ${text.slice(0, 160)}`);
  }
  return JSON.parse(text) as GraphQlResponse;
}

type Erc7540Deposit = {
  id: string;
  requestId?: string;
  controller?: string;
  assets?: string;
  status?: string;
  requestedAt?: string;
  requestTxHash?: string;
  vault?: { id?: string };
};

type Erc7540Redeem = {
  id: string;
  requestId?: string;
  controller?: string;
  shares?: string;
  status?: string;
  requestedAt?: string;
  requestTxHash?: string;
  vault?: { id?: string };
};

type ManagedActivity = {
  id: string;
  type?: string;
  txHash?: string;
  timestamp?: string;
  actor?: string | null;
  amount0?: string | null;
  amount1?: string | null;
  requestId?: string | null;
  note?: string | null;
  vault?: string;
};

function mapErc7540(
  vault: VaultCatalogItem,
  deposits: Erc7540Deposit[],
  redeems: Erc7540Redeem[],
): VaultActivityItem[] {
  const vaultAddr = vault.contractAddress.toLowerCase();
  const out: VaultActivityItem[] = [];

  for (const row of deposits) {
    const rowVault = row.vault?.id?.toLowerCase();
    if (rowVault && rowVault !== vaultAddr) continue;
    const ts = row.requestedAt ? Number(row.requestedAt) : null;
    const hash = row.requestTxHash ?? null;
    out.push({
      id: `dep-${vault.vaultId}-${row.id}`,
      vaultId: vault.vaultId,
      chainId: vault.chainId,
      kind: "deposit",
      label: "Deposit request",
      status: row.status ?? null,
      amountDisplay: row.assets
        ? formatBaseUnits(row.assets, vault.assetDecimals, vault.assetSymbol)
        : null,
      actor: shortAddr(row.controller),
      timestampSec: Number.isFinite(ts) ? ts : null,
      txHash: hash,
      explorerTxUrl: hash ? explorerTxUrl(vault.chainId, hash) : null,
    });
  }

  for (const row of redeems) {
    const rowVault = row.vault?.id?.toLowerCase();
    if (rowVault && rowVault !== vaultAddr) continue;
    const ts = row.requestedAt ? Number(row.requestedAt) : null;
    const hash = row.requestTxHash ?? null;
    out.push({
      id: `red-${vault.vaultId}-${row.id}`,
      vaultId: vault.vaultId,
      chainId: vault.chainId,
      kind: "redeem",
      label: "Redeem request",
      status: row.status ?? null,
      amountDisplay: row.shares
        ? formatBaseUnits(row.shares, 18, "shares")
        : null,
      actor: shortAddr(row.controller),
      timestampSec: Number.isFinite(ts) ? ts : null,
      txHash: hash,
      explorerTxUrl: hash ? explorerTxUrl(vault.chainId, hash) : null,
    });
  }

  return out;
}

function mapManaged(vault: VaultCatalogItem, rows: ManagedActivity[]): VaultActivityItem[] {
  const vaultAddr = vault.contractAddress.toLowerCase();
  return rows
    .filter((row) => {
      const v = (row.vault ?? "").toLowerCase();
      return !v || v === vaultAddr || v === vaultAddr.replace(/^0x/, "");
    })
    .map((row) => {
      const type = (row.type ?? "other").toLowerCase();
      const kind =
        type.includes("deposit") || type.includes("subscribe")
          ? ("deposit" as const)
          : type.includes("redeem") || type.includes("withdraw")
            ? ("redeem" as const)
            : ("other" as const);
      const ts = row.timestamp ? Number(row.timestamp) : null;
      const hash = row.txHash ?? null;
      const amountRaw = row.amount0 ?? row.amount1;
      return {
        id: `act-${vault.vaultId}-${row.id}`,
        vaultId: vault.vaultId,
        chainId: vault.chainId,
        kind,
        label: row.type ?? row.note ?? "Vault activity",
        status: null,
        amountDisplay: amountRaw
          ? formatBaseUnits(amountRaw, vault.assetDecimals, vault.assetSymbol)
          : null,
        actor: shortAddr(row.actor ?? undefined),
        timestampSec: Number.isFinite(ts) ? ts : null,
        txHash: hash,
        explorerTxUrl: hash ? explorerTxUrl(vault.chainId, hash) : null,
      };
    });
}

async function fetchErc7540Activity(
  endpoint: string,
  vault: VaultCatalogItem,
): Promise<VaultActivityItem[] | null> {
  const vaultId = vault.contractAddress.toLowerCase();
  const result = await graphql(
    endpoint,
    `query($vault: String!) {
      depositRequests(
        first: 8
        orderBy: requestedAt
        orderDirection: desc
        where: { vault: $vault }
      ) {
        id requestId controller assets status requestedAt requestTxHash vault { id }
      }
      redeemRequests(
        first: 8
        orderBy: requestedAt
        orderDirection: desc
        where: { vault: $vault }
      ) {
        id requestId controller shares status requestedAt requestTxHash vault { id }
      }
    }`,
    { vault: vaultId },
  );
  if (result.errors?.length) return null;
  const deposits = (result.data?.depositRequests as Erc7540Deposit[] | undefined) ?? [];
  const redeems = (result.data?.redeemRequests as Erc7540Redeem[] | undefined) ?? [];
  return mapErc7540(vault, deposits, redeems);
}

async function fetchManagedActivity(
  endpoint: string,
  vault: VaultCatalogItem,
): Promise<VaultActivityItem[] | null> {
  const vaultId = vault.contractAddress.toLowerCase();
  const result = await graphql(
    endpoint,
    `query($vault: Bytes!) {
      vaultActivities(
        first: 12
        orderBy: timestamp
        orderDirection: desc
        where: { vault: $vault }
      ) {
        id type txHash timestamp actor amount0 amount1 requestId note vault
      }
    }`,
    { vault: vaultId },
  );
  if (result.errors?.length) {
    // Some managed graphs want unprefixed bytes or no where filter.
    const fallback = await graphql(
      endpoint,
      `{
        vaultActivities(first: 12, orderBy: timestamp, orderDirection: desc) {
          id type txHash timestamp actor amount0 amount1 requestId note vault
        }
      }`,
    );
    if (fallback.errors?.length) return null;
    const rows = (fallback.data?.vaultActivities as ManagedActivity[] | undefined) ?? [];
    return mapManaged(vault, rows);
  }
  const rows = (result.data?.vaultActivities as ManagedActivity[] | undefined) ?? [];
  return mapManaged(vault, rows);
}

/**
 * Probe Goldsky subgraphs linked on each vault. Returns [] + note when nothing works.
 * Does not invent transactions.
 */
export async function fetchVaultActivity(
  vaults: VaultCatalogItem[],
): Promise<{
  activity: VaultActivityItem[];
  source: "subgraph" | "unavailable";
  note: string | null;
}> {
  const uniqueEndpoints = new Map<string, VaultCatalogItem[]>();
  for (const vault of vaults) {
    if (!vault.subgraphUrl) continue;
    const endpoint = normalizeSubgraphUrl(vault.subgraphUrl);
    if (!endpoint) continue;
    const list = uniqueEndpoints.get(endpoint) ?? [];
    list.push(vault);
    uniqueEndpoints.set(endpoint, list);
  }

  if (uniqueEndpoints.size === 0) {
    return {
      activity: [],
      source: "unavailable",
      note: "No subgraph URL on these vaults - activity history is not available.",
    };
  }

  const collected: VaultActivityItem[] = [];
  let anyOk = false;
  const errors: string[] = [];

  await Promise.all(
    [...uniqueEndpoints.entries()].map(async ([endpoint, group]) => {
      for (const vault of group) {
        try {
          const erc = await fetchErc7540Activity(endpoint, vault);
          if (erc) {
            anyOk = true;
            collected.push(...erc);
            continue;
          }
        } catch (error) {
          errors.push(error instanceof Error ? error.message : String(error));
        }
        try {
          const managed = await fetchManagedActivity(endpoint, vault);
          if (managed) {
            anyOk = true;
            collected.push(...managed);
          }
        } catch (error) {
          errors.push(error instanceof Error ? error.message : String(error));
        }
      }
    }),
  );

  collected.sort((a, b) => (b.timestampSec ?? 0) - (a.timestampSec ?? 0));
  const activity = collected.slice(0, 24);

  if (!anyOk) {
    return {
      activity: [],
      source: "unavailable",
      note:
        errors[0] != null
          ? `Subgraph activity probe failed (${errors[0].slice(0, 120)}). No invented history.`
          : "Subgraph activity is unavailable for these vaults right now.",
    };
  }

  return {
    activity,
    source: "subgraph",
    note: activity.length
      ? "Recent deposit / redeem requests from IXS Goldsky subgraphs."
      : "Subgraphs responded but returned no recent deposit or redeem requests.",
  };
}
