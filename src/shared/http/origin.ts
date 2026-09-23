import { NextResponse } from "next/server";

/**
 * Soft CSRF guard for browser POSTs. Missing Origin (curl, server-to-server) is
 * allowed so the documented public API keeps working. Cross-site Origin is blocked.
 */
export function rejectCrossSiteOrigin(request: Request): NextResponse | null {
  const origin = request.headers.get("origin")?.trim();
  if (!origin) return null;

  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return NextResponse.json({ error: "Invalid Origin" }, { status: 403 });
  }

  const forwarded = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = (forwarded || request.headers.get("host") || "").split(":")[0];
  if (!host) return null;

  const originHostname = originHost.split(":")[0];
  if (originHostname.toLowerCase() !== host.toLowerCase()) {
    return NextResponse.json({ error: "Forbidden origin" }, { status: 403 });
  }
  return null;
}
