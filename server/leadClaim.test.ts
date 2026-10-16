import { describe, expect, it } from "vitest";
import {
  LEAD_CLAIM_TTL_SECONDS,
  signLeadClaim,
  verifyLeadClaim,
} from "./leadClaim";

const NOW = Date.UTC(2026, 7, 6, 12);

describe("lead claim token", () => {
  it("verifies a token it issued for the same lead", () => {
    const token = signLeadClaim(42, NOW);
    expect(verifyLeadClaim(42, token, NOW)).toBe(true);
  });

  it("rejects a token issued for a different lead", () => {
    const token = signLeadClaim(42, NOW);
    expect(verifyLeadClaim(43, token, NOW)).toBe(false);
  });

  it("rejects a missing, empty, or malformed token", () => {
    expect(verifyLeadClaim(42, undefined)).toBe(false);
    expect(verifyLeadClaim(42, null)).toBe(false);
    expect(verifyLeadClaim(42, "")).toBe(false);
    expect(verifyLeadClaim(42, "not-a-real-token")).toBe(false);
  });

  it("uses a nonce so two claims for the same lead differ", () => {
    expect(signLeadClaim(7, NOW)).not.toBe(signLeadClaim(7, NOW));
  });

  it("rejects an expired token", () => {
    const token = signLeadClaim(42, NOW);
    const afterExpiry = NOW + (LEAD_CLAIM_TTL_SECONDS + 61) * 1_000;
    expect(verifyLeadClaim(42, token, afterExpiry)).toBe(false);
  });

  it("rejects changes to the signed expiry or nonce", () => {
    const token = signLeadClaim(42, NOW);
    const parts = token.split(".");
    parts[1] = (Number.parseInt(parts[1], 36) + 60).toString(36);
    expect(verifyLeadClaim(42, parts.join("."), NOW)).toBe(false);

    // Mutate the FIRST nonce character, not the last. The nonce is 16 random
    // bytes in base64url, so its 22nd character carries only two significant
    // bits: it is always one of "A", "Q", "g", "w". Forcing it to "A" left one
    // token in four byte-for-byte identical — a token that then verifies
    // correctly and failed this assertion ~25% of runs. The first character
    // carries a full six bits, so substituting a different one always mutates
    // the nonce.
    const nonceParts = token.split(".");
    const nonce = nonceParts[2];
    nonceParts[2] = `${nonce[0] === "A" ? "B" : "A"}${nonce.slice(1)}`;
    expect(nonceParts[2]).not.toBe(nonce);
    expect(verifyLeadClaim(42, nonceParts.join("."), NOW)).toBe(false);
  });
});
