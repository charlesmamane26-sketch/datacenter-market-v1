import { describe, expect, it, beforeEach } from "vitest";
import { rateLimit, clientIp, __resetRateLimit } from "./rateLimit";

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

  it("tracks keys independently", () => {
    const now = 5_000;
    expect(rateLimit("a", 1, 1000, now).allowed).toBe(true);
    expect(rateLimit("a", 1, 1000, now).allowed).toBe(false);
    expect(rateLimit("b", 1, 1000, now).allowed).toBe(true);
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
