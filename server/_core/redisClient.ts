/**
 * Shared optional Redis client. A single connection is lazily created from
 * REDIS_URL and reused by every Redis-backed feature (rate-limit store, session
 * revocation denylist). ioredis is an optional dependency, imported dynamically:
 * the app builds and runs without it, and without REDIS_URL Redis stays off.
 */

interface RedisMulti {
  zremrangebyscore(key: string, min: number, max: number): RedisMulti;
  zadd(key: string, score: number, member: string): RedisMulti;
  zcard(key: string): RedisMulti;
  pexpire(key: string, ms: number): RedisMulti;
  exec(): Promise<Array<[Error | null, unknown]> | null>;
}

export interface SharedRedis {
  multi(): RedisMulti;
  zrange(key: string, start: number, stop: number, withScores: "WITHSCORES"): Promise<string[]>;
  set(key: string, value: string, mode: "PX", ttlMs: number): Promise<unknown>;
  exists(key: string): Promise<number>;
}

let client: SharedRedis | null = null;
let initialized = false;

/**
 * Returns the shared Redis client, or null if REDIS_URL is unset or the client
 * could not be created. Initialization is attempted once; failures are sticky
 * (null) so callers degrade gracefully to their in-memory / disabled behavior.
 */
export async function getRedis(): Promise<SharedRedis | null> {
  if (initialized) return client;
  initialized = true;

  const url = process.env.REDIS_URL;
  if (!url) return null;

  try {
    // @ts-ignore optional dependency, not installed unless Redis is used
    const mod = (await import("ioredis")) as unknown as {
      default: new (url: string, opts?: unknown) => SharedRedis;
    };
    const Redis = mod.default;
    client = new Redis(url, { maxRetriesPerRequest: 2, lazyConnect: false });
    console.log("[Redis] Shared client connected");
    return client;
  } catch (error) {
    console.error("[Redis] REDIS_URL set but client init failed; Redis features disabled", String(error));
    client = null;
    return null;
  }
}

/** Test-only: reset the memoized client so a fresh getRedis() re-evaluates env. */
export function __resetRedis(): void {
  client = null;
  initialized = false;
}
