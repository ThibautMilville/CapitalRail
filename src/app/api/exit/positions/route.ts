import { NextResponse } from "next/server";
import { z } from "zod";
import { scanExitPositions } from "@/features/exit/lib/scan-positions";
import { RATE_LIMITS, rateLimitResponse } from "@/shared/http/rate-limit";
import { safeServerError, zodErrorResponse } from "@/shared/http/safe-error";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const querySchema = z.object({
  wallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid wallet address"),
});

export async function GET(request: Request) {
  const limited = rateLimitResponse(request, RATE_LIMITS.exitPositions);
  if (limited) return limited;

  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = querySchema.safeParse(params);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  try {
    const positions = await scanExitPositions(parsed.data.wallet);
    return NextResponse.json({
      wallet: parsed.data.wallet,
      positions,
    });
  } catch (error) {
    return safeServerError("exit-positions", error, "Could not load positions");
  }
}
