import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearAllLeadClaims,
  clearLeadClaim,
  loadLeadClaim,
  saveLeadClaim,
} from "./leadClaim";

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const values = new Map(Object.entries(initial));
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: key => values.get(key) ?? null,
    key: index => Array.from(values.keys())[index] ?? null,
    removeItem: key => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("lead claim storage", () => {
  it("stores and removes a single opaque claim without inspecting it", () => {
    vi.stubGlobal("localStorage", memoryStorage());
    const opaqueToken = "v1.opaque.payload-that-the-client-must-not-decode";

    saveLeadClaim(42, opaqueToken);
    expect(loadLeadClaim(42)).toBe(opaqueToken);

    clearLeadClaim(42);
    expect(loadLeadClaim(42)).toBeUndefined();
  });

  it("purges every claim at logout while preserving unrelated storage", () => {
    const storage = memoryStorage({
      "dcm-lead-claim:1": "claim-1",
      "dcm-lead-claim:2": "claim-2",
      "unrelated-preference": "keep",
    });
    vi.stubGlobal("localStorage", storage);

    clearAllLeadClaims();

    expect(storage.getItem("dcm-lead-claim:1")).toBeNull();
    expect(storage.getItem("dcm-lead-claim:2")).toBeNull();
    expect(storage.getItem("unrelated-preference")).toBe("keep");
  });
});
