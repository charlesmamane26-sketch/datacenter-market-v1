import { beforeEach, describe, expect, it, vi } from "vitest";
import { OAUTH_NONCE_COOKIE, SESSION_TTL_MS } from "@shared/const";

const mocks = vi.hoisted(() => ({
  createSessionToken: vi.fn(),
  enforceRateLimit: vi.fn(),
  exchangeCodeForToken: vi.fn(),
  getOrigin: vi.fn(),
  getUserInfo: vi.fn(),
  upsertUser: vi.fn(),
}));

vi.mock("./db", () => ({ upsertUser: mocks.upsertUser }));
vi.mock("./stripe", () => ({ getOrigin: mocks.getOrigin }));
vi.mock("./rateLimit", () => ({
  clientIp: () => "192.0.2.1",
  enforceRateLimit: mocks.enforceRateLimit,
}));
vi.mock("./_core/sdk", () => ({
  sdk: {
    createSessionToken: mocks.createSessionToken,
    exchangeCodeForToken: mocks.exchangeCodeForToken,
    getUserInfo: mocks.getUserInfo,
  },
}));

import { registerOAuthRoutes } from "./_core/oauth";

function getHandler() {
  let handler: any;
  registerOAuthRoutes({
    get: (_path: string, value: any) => (handler = value),
  } as any);
  return handler;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.enforceRateLimit.mockResolvedValue({ allowed: true, retryAfterMs: 0 });
  mocks.getOrigin.mockReturnValue("https://app.example.com");
  mocks.exchangeCodeForToken.mockResolvedValue({ accessToken: "access-token" });
  mocks.createSessionToken.mockResolvedValue("session-token");
});

describe("OAuth callback", () => {
  it("accepts a valid user without a display name", async () => {
    mocks.getUserInfo.mockResolvedValue({
      email: "user@example.com",
      loginMethod: "oauth",
      name: undefined,
      openId: "openid-1",
    });
    const nonce = "nonce-123";
    const state = Buffer.from(
      JSON.stringify({
        r: "https://app.example.com/api/oauth/callback",
        n: nonce,
      })
    ).toString("base64");
    const req = {
      headers: { cookie: `${OAUTH_NONCE_COOKIE}=${nonce}` },
      protocol: "https",
      query: { code: "code-123", state },
    } as any;
    const res: any = {
      clearCookie: vi.fn(),
      cookie: vi.fn(),
      json: vi.fn(),
      redirect: vi.fn(),
      status: vi.fn(function status() {
        return res;
      }),
    };
    const next = vi.fn();

    await getHandler()(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(mocks.upsertUser).toHaveBeenCalledWith(
      expect.objectContaining({
        name: null,
        openId: "openid-1",
      })
    );
    expect(mocks.createSessionToken).toHaveBeenCalledWith("openid-1", {
      expiresInMs: SESSION_TTL_MS,
      name: "Utilisateur",
    });
    expect(res.redirect).toHaveBeenCalledWith(302, "/");
  });
});
