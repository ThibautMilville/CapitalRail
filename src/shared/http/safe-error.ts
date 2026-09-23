import { NextResponse } from "next/server";
import { z } from "zod";

/** Generic 500 body - never echo upstream IXS/SERV/stack details to clients. */
export function safeServerError(
  logLabel: string,
  error: unknown,
  publicMessage: string,
): NextResponse {
  const detail = error instanceof Error ? error.message : String(error);
  console.error(`[${logLabel}]`, detail);
  return NextResponse.json({ error: publicMessage }, { status: 500 });
}

export function zodErrorResponse(error: z.ZodError): NextResponse {
  return NextResponse.json(
    { error: "Invalid request", details: error.flatten() },
    { status: 400 },
  );
}
