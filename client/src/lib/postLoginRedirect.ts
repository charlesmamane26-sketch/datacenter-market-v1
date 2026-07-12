/**
 * One-shot flag set right before an explicit login redirect, consumed once the
 * user returns authenticated (see PostLoginRedirect in Home.tsx) to route them to
 * their area by role (admin → /admin, otherwise → /dashboard). Kept in
 * localStorage so it survives the OAuth round-trip (like checkoutIntent). A
 * pending checkout intent takes precedence over this flag.
 *
 * Only an explicit login sets it, so a logged-in user simply browsing the home
 * page is never yanked to a dashboard.
 */

const KEY = "dcm-post-login-role-redirect";

export function markRoleRedirect(): void {
  try {
    localStorage.setItem(KEY, "1");
  } catch {
    // Storage unavailable — post-login lands on "/" instead of the dashboard.
  }
}

/** Returns true if a role redirect was pending, clearing it in the process. */
export function consumeRoleRedirect(): boolean {
  try {
    const v = localStorage.getItem(KEY);
    if (v) localStorage.removeItem(KEY);
    return v === "1";
  } catch {
    return false;
  }
}
