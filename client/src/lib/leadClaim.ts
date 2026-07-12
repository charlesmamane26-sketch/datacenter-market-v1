/**
 * Capability token proving this browser created a given anonymous lead. Issued
 * by leads.create and required to order against — or match — that lead, so a
 * lead ID alone can't be used to hijack it or read its criteria (see
 * server/leadClaim.ts). Kept in localStorage so it survives the OAuth login
 * redirect (like checkoutIntent) and is never placed in the URL.
 */

const PREFIX = "dcm-lead-claim:";

export function saveLeadClaim(leadId: number, token: string): void {
  try {
    localStorage.setItem(PREFIX + leadId, token);
  } catch {
    // Storage unavailable (private mode / quota) — checkout will fail closed and
    // prompt the user to restart the request rather than proceed unauthorized.
  }
}

export function loadLeadClaim(leadId: number): string | undefined {
  try {
    return localStorage.getItem(PREFIX + leadId) ?? undefined;
  } catch {
    return undefined;
  }
}
