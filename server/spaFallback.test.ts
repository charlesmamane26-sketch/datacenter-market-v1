import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SEO_ROUTES, matchRouteSeo } from "../shared/seo";

/**
 * The production SPA fallback (serveStatic in _core/vite.ts) answers 200 only for
 * paths matchRouteSeo() recognises, and 404 for everything else. That turns
 * SEO_ROUTES into a load-bearing route table: a page added to App.tsx but not to
 * SEO_ROUTES would still render client-side, yet be served with a 404 status —
 * invisible in manual testing, fatal for indexing. These tests pin both sides.
 */

const APP_TSX = path.resolve(import.meta.dirname, "..", "client", "src", "App.tsx");

/** Route patterns declared in App.tsx, e.g. `<Route path={"/en"} …>`. */
function declaredRoutePatterns(): string[] {
  const source = fs.readFileSync(APP_TSX, "utf-8");
  return Array.from(source.matchAll(/<Route\s+path=\{"([^"]+)"\}/g), m => m[1]);
}

describe("SPA fallback route table", () => {
  it("covers every route declared in App.tsx", () => {
    const declared = declaredRoutePatterns();
    // Guards against the regex silently matching nothing after a refactor.
    expect(declared.length).toBeGreaterThan(20);

    const missing = declared.filter(pattern => {
      // Wouter params (":offerId") need a concrete value to be matched.
      const concrete = pattern.replace(/:[^/]+/g, "1");
      return matchRouteSeo(concrete) == null;
    });
    expect(missing).toEqual([]);
  });

  it("does not recognise unknown URLs", () => {
    for (const pathname of [
      "/route-inexistante",
      "/gpu-as-a-service/inexistant",
      "/en/nope",
      "/wp-admin",
      "/offer-detail/1/extra",
    ]) {
      expect(matchRouteSeo(pathname)).toBeUndefined();
    }
  });

  it("recognises the prerendered directory form with a trailing slash", () => {
    for (const route of SEO_ROUTES.filter(r => r.indexable)) {
      expect(matchRouteSeo(route.canonicalPath)).toBeDefined();
    }
  });
});
