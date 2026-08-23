import { getRedis } from "./redisClient";

/**
 * Server-side session revocation (logout that actually invalidates a stolen
 * JWT). Each session token carries a unique `jti`; logout adds that jti to a
 * Redis denylist with a TTL equal to the token's remaining lifetime, so the
 * entry self-expires exactly when the token would have expired anyway.
 *
 * Without REDIS_URL, a process-local denylist keeps logout effective on a
 * single instance. When Redis is explicitly configured in production, checks
 * fail closed during an outage so a known-revoked token cannot slip through.
 */
const KEY_PREFIX = "revoked-jti:";
const localRevocations = new Map<string, number>();

function revokeLocally(jti: string, ttlMs: number): void {
  localRevocations.set(jti, Date.now() + Math.ceil(ttlMs));
}

function isLocallyRevoked(jti: string): boolean {
  const expiresAt = localRevocations.get(jti);
  if (expiresAt === undefined) return false;
  if (expiresAt <= Date.now()) {
    localRevocations.delete(jti);
    return false;
  }
  return true;
}

function mustFailClosed(): boolean {
  return (
    process.env.NODE_ENV === "production" && Boolean(process.env.REDIS_URL)
  );
}

/** Denylist a jti until `ttlMs` from now, locally and in Redis when configured. */
export async function revokeJti(jti: string, ttlMs: number): Promise<boolean> {
  if (!jti || ttlMs <= 0) return false;
  revokeLocally(jti, ttlMs);
  const redis = await getRedis();
  if (!redis) return !process.env.REDIS_URL;
  try {
    await redis.set(`${KEY_PREFIX}${jti}`, "1", "PX", Math.ceil(ttlMs));
    return true;
  } catch (error) {
    console.error("[Auth] Failed to revoke session jti", String(error));
    return false;
  }
}

/**
 * True if the jti has been revoked. A configured production Redis dependency
 * fails closed; development remains available and logs the degraded check.
 */
export async function isJtiRevoked(jti: string | undefined): Promise<boolean> {
  if (!jti) return false;
  if (isLocallyRevoked(jti)) return true;
  const redis = await getRedis();
  if (!redis) return mustFailClosed();
  try {
    const exists = await redis.exists(`${KEY_PREFIX}${jti}`);
    return exists > 0;
  } catch (error) {
    const failClosed = mustFailClosed();
    console.error(
      `[Auth] Revocation check failed; ${failClosed ? "rejecting" : "allowing"} session`,
      String(error)
    );
    return failClosed;
  }
}

/** Test-only visibility/reset for the process-local fallback. */
export function __resetLocalRevocations(): void {
  localRevocations.clear();
}
