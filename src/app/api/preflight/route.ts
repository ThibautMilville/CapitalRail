import { NextResponse } from "next/server";
import { z } from "zod";
import {
  preflightBodySchema,
  runPreflight,
} from "@/features/preflight/lib/run-preflight";
import { recordDecision } from "@/shared/http/instance-stats";
import { rejectCrossSiteOrigin } from "@/shared/http/origin";
import { RATE_LIMITS, expensiveRateLimitResponse } from "@/shared/http/rate-limit";
import { safeServerError, zodErrorResponse } from "@/shared/http/safe-error";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const originBlocked = rejectCrossSiteOrigin(request);
  if (originBlocked) return originBlocked;

  const limited = expensiveRateLimitResponse(request, RATE_LIMITS.preflight);
  if (limited) return limited;

  try {
    const json = await request.json();
    const body = preflightBodySchema.parse(json);
    const payload = await runPreflight(body);
    recordDecision(payload.decision);
    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof z.ZodError) return zodErrorResponse(error);
    return safeServerError("preflight", error, "preflight failed");
  }
}
