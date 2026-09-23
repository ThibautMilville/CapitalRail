import { NextResponse } from "next/server";
import { readStats } from "@/shared/http/instance-stats";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(readStats());
}
