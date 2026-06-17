import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * revokeJti / isJtiRevoked go through the shared Redis client (getRedis). We
 * mock that module per case: a fake in-memory Redis to exercise the happy path,
 * null to assert the no-Redis no-op, and a throwing client to assert fail-open.
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

afterEach(() => vi.restoreAllMocks());

describe("session revocation", () => {
  it("denylists a jti and then reports it revoked", async () => {
    const redis = fakeRedis();
    const { revokeJti, isJtiRevoked } = await loadWith(redis);

    expect(await isJtiRevoked("jti-1")).toBe(false);
    expect(await revokeJti("jti-1", 60_000)).toBe(true);
    expect(redis.set).toHaveBeenCalledWith("revoked-jti:jti-1", "1", "PX", 60_000);
    expect(await isJtiRevoked("jti-1")).toBe(true);
  });

  it("is a no-op without Redis (revocation disabled)", async () => {
    const { revokeJti, isJtiRevoked } = await loadWith(null);
    expect(await revokeJti("jti-x", 60_000)).toBe(false);
    expect(await isJtiRevoked("jti-x")).toBe(false);
  });

  it("does not revoke with a non-positive TTL", async () => {
    const redis = fakeRedis();
    const { revokeJti } = await loadWith(redis);
    expect(await revokeJti("jti-2", 0)).toBe(false);
    expect(redis.set).not.toHaveBeenCalled();
  });

  it("fails open: a Redis error during the check allows the session", async () => {
    const throwing = {
      set: vi.fn(),
      exists: vi.fn(async () => {
        throw new Error("redis down");
      }),
    };
    const { isJtiRevoked } = await loadWith(throwing);
    expect(await isJtiRevoked("jti-3")).toBe(false);
  });
});
