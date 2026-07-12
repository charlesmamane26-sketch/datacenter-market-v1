import { createHmac, timingSafeEqual } from "crypto";
import { ENV } from "./_core/env";

/**
 * Stateless capability token binding an anonymous lead to the browser that
 * created it.
 *
 * A lead is created before login (userId null) and claimed later at checkout.
 * Without a secret bound to creation, any authenticated user could claim an
 * arbitrary anonymous lead by ID — hijacking it and (via leads.get once owned)
 * harvesting its PII. leads.create issues this token to the creator; ordering
 * against — or reading the matched criteria of — an anonymous lead requires
 * presenting it back. It is an HMAC over the lead id, so it needs no storage and
 * can't be forged without the server secret.
 *
 * Secret: JWT_SECRET (ENV.cookieSecret), which production enforces at >=32 chars
 * on boot. In dev/tests it may be empty; a fixed fallback keeps the funnel usable
 * locally (the token has no value without a real deployment).
 */
const SECRET = ENV.cookieSecret || "dev-insecure-lead-claim-secret";

export function signLeadClaim(leadId: number): string {
  return createHmac("sha256", SECRET).update(`lead:${leadId}`).digest("base64url");
}

/** Constant-time verification. Returns false for a missing/empty/wrong token. */
export function verifyLeadClaim(leadId: number, token: string | null | undefined): boolean {
  if (typeof token !== "string" || token.length === 0) return false;
  const provided = Buffer.from(token);
  const expected = Buffer.from(signLeadClaim(leadId));
  // timingSafeEqual throws on length mismatch — guard it (a wrong-length token is
  // already a non-match) but still compare equal-length inputs in constant time.
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(provided, expected);
}
