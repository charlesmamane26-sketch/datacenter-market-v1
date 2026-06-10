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

/**
 * Best-effort client IP. Relies on req.ip, which Express derives from X-Forwarded-For
 * only for hops covered by the "trust proxy" setting (see server/_core/index.ts).
 * Never read X-Forwarded-For directly: clients can prepend arbitrary entries to it,
 * which would let them rotate rate-limit keys at will.
 */
export function clientIp(req: TrpcContext["req"]): string {
  return req.ip ?? req.socket?.remoteAddress ?? "unknown";
}

/** Test-only: clears the limiter store. */
export function __resetRateLimit(): void {
  store.clear();
}
