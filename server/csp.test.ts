import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * buildCspDirectives reads ENV.isProduction (derived from NODE_ENV) and
 * CSP_EXTRA_ORIGINS at call time. We re-import the module under a stubbed env
 * per case so the production/dev branches are both covered.
 */
async function load(env: { NODE_ENV?: string; CSP_EXTRA_ORIGINS?: string }) {
  vi.resetModules();
  if (env.NODE_ENV !== undefined) vi.stubEnv("NODE_ENV", env.NODE_ENV);
  if (env.CSP_EXTRA_ORIGINS !== undefined)
    vi.stubEnv("CSP_EXTRA_ORIGINS", env.CSP_EXTRA_ORIGINS);
  const mod = await import("./_core/csp");
  return mod.buildCspDirectives();
}

afterEach(() => vi.unstubAllEnvs());

describe("buildCspDirectives", () => {
  it("never allows 'unsafe-inline' or 'unsafe-eval' in script-src in production", async () => {
    const d = await load({ NODE_ENV: "production" });
    expect(d.scriptSrc).not.toContain("'unsafe-inline'");
    expect(d.scriptSrc).not.toContain("'unsafe-eval'");
    expect(d.scriptSrc).toContain("'self'");
  });

  it("loosens script-src and connect-src for Vite HMR in development", async () => {
    const d = await load({ NODE_ENV: "development" });
    expect(d.scriptSrc).toContain("'unsafe-inline'");
    expect(d.scriptSrc).toContain("'unsafe-eval'");
    expect(d.connectSrc).toContain("ws:");
  });

  it("injects CSP_EXTRA_ORIGINS into script-src, connect-src and form-action", async () => {
    const d = await load({
      NODE_ENV: "production",
      CSP_EXTRA_ORIGINS: "https://analytics.example.com https://portal.example.com",
    });
    for (const dir of [d.scriptSrc, d.connectSrc, d.formAction]) {
      expect(dir).toContain("https://analytics.example.com");
      expect(dir).toContain("https://portal.example.com");
    }
  });

  it("keeps object-src and frame-ancestors locked down", async () => {
    const d = await load({ NODE_ENV: "production" });
    expect(d.objectSrc).toEqual(["'none'"]);
    expect(d.frameAncestors).toEqual(["'none'"]);
  });
});
