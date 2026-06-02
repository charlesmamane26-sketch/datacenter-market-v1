import type { TrpcContext } from "./_core/context";

export interface RateLimitResult {
  allowed: boolean;
  retryAfterMs: number;
}

/**
 * In-memory sliding-window rate limiter.
 *
 * NOTE: the store is process-local. For multi-instance deployments, back this with a shared
 * store (e.g. Redis) so limits are enforced across replicas. Old hits are pruned lazily on access.
 */
const store = new Map<string, number[]>();

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now(),
): RateLimitResult {
  const cutoff = now - windowMs;
  const hits = (store.get(key) ?? []).filter(ts => ts > cutoff);

  if (hits.length >= limit) {
    store.set(key, hits);
    return { allowed: false, retryAfterMs: Math.max(0, hits[0] + windowMs - now) };
  }

  hits.push(now);
  store.set(key, hits);
  return { allowed: true, retryAfterMs: 0 };
}

/** Best-effort client IP, preferring the first X-Forwarded-For hop behind a proxy. */
export function clientIp(req: TrpcContext["req"]): string {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.length > 0) return xff.split(",")[0].trim();
  if (Array.isArray(xff) && xff.length > 0) return String(xff[0]).trim();
  return req.ip ?? req.socket?.remoteAddress ?? "unknown";
}

/** Test-only: clears the limiter store. */
export function __resetRateLimit(): void {
  store.clear();
}
