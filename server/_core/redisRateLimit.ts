import type { RateLimitResult, RateLimitStore } from "../rateLimit";
import { setRateLimitStore } from "../rateLimit";
import { getRedis, type SharedRedis } from "./redisClient";

/**
 * Optional Redis-backed rate-limit store. Activated only when REDIS_URL is set
 * (via the shared client), so single-instance / dev deployments keep the
 * in-memory store.
 *
 * The sliding window is a per-key sorted set keyed on timestamp (the distributed
 * equivalent of the in-memory timestamp array): drop entries older than the
 * window, count what remains, add the current hit, and expire the key lazily.
 */
function makeRedisStore(redis: SharedRedis): RateLimitStore {
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
  const redis = await getRedis();
  if (!redis) return false;
  setRateLimitStore(makeRedisStore(redis));
  console.log("[RateLimit] Redis store active");
  return true;
}
