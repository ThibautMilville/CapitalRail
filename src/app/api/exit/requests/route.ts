import { NextResponse } from "next/server";
import { z } from "zod";
import { vaultRequestStatus } from "@/shared/ixs/mcp";
import { RATE_LIMITS, rateLimitResponse } from "@/shared/http/rate-limit";
import { zodErrorResponse } from "@/shared/http/safe-error";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const querySchema = z.object({
  wallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid wallet address"),
  vaultId: z.string().regex(/^[a-f0-9]{24}$/i).optional(),
});

export async function GET(request: Request) {
  const limited = rateLimitResponse(request, RATE_LIMITS.exitStatus);
  if (limited) return limited;

  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = querySchema.safeParse(params);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  try {
    const raw = await vaultRequestStatus({
      ownerAddress: parsed.data.wallet,
      vaultId: parsed.data.vaultId,
    });
    const requests = raw.requests ?? raw.items ?? [];
    return NextResponse.json({
      ok: true,
      requests: Array.isArray(requests) ? requests : [],
      available: true,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error("[exit-requests]", detail);
    // IXS subgraph feed is currently flaky; surface an empty list instead of 500.
    return NextResponse.json({
      ok: false,
      available: false,
      requests: [],
      error: "IXS request status feed is unavailable right now.",
    });
  }
}
