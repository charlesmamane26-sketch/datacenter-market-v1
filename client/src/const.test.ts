import { afterEach, describe, expect, it, vi } from "vitest";
import { getLoginUrl, isOAuthConfigured } from "./const";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("OAuth client configuration", () => {
  it("fails closed when the portal URL is missing", () => {
    vi.stubEnv("VITE_OAUTH_PORTAL_URL", "");
    vi.stubEnv("VITE_APP_ID", "app-123");

    expect(isOAuthConfigured()).toBe(false);
    expect(getLoginUrl()).toBeNull();
  });

  it("fails closed when the application id is missing or blank", () => {
    vi.stubEnv("VITE_OAUTH_PORTAL_URL", "https://login.example.com");
    vi.stubEnv("VITE_APP_ID", "   ");

    expect(isOAuthConfigured()).toBe(false);
    expect(getLoginUrl()).toBeNull();
  });

  it("fails closed when the portal URL is invalid", () => {
    vi.stubEnv("VITE_OAUTH_PORTAL_URL", "javascript:alert(1)");
    vi.stubEnv("VITE_APP_ID", "app-123");

    expect(isOAuthConfigured()).toBe(false);
    expect(getLoginUrl()).toBeNull();
  });

  it("builds a signed-in provider URL only after configuration is valid", () => {
    vi.stubEnv("VITE_OAUTH_PORTAL_URL", " https://login.example.com/ ");
    vi.stubEnv("VITE_APP_ID", " app-123 ");

    const cookieWrites: string[] = [];
    vi.stubGlobal("window", {
      location: {
        origin: "https://app.example.com",
        protocol: "https:",
      },
    });
    vi.stubGlobal("document", {
      set cookie(value: string) {
        cookieWrites.push(value);
      },
    });
    vi.stubGlobal("crypto", {
      getRandomValues(bytes: Uint8Array) {
        bytes.fill(7);
        return bytes;
      },
    });
    vi.stubGlobal("btoa", (value: string) => Buffer.from(value, "utf8").toString("base64"));

    const loginUrl = getLoginUrl("google");
    expect(loginUrl).not.toBeNull();

    const url = new URL(loginUrl!);
    expect(url.origin).toBe("https://login.example.com");
    expect(url.pathname).toBe("/app-auth");
    expect(url.searchParams.get("appId")).toBe("app-123");
    expect(url.searchParams.get("redirectUri")).toBe(
      "https://app.example.com/api/oauth/callback",
    );
    expect(url.searchParams.get("provider")).toBe("google");
    expect(url.searchParams.get("type")).toBe("signIn");

    const state = JSON.parse(
      Buffer.from(url.searchParams.get("state")!, "base64").toString("utf8"),
    ) as { n: string; r: string };
    expect(state.r).toBe("https://app.example.com/api/oauth/callback");
    expect(state.n).toHaveLength(32);
    expect(cookieWrites).toHaveLength(1);
    expect(cookieWrites[0]).toContain(`${state.n};`);
    expect(cookieWrites[0]).toContain("SameSite=Lax; Secure");
  });
});
