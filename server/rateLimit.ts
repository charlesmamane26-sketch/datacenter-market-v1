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

// Lazy pruning only touches keys that are queried again, so one request from each
// of N distinct IPs would grow the Map forever. Sweep expired keys periodically.
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;
const MAX_WINDOW_MS = 60 * 60 * 1000; // upper bound on any window used by callers
let lastSweep = 0;

function sweep(now: number) {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  const cutoff = now - MAX_WINDOW_MS;
  store.forEach((hits, key) => {
    if (hits.length === 0 || hits[hits.length - 1] <= cutoff) store.delete(key);
  });
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now(),
): RateLimitResult {
  sweep(now);
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

/** Test-only: number of keys currently tracked. */
export function __storeSize(): number {
  return store.size;
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
  lastSweep = 0;
}
