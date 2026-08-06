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

export function clearLeadClaim(leadId: number): void {
  try {
    localStorage.removeItem(PREFIX + leadId);
  } catch {
    // Ignore storage errors: the server-side token still expires independently.
  }
}

/** Remove every opaque lead capability stored by this browser. */
export function clearAllLeadClaims(): void {
  try {
    const keys: string[] = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key?.startsWith(PREFIX)) keys.push(key);
    }
    keys.forEach(key => localStorage.removeItem(key));
  } catch {
    // Ignore storage errors. Tokens are opaque and expire server-side.
  }
}
