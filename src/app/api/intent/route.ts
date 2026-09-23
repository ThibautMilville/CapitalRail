import { NextResponse } from "next/server";
import { z } from "zod";
import { parseIntent } from "@/features/preflight/lib/parse-intent";
import { RATE_LIMITS, rateLimitResponse } from "@/shared/http/rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const bodySchema = z.object({
  message: z.string().trim().min(1).max(500),
});

export async function POST(request: Request) {
  const limited = rateLimitResponse(request, RATE_LIMITS.intent);
  if (limited) return limited;

  try {
    const json = await request.json();
    const body = bodySchema.parse(json);
    const intent = await parseIntent(body.message);
    return NextResponse.json(intent);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: error.flatten() },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "intent parse failed",
      },
      { status: 500 },
    );
  }
}
