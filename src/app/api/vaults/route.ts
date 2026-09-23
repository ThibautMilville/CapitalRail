import { NextResponse } from "next/server";
import { buildVaultsCatalog } from "@/features/vaults/lib/build-catalog";
import { RATE_LIMITS, rateLimitResponse } from "@/shared/http/rate-limit";
import { safeServerError } from "@/shared/http/safe-error";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const limited = rateLimitResponse(request, RATE_LIMITS.vaults);
  if (limited) return limited;

  try {
    const catalog = await buildVaultsCatalog();
    return NextResponse.json(catalog);
  } catch (error) {
    return safeServerError("vaults", error, "Could not load IXS vaults");
  }
}
