import { NextResponse } from "next/server";

type Bucket = { count: number; resetAt: number };

export type RateLimitRule = {
  /** Bucket namespace, one per route. */
  name: string;
  limit: number;
  windowMs: number;
};

/**
 * Per-route limits per client IP. In-memory: resets on restart, per server instance.
 * SERV-costly routes are tight: once SERV_API_KEY is set, each call burns credits.
 */
export const RATE_LIMITS = {
  preflight: { name: "preflight", limit: 6, windowMs: 60_000 },
  intent: { name: "intent", limit: 10, windowMs: 60_000 },
  agent: { name: "agent", limit: 10, windowMs: 60_000 },
  position: { name: "position", limit: 20, windowMs: 60_000 },
  health: { name: "health", limit: 30, windowMs: 60_000 },
  stats: { name: "stats", limit: 30, windowMs: 60_000 },
  /** Shared budget across preflight + intent + agent (SERV / IXS scan). */
  expensive: { name: "expensive", limit: 12, windowMs: 60_000 },
} satisfies Record<string, RateLimitRule>;

const MAX_BUCKETS = 10_000;
const buckets = new Map<string, Bucket>();

/**
 * Proxy-set headers first (Cloudflare, then the reverse proxy). For
 * X-Forwarded-For the last hop is the one appended by our own proxy; earlier
 * entries are client-controlled.
 */
export function clientIp(request: Request): string {
  const direct =
    request.headers.get("cf-connecting-ip")?.trim() ||
    request.headers.get("x-real-ip")?.trim();
  if (direct) return direct;
  const forwarded = request.headers.get("x-forwarded-for");
  const last = forwarded?.split(",").at(-1)?.trim();
  return last || "local";
}

function sweep(now: number) {
  if (buckets.size < MAX_BUCKETS) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export type RateLimitResult =
  | { ok: true; remaining: number }
  | { ok: false; retryAfterSec: number };

export function checkRateLimit(
  rule: RateLimitRule,
  key: string,
  now = Date.now(),
): RateLimitResult {
  sweep(now);
  const id = `${rule.name}:${key}`;
  const bucket = buckets.get(id);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(id, { count: 1, resetAt: now + rule.windowMs });
    return { ok: true, remaining: rule.limit - 1 };
  }
  if (bucket.count >= rule.limit) {
    return {
      ok: false,
      retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }
  bucket.count += 1;
  return { ok: true, remaining: rule.limit - bucket.count };
}

function limitedResponse(retryAfterSec: number): NextResponse {
  return NextResponse.json(
    {
      error: `Too many requests - please wait ${retryAfterSec} s and try again.`,
      code: "RATE_LIMITED",
      retryAfterSec,
    },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSec) },
    },
  );
}

/** Returns a 429 response when the caller is over the limit, otherwise null. */
export function rateLimitResponse(
  request: Request,
  rule: RateLimitRule,
): NextResponse | null {
  const result = checkRateLimit(rule, clientIp(request));
  if (result.ok) return null;
  return limitedResponse(result.retryAfterSec);
}

/**
 * Applies a route rule plus the shared expensive budget (SERV / heavy IXS).
 * Counts against both buckets only when all checks pass.
 */
export function expensiveRateLimitResponse(
  request: Request,
  rule: RateLimitRule,
): NextResponse | null {
  const ip = clientIp(request);
  const route = checkRateLimit(rule, ip);
  if (!route.ok) return limitedResponse(route.retryAfterSec);
  const shared = checkRateLimit(RATE_LIMITS.expensive, ip);
  if (!shared.ok) return limitedResponse(shared.retryAfterSec);
  return null;
}
