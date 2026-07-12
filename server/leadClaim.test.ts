import { describe, expect, it } from "vitest";
import { signLeadClaim, verifyLeadClaim } from "./leadClaim";

describe("lead claim token", () => {
  it("verifies a token it issued for the same lead", () => {
    const token = signLeadClaim(42);
    expect(verifyLeadClaim(42, token)).toBe(true);
  });

  it("rejects a token issued for a different lead", () => {
    const token = signLeadClaim(42);
    expect(verifyLeadClaim(43, token)).toBe(false);
  });

  it("rejects a missing, empty, or malformed token", () => {
    expect(verifyLeadClaim(42, undefined)).toBe(false);
    expect(verifyLeadClaim(42, null)).toBe(false);
    expect(verifyLeadClaim(42, "")).toBe(false);
    expect(verifyLeadClaim(42, "not-a-real-token")).toBe(false);
  });

  it("is deterministic for a given lead id", () => {
    expect(signLeadClaim(7)).toBe(signLeadClaim(7));
    expect(signLeadClaim(7)).not.toBe(signLeadClaim(8));
  });
});
