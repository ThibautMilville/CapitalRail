import { NextResponse } from "next/server";
import { readStats } from "@/shared/http/instance-stats";
import { RATE_LIMITS, rateLimitResponse } from "@/shared/http/rate-limit";
import { listVaults } from "@/shared/ixs/rest";
import { servModels } from "@/shared/serv/config";
import { hasServApiKey } from "@/shared/serv/client";

export const dynamic = "force-dynamic";

let vaultCountCache: { count: number; at: number } | null = null;
const VAULT_COUNT_TTL_MS = 60_000;

async function cachedVaultCount(): Promise<number> {
  const now = Date.now();
  if (vaultCountCache && now - vaultCountCache.at < VAULT_COUNT_TTL_MS) {
    return vaultCountCache.count;
  }
  const vaults = await listVaults();
  vaultCountCache = { count: vaults.length, at: now };
  return vaults.length;
}

export async function GET(request: Request) {
  const limited = rateLimitResponse(request, RATE_LIMITS.health);
  if (limited) return limited;

  try {
    const vaultCount = await cachedVaultCount();
    return NextResponse.json({
      ok: true,
      ixs: {
        vaultCount,
        baseUrl: process.env.IXS_API_BASE_URL ?? "https://api-v2.ixs.finance",
      },
      serv: {
        configured: hasServApiKey(),
        models: servModels(),
      },
      stats: readStats(),
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "health check failed",
        serv: { configured: hasServApiKey(), models: servModels() },
        stats: readStats(),
      },
      { status: 503 },
    );
  }
}
