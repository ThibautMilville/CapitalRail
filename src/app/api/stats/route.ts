import { NextResponse } from "next/server";
import { readStats } from "@/shared/http/instance-stats";
import { RATE_LIMITS, rateLimitResponse } from "@/shared/http/rate-limit";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const limited = rateLimitResponse(request, RATE_LIMITS.stats);
  if (limited) return limited;
  return NextResponse.json(readStats());
}
