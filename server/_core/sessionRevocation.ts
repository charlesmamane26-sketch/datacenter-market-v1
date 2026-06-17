import { getRedis } from "./redisClient";

/**
 * Server-side session revocation (logout that actually invalidates a stolen
 * JWT). Each session token carries a unique `jti`; logout adds that jti to a
 * Redis denylist with a TTL equal to the token's remaining lifetime, so the
 * entry self-expires exactly when the token would have expired anyway.
 *
 * Without REDIS_URL there is no shared store, so revocation is a no-op and the
 * prior behavior (logout only clears the cookie) stands. This is logged once at
 * call sites that care, and is an accepted degradation for single-instance dev.
 */
const KEY_PREFIX = "revoked-jti:";

/** Denylist a jti until `ttlMs` from now. No-op (returns false) without Redis. */
export async function revokeJti(jti: string, ttlMs: number): Promise<boolean> {
  if (!jti || ttlMs <= 0) return false;
  const redis = await getRedis();
  if (!redis) return false;
  try {
    await redis.set(`${KEY_PREFIX}${jti}`, "1", "PX", Math.ceil(ttlMs));
    return true;
  } catch (error) {
    console.error("[Auth] Failed to revoke session jti", String(error));
    return false;
  }
}

/**
 * True if the jti has been revoked. Fails OPEN (returns false) on a Redis error:
 * an auth-store hiccup should not lock out every valid session. The token still
 * had to pass signature + expiry + audience checks to reach this point.
 */
export async function isJtiRevoked(jti: string | undefined): Promise<boolean> {
  if (!jti) return false;
  const redis = await getRedis();
  if (!redis) return false;
  try {
    const exists = await redis.exists(`${KEY_PREFIX}${jti}`);
    return exists > 0;
  } catch (error) {
    console.error("[Auth] Revocation check failed; allowing session", String(error));
    return false;
  }
}
