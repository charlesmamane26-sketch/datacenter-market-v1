import { randomUUID } from "crypto";
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
      // Member must be unique per hit: `now` alone (or anything derived from it,
      // like now%1000) collides for same-millisecond hits, and ZADD would then
      // update the score instead of inserting, so ZCARD undercounts and the limit
      // can be bypassed under bursts. Use a random suffix; `now` stays the score
      // that drives the sliding window.
      const member = `${now}-${randomUUID()}`;

      const results = await redis
        .multi()
        .zremrangebyscore(redisKey, 0, cutoff)
        .zadd(redisKey, now, member)
        .zcard(redisKey)
        .pexpire(redisKey, windowMs)
        .exec();

      // Surface pipeline and per-command failures to enforceRateLimit(), whose
      // central availability policy is a deliberate fail-open decision.
      if (!results)
        throw new Error("Redis rate-limit pipeline returned no result");
      const commandError = results.find(([error]) => error != null)?.[0];
      if (commandError) throw commandError;

      // ZCARD is the 3rd command (index 2).
      const count = Number(results[2]?.[1]);
      if (!Number.isFinite(count))
        throw new Error("Invalid Redis rate-limit count");
      if (count <= limit) {
        return { allowed: true, retryAfterMs: 0 };
      }

      // Over the limit: retry once the oldest in-window hit ages out.
      const oldest = await redis.zrange(redisKey, 0, 0, "WITHSCORES");
      const oldestTs = oldest.length >= 2 ? Number(oldest[1]) : now;
      return {
        allowed: false,
        retryAfterMs: Math.max(0, oldestTs + windowMs - now),
      };
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
