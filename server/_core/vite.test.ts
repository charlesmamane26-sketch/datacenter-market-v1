import { describe, expect, it } from "vitest";
import { getSpaFallbackPolicy } from "./vite";

describe("SPA fallback policy", () => {
  it("serves declared public and parameterized application routes", () => {
    expect(getSpaFallbackPolicy("/terms")).toEqual({
      known: true,
      status: 200,
      noindex: false,
    });
    expect(getSpaFallbackPolicy("/offer-detail/42")).toEqual({
      known: true,
      status: 200,
      noindex: true,
    });
  });

  it("returns a hard noindex 404 for unknown paths", () => {
    expect(getSpaFallbackPolicy("/definitely-missing")).toEqual({
      known: false,
      status: 404,
      noindex: true,
    });
    expect(getSpaFallbackPolicy("/404")).toEqual({
      known: true,
      status: 404,
      noindex: true,
    });
  });
});
