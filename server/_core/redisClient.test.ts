import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const redisMock = vi.hoisted(() => ({
  constructor: vi.fn(),
  disconnect: vi.fn(),
  ping: vi.fn(),
}));

vi.mock("ioredis", () => ({ default: redisMock.constructor }));

beforeEach(() => {
  vi.resetModules();
  redisMock.constructor.mockReset();
  redisMock.disconnect.mockReset();
  redisMock.ping.mockReset();
  redisMock.constructor.mockImplementation(function RedisMock() {
    return {
      disconnect: redisMock.disconnect,
      ping: redisMock.ping,
    };
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("shared Redis readiness", () => {
  it("stays disabled without REDIS_URL", async () => {
    vi.stubEnv("REDIS_URL", "");
    const { getRedis, isRedisReady } = await import("./redisClient");

    await expect(getRedis()).resolves.toBeNull();
    await expect(isRedisReady()).resolves.toBe(true);
    expect(redisMock.constructor).not.toHaveBeenCalled();
  });

  it("activates only after a successful PING", async () => {
    vi.stubEnv("REDIS_URL", "redis://example.invalid:6379");
    redisMock.ping.mockResolvedValue("PONG");
    const { getRedis, isRedisReady } = await import("./redisClient");

    await expect(getRedis()).resolves.not.toBeNull();
    expect(redisMock.ping).toHaveBeenCalledOnce();
    await expect(isRedisReady()).resolves.toBe(true);
    expect(redisMock.ping).toHaveBeenCalledTimes(2);
  });

  it("does not expose credentials when the initial PING fails", async () => {
    const secretUrl = "redis://user:secret@example.invalid:6379";
    vi.stubEnv("REDIS_URL", secretUrl);
    redisMock.ping.mockRejectedValue(new Error(`connect failed: ${secretUrl}`));
    const errorLog = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const { getRedis, isRedisReady } = await import("./redisClient");

    await expect(getRedis()).resolves.toBeNull();
    await expect(isRedisReady()).resolves.toBe(false);
    expect(redisMock.disconnect).toHaveBeenCalledOnce();
    expect(errorLog.mock.calls.flat().join(" ")).not.toContain("secret");
  });
});
