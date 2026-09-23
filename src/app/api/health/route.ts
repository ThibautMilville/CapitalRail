import { NextResponse } from "next/server";
import { readStats } from "@/shared/http/instance-stats";
import { listVaults } from "@/shared/ixs/rest";
import { servModels } from "@/shared/serv/config";
import { hasServApiKey } from "@/shared/serv/client";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const vaults = await listVaults();
    return NextResponse.json({
      ok: true,
      ixs: {
        vaultCount: vaults.length,
        baseUrl: process.env.IXS_API_BASE_URL ?? "https://api-v2.ixs.finance",
      },
      serv: {
        configured: hasServApiKey(),
        models: servModels(),
      },
      stats: readStats(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "health check failed",
        serv: { configured: hasServApiKey(), models: servModels() },
        stats: readStats(),
      },
      { status: 503 },
    );
  }
}
