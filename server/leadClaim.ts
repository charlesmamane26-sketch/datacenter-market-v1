import { createHmac, randomBytes, timingSafeEqual } from "crypto";
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
 * presenting it back. The token contains a random nonce and a signed expiry, so
 * it cannot be forged without the server secret and a leaked token has a bounded
 * lifetime.
 *
 * Secret: JWT_SECRET (ENV.cookieSecret), which production enforces at >=32 chars
 * on boot. In dev/tests it may be empty; a fixed fallback keeps the funnel usable
 * locally (the token has no value without a real deployment).
 */
const SECRET = ENV.cookieSecret || "dev-insecure-lead-claim-secret";
const VERSION = "v1";
const CLOCK_SKEW_SECONDS = 60;
export const LEAD_CLAIM_TTL_SECONDS = 2 * 60 * 60;

function signature(leadId: number, payload: string): string {
  return createHmac("sha256", SECRET)
    .update(`lead:${leadId}:${payload}`)
    .digest("base64url");
}

export function signLeadClaim(leadId: number, nowMs = Date.now()): string {
  const expiresAt = Math.floor(nowMs / 1_000) + LEAD_CLAIM_TTL_SECONDS;
  const nonce = randomBytes(16).toString("base64url");
  const payload = `${VERSION}.${expiresAt.toString(36)}.${nonce}`;
  return `${payload}.${signature(leadId, payload)}`;
}

/** Constant-time verification. Returns false for a missing/empty/wrong token. */
export function verifyLeadClaim(
  leadId: number,
  token: string | null | undefined,
  nowMs = Date.now()
): boolean {
  if (typeof token !== "string" || token.length === 0 || token.length > 256) {
    return false;
  }

  const [version, expiresAtEncoded, nonce, providedSignature, ...extra] =
    token.split(".");
  if (
    version !== VERSION ||
    !/^[0-9a-z]+$/.test(expiresAtEncoded ?? "") ||
    !/^[A-Za-z0-9_-]{22}$/.test(nonce ?? "") ||
    !/^[A-Za-z0-9_-]{43}$/.test(providedSignature ?? "") ||
    extra.length > 0
  ) {
    return false;
  }

  const expiresAt = Number.parseInt(expiresAtEncoded, 36);
  const now = Math.floor(nowMs / 1_000);
  if (
    !Number.isSafeInteger(expiresAt) ||
    expiresAt < now - CLOCK_SKEW_SECONDS ||
    expiresAt > now + LEAD_CLAIM_TTL_SECONDS + CLOCK_SKEW_SECONDS
  ) {
    return false;
  }

  const payload = `${version}.${expiresAtEncoded}.${nonce}`;
  const provided = Buffer.from(providedSignature);
  const expected = Buffer.from(signature(leadId, payload));
  // timingSafeEqual throws on length mismatch — guard it (a wrong-length token is
  // already a non-match) but still compare equal-length inputs in constant time.
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(provided, expected);
}
