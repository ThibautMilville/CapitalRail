import { NextResponse } from "next/server";
import { z } from "zod";
import { parseIntent } from "@/features/preflight/lib/parse-intent";
import { rejectCrossSiteOrigin } from "@/shared/http/origin";
import { RATE_LIMITS, expensiveRateLimitResponse } from "@/shared/http/rate-limit";
import { safeServerError, zodErrorResponse } from "@/shared/http/safe-error";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const bodySchema = z.object({
  message: z.string().trim().min(1).max(500),
});

export async function POST(request: Request) {
  const originBlocked = rejectCrossSiteOrigin(request);
  if (originBlocked) return originBlocked;

  const limited = expensiveRateLimitResponse(request, RATE_LIMITS.intent);
  if (limited) return limited;

  try {
    const json = await request.json();
    const body = bodySchema.parse(json);
    const intent = await parseIntent(body.message);
    return NextResponse.json(intent);
  } catch (error) {
    if (error instanceof z.ZodError) return zodErrorResponse(error);
    return safeServerError("intent", error, "intent parse failed");
  }
}
