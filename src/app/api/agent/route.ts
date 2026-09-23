import { NextResponse } from "next/server";
import { z } from "zod";
import { agentRequestSchema } from "@/features/agent/lib/agent-schema";
import { answerQuestion } from "@/features/agent/lib/answer-question";
import { rejectCrossSiteOrigin } from "@/shared/http/origin";
import { RATE_LIMITS, expensiveRateLimitResponse } from "@/shared/http/rate-limit";
import { safeServerError, zodErrorResponse } from "@/shared/http/safe-error";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const originBlocked = rejectCrossSiteOrigin(request);
  if (originBlocked) return originBlocked;

  const limited = expensiveRateLimitResponse(request, RATE_LIMITS.agent);
  if (limited) return limited;

  try {
    const json = await request.json();
    const body = agentRequestSchema.parse(json);
    const payload = await answerQuestion(body);
    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof z.ZodError) return zodErrorResponse(error);
    return safeServerError("agent", error, "agent failed");
  }
}
