import { NextResponse } from "next/server";
import { z } from "zod";
import { buildClaimPack } from "@/features/exit/lib/build-exit";
import { rejectCrossSiteOrigin } from "@/shared/http/origin";
import { RATE_LIMITS, rateLimitResponse } from "@/shared/http/rate-limit";
import { safeServerError, zodErrorResponse } from "@/shared/http/safe-error";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const bodySchema = z.object({
  vaultId: z.string().regex(/^[a-f0-9]{24}$/i, "Invalid vault id"),
  wallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid wallet address"),
  requestId: z.string().min(1).max(128),
});

export async function POST(request: Request) {
  const originBlocked = rejectCrossSiteOrigin(request);
  if (originBlocked) return originBlocked;

  const limited = rateLimitResponse(request, RATE_LIMITS.exitBuild);
  if (limited) return limited;

  try {
    const json = await request.json();
    const body = bodySchema.parse(json);
    const payload = await buildClaimPack({
      vaultId: body.vaultId,
      ownerAddress: body.wallet,
      requestId: body.requestId,
    });
    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof z.ZodError) return zodErrorResponse(error);
    const message = error instanceof Error ? error.message : "";
    if (/claim|requestId|sync|no separate/i.test(message)) {
      return NextResponse.json(
        {
          error:
            "IXS could not prepare this claim. The request may still be pending, or this vault has no claim step.",
        },
        { status: 422 },
      );
    }
    return safeServerError("exit-claim", error, "Could not prepare claim");
  }
}
