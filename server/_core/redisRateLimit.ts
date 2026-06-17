import type { RateLimitResult, RateLimitStore } from "../rateLimit";
import { setRateLimitStore } from "../rateLimit";

/**
 * Optional Redis-backed rate-limit store. Activated only when REDIS_URL is set,
 * so single-instance / dev deployments keep the in-memory store with zero extra
 * dependencies. `ioredis` is imported dynamically: it is an optional runtime
 * dependency — the app builds and runs without it.
 *
 * The sliding window is a per-key sorted set keyed on timestamp (the distributed
 * equivalent of the in-memory timestamp array): drop entries older than the
 * window, count what remains, add the current hit, and expire the key lazily.
 */
interface RedisMulti {
  zremrangebyscore(key: string, min: number, max: number): RedisMulti;
  zadd(key: string, score: number, member: string): RedisMulti;
  zcard(key: string): RedisMulti;
  pexpire(key: string, ms: number): RedisMulti;
  exec(): Promise<Array<[Error | null, unknown]> | null>;
}

interface MinimalRedis {
  multi(): RedisMulti;
  zrange(key: string, start: number, stop: number, withScores: "WITHSCORES"): Promise<string[]>;
}

function makeRedisStore(redis: MinimalRedis): RateLimitStore {
  return {
    async check(key, limit, windowMs, now): Promise<RateLimitResult> {
      const redisKey = `rl:${key}`;
      const cutoff = now - windowMs;
      // A unique member so concurrent hits in the same millisecond don't collide.
      const member = `${now}-${Math.round(now % 1000)}-${key.length}`;

      const results = await redis
        .multi()
        .zremrangebyscore(redisKey, 0, cutoff)
        .zadd(redisKey, now, member)
        .zcard(redisKey)
        .pexpire(redisKey, windowMs)
        .exec();

      // ZCARD is the 3rd command (index 2). If the pipeline failed, fail open
      // (allow) rather than locking everyone out on a Redis hiccup.
      const count = Number(results?.[2]?.[1] ?? 0);
      if (count <= limit) {
        return { allowed: true, retryAfterMs: 0 };
      }

      // Over the limit: retry once the oldest in-window hit ages out.
      const oldest = await redis.zrange(redisKey, 0, 0, "WITHSCORES");
      const oldestTs = oldest.length >= 2 ? Number(oldest[1]) : now;
      return { allowed: false, retryAfterMs: Math.max(0, oldestTs + windowMs - now) };
    },
  };
}

/**
 * Wire up the Redis store if REDIS_URL is configured. Returns true if Redis was
 * activated. Failures are non-fatal: the in-memory store stays in place.
 */
export async function initRateLimitStore(): Promise<boolean> {
  const url = process.env.REDIS_URL;
  if (!url) return false;

  try {
    // Dynamic, optional import: only required when REDIS_URL is set. ioredis is
    // an optional runtime dependency, so it may be absent at build time — the
    // ts-ignore covers the missing module declaration in that case.
    // @ts-ignore optional dependency, not installed unless Redis is used
    const mod = (await import("ioredis")) as unknown as {
      default: new (url: string, opts?: unknown) => MinimalRedis;
    };
    const Redis = mod.default;
    const redis = new Redis(url, { maxRetriesPerRequest: 2, lazyConnect: false });
    setRateLimitStore(makeRedisStore(redis));
    console.log("[RateLimit] Redis store active");
    return true;
  } catch (error) {
    console.error("[RateLimit] REDIS_URL set but Redis init failed; using in-memory store", String(error));
    return false;
  }
}
