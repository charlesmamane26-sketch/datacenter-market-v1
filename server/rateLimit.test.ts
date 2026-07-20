import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  rateLimit,
  enforceRateLimit,
  setRateLimitStore,
  clientIp,
  __resetRateLimit,
  __storeSize,
  type RateLimitStore,
} from "./rateLimit";

beforeEach(() => __resetRateLimit());

describe("rateLimit (sliding window)", () => {
  it("allows up to the limit, then blocks", () => {
    const now = 1_000_000;
    for (let i = 0; i < 3; i++) {
      expect(rateLimit("k", 3, 1000, now).allowed).toBe(true);
    }
    const blocked = rateLimit("k", 3, 1000, now);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it("allows again once the window has slid past old hits", () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 3; i++) rateLimit("k", 3, 1000, t0);
    expect(rateLimit("k", 3, 1000, t0).allowed).toBe(false);
    expect(rateLimit("k", 3, 1000, t0 + 1001).allowed).toBe(true);
  });

  it("sweeps long-expired keys so the store cannot grow unbounded", () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 100; i++) rateLimit(`ip:${i}`, 5, 60_000, t0);
    expect(__storeSize()).toBe(100);
    // Two hours later (sweep interval + max window elapsed), one fresh call
    // triggers the sweep and evicts every stale key.
    const t1 = t0 + 2 * 60 * 60 * 1000;
    rateLimit("ip:new", 5, 60_000, t1);
    expect(__storeSize()).toBe(1);
  });

  it("tracks keys independently", () => {
    const now = 5_000;
    expect(rateLimit("a", 1, 1000, now).allowed).toBe(true);
    expect(rateLimit("a", 1, 1000, now).allowed).toBe(false);
    expect(rateLimit("b", 1, 1000, now).allowed).toBe(true);
  });
});

describe("enforceRateLimit (pluggable store)", () => {
  it("routes through the in-memory store by default", async () => {
    const now = 9_000;
    expect((await enforceRateLimit("k", 1, 1000, now)).allowed).toBe(true);
    expect((await enforceRateLimit("k", 1, 1000, now)).allowed).toBe(false);
  });

  it("delegates to a swapped-in store and forwards all arguments", async () => {
    const calls: Array<[string, number, number]> = [];
    const fakeStore: RateLimitStore = {
      check: (key, limit, windowMs) => {
        calls.push([key, limit, windowMs]);
        return Promise.resolve({ allowed: false, retryAfterMs: 42 });
      },
    };
    setRateLimitStore(fakeStore);

    const result = await enforceRateLimit("lead:1.2.3.4", 5, 60_000, 1_000);
    expect(result).toEqual({ allowed: false, retryAfterMs: 42 });
    expect(calls).toEqual([["lead:1.2.3.4", 5, 60_000]]);
  });

  it("reverts to the in-memory store after __resetRateLimit", async () => {
    setRateLimitStore({
      check: () => Promise.resolve({ allowed: false, retryAfterMs: 1 }),
    });
    __resetRateLimit();
    // Back to the real sliding window: first hit on a fresh key is allowed.
    expect((await enforceRateLimit("fresh", 1, 1000, 1_000)).allowed).toBe(
      true
    );
  });

  it("falls back to the local limiter when the active shared store rejects", async () => {
    const warning = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);
    setRateLimitStore({
      check: () => Promise.reject(new Error("redis unavailable")),
    });

    await expect(
      enforceRateLimit("checkout:7", 10, 60_000, 1_000)
    ).resolves.toEqual({
      allowed: true,
      retryAfterMs: 0,
    });
    expect(warning).toHaveBeenCalledWith(
      "[RateLimit] Store unavailable (Error); using local fallback"
    );
    warning.mockRestore();
  });
});

describe("clientIp", () => {
  it("ignores X-Forwarded-For (spoofable) and uses req.ip", () => {
    // req.ip already accounts for trusted proxies via Express's "trust proxy" setting;
    // reading the header directly would let clients rotate rate-limit keys at will.
    const req = {
      headers: { "x-forwarded-for": "203.0.113.7, 10.0.0.1" },
      ip: "198.51.100.2",
    } as any;
    expect(clientIp(req)).toBe("198.51.100.2");
  });

  it("falls back to the socket address when req.ip is unset", () => {
    const req = { headers: {}, socket: { remoteAddress: "192.0.2.9" } } as any;
    expect(clientIp(req)).toBe("192.0.2.9");
  });

  it("returns 'unknown' when no source is available", () => {
    const req = { headers: {} } as any;
    expect(clientIp(req)).toBe("unknown");
  });
});
