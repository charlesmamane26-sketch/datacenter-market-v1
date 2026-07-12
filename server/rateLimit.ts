import type { TrpcContext } from "./_core/context";

export interface RateLimitResult {
  allowed: boolean;
  retryAfterMs: number;
}

/**
 * Pluggable backing store for the sliding-window limiter. The default is
 * process-local (in-memory); set REDIS_URL to enforce limits across replicas.
 * `check` records a hit and returns the decision atomically for the given key.
 */
export interface RateLimitStore {
  check(key: string, limit: number, windowMs: number, now: number): Promise<RateLimitResult>;
}

// ---------------------------------------------------------------------------
// In-memory store (default)
// ---------------------------------------------------------------------------

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

/**
 * Pure sliding-window decision against the in-memory store. Kept synchronous so
 * the algorithm stays trivially testable; the async `RateLimitStore` wraps it.
 */
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

const memoryStore: RateLimitStore = {
  check: (key, limit, windowMs, now) => Promise.resolve(rateLimit(key, limit, windowMs, now)),
};

// ---------------------------------------------------------------------------
// Active store selection
// ---------------------------------------------------------------------------

let activeStore: RateLimitStore = memoryStore;

/** Swap the backing store (used by the Redis bootstrap; see ./_core/redisRateLimit). */
export function setRateLimitStore(s: RateLimitStore): void {
  activeStore = s;
}

/**
 * Async entry point used by request handlers. Routes through the active store
 * (in-memory by default, Redis when configured) so limits hold across replicas.
 */
export function enforceRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now(),
): Promise<RateLimitResult> {
  return activeStore.check(key, limit, windowMs, now);
}

/** Test-only: number of keys currently tracked (in-memory store). */
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

/** Test-only: clears the in-memory store and resets the active store to memory. */
export function __resetRateLimit(): void {
  store.clear();
  lastSweep = 0;
  activeStore = memoryStore;
}
