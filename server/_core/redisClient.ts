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
  zrange(
    key: string,
    start: number,
    stop: number,
    withScores: "WITHSCORES"
  ): Promise<string[]>;
  set(key: string, value: string, mode: "PX", ttlMs: number): Promise<unknown>;
  exists(key: string): Promise<number>;
  ping(): Promise<string>;
  disconnect?(): void;
}

let client: SharedRedis | null = null;
let initialization: Promise<SharedRedis | null> | null = null;
let lastInitializationFailureAt = 0;
const REDIS_RETRY_COOLDOWN_MS = 5_000;
const REDIS_PING_TIMEOUT_MS = 2_000;

function redisErrorType(error: unknown): string {
  return error instanceof Error ? error.name : "UnknownError";
}

async function pingWithTimeout(redis: SharedRedis): Promise<string> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      redis.ping(),
      new Promise<never>((_resolve, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error("Redis PING timed out")),
          REDIS_PING_TIMEOUT_MS
        );
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

async function initializeRedis(url: string): Promise<SharedRedis | null> {
  let candidate: SharedRedis | null = null;
  try {
    // @ts-ignore optional dependency, not installed unless Redis is used
    const mod = (await import("ioredis")) as unknown as {
      default: new (url: string, opts?: unknown) => SharedRedis;
    };
    const Redis = mod.default;
    candidate = new Redis(url, {
      connectTimeout: 5_000,
      maxRetriesPerRequest: 2,
      lazyConnect: false,
    });

    // Constructing an ioredis client starts the connection but does not prove it
    // is usable. Do not activate Redis-backed features before a real round trip.
    const pong = await pingWithTimeout(candidate);
    if (pong !== "PONG") throw new Error("Unexpected Redis PING response");

    client = candidate;
    console.log("[Redis] Shared client ready");
    return client;
  } catch (error) {
    candidate?.disconnect?.();
    console.error(
      `[Redis] Initialization failed (${redisErrorType(error)}); Redis features disabled`
    );
    client = null;
    return null;
  }
}

/**
 * Returns the shared Redis client, or null if REDIS_URL is unset or the client
 * could not be created. Failed initialization is retried after a short cooldown
 * so a transient Redis outage does not require a process restart to recover.
 */
export async function getRedis(): Promise<SharedRedis | null> {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  if (client) return client;
  if (initialization) return initialization;
  if (Date.now() - lastInitializationFailureAt < REDIS_RETRY_COOLDOWN_MS)
    return null;

  initialization = initializeRedis(url);
  try {
    const result = await initialization;
    if (!result) lastInitializationFailureAt = Date.now();
    return result;
  } finally {
    initialization = null;
  }
}

/** A configured Redis dependency is ready only after a fresh successful PING. */
export async function isRedisReady(): Promise<boolean> {
  if (!process.env.REDIS_URL) return true;
  const redis = await getRedis();
  if (!redis) return false;
  try {
    return (await pingWithTimeout(redis)) === "PONG";
  } catch {
    redis.disconnect?.();
    if (client === redis) client = null;
    lastInitializationFailureAt = Date.now();
    return false;
  }
}

/** Close the shared connection during graceful process shutdown. */
export async function closeRedis(): Promise<void> {
  client?.disconnect?.();
  client = null;
  initialization = null;
  lastInitializationFailureAt = 0;
}

/** Test-only: reset the memoized client so a fresh getRedis() re-evaluates env. */
export function __resetRedis(): void {
  client?.disconnect?.();
  client = null;
  initialization = null;
  lastInitializationFailureAt = 0;
}
