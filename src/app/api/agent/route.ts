import { NextResponse } from "next/server";
import { z } from "zod";
import { agentRequestSchema } from "@/features/agent/lib/agent-schema";
import { answerQuestion } from "@/features/agent/lib/answer-question";
import { RATE_LIMITS, rateLimitResponse } from "@/shared/http/rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const limited = rateLimitResponse(request, RATE_LIMITS.agent);
  if (limited) return limited;

  try {
    const json = await request.json();
    const body = agentRequestSchema.parse(json);
    const payload = await answerQuestion(body);
    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: error.flatten() },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "agent failed",
      },
      { status: 500 },
    );
  }
}
