import { NextResponse } from "next/server";
import { z } from "zod";
import {
  preflightBodySchema,
  runPreflight,
} from "@/features/preflight/lib/run-preflight";
import { recordDecision } from "@/shared/http/instance-stats";
import { RATE_LIMITS, rateLimitResponse } from "@/shared/http/rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const limited = rateLimitResponse(request, RATE_LIMITS.preflight);
  if (limited) return limited;

  try {
    const json = await request.json();
    const body = preflightBodySchema.parse(json);
    const payload = await runPreflight(body);
    recordDecision(payload.decision);
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
        error: error instanceof Error ? error.message : "preflight failed",
      },
      { status: 500 },
    );
  }
}
