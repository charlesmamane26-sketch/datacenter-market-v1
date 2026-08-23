import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * revokeJti / isJtiRevoked go through the shared Redis client (getRedis). We
 * mock that module per case: a fake in-memory Redis to exercise the happy path,
 * null to assert the local fallback, and a throwing client to assert the
 * production fail-closed policy.
 */
function fakeRedis() {
  const map = new Map<string, string>();
  return {
    map,
    set: vi.fn(async (key: string, value: string) => {
      map.set(key, value);
      return "OK";
    }),
    exists: vi.fn(async (key: string) => (map.has(key) ? 1 : 0)),
  };
}

async function loadWith(redis: unknown) {
  vi.resetModules();
  vi.doMock("./_core/redisClient", () => ({
    getRedis: async () => redis,
    __resetRedis: () => {},
  }));
  return import("./_core/sessionRevocation");
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("session revocation", () => {
  it("denylists a jti and then reports it revoked", async () => {
    const redis = fakeRedis();
    const { revokeJti, isJtiRevoked } = await loadWith(redis);

    expect(await isJtiRevoked("jti-1")).toBe(false);
    expect(await revokeJti("jti-1", 60_000)).toBe(true);
    expect(redis.set).toHaveBeenCalledWith(
      "revoked-jti:jti-1",
      "1",
      "PX",
      60_000
    );
    expect(await isJtiRevoked("jti-1")).toBe(true);
  });

  it("uses a process-local denylist without Redis", async () => {
    const { revokeJti, isJtiRevoked } = await loadWith(null);
    expect(await revokeJti("jti-x", 60_000)).toBe(true);
    expect(await isJtiRevoked("jti-x")).toBe(true);
  });

  it("does not revoke with a non-positive TTL", async () => {
    const redis = fakeRedis();
    const { revokeJti } = await loadWith(redis);
    expect(await revokeJti("jti-2", 0)).toBe(false);
    expect(redis.set).not.toHaveBeenCalled();
  });

  it("fails closed on a configured production Redis error", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("REDIS_URL", "redis://configured.invalid");
    const throwing = {
      set: vi.fn(),
      exists: vi.fn(async () => {
        throw new Error("redis down");
      }),
    };
    const { isJtiRevoked } = await loadWith(throwing);
    expect(await isJtiRevoked("jti-3")).toBe(true);
  });

  it("keeps development available on a Redis check error", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("REDIS_URL", "redis://configured.invalid");
    const throwing = {
      set: vi.fn(),
      exists: vi.fn(async () => {
        throw new Error("redis down");
      }),
    };
    const { isJtiRevoked } = await loadWith(throwing);
    expect(await isJtiRevoked("jti-dev")).toBe(false);
  });
});
