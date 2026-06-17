import { OAUTH_NONCE_COOKIE, OAUTH_NONCE_TTL_MS } from "@shared/const";

export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

/** Cryptographically-random URL-safe nonce for the OAuth double-submit check. */
const generateNonce = (): string => {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
};

// Generate login URL at runtime so redirect URI reflects the current origin.
export const getLoginUrl = () => {
  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
  const appId = import.meta.env.VITE_APP_ID;
  const redirectUri = `${window.location.origin}/api/oauth/callback`;

  // CSRF protection: a random nonce is stored in a cookie *and* embedded in the
  // state. The callback only proceeds if the two match, so a forged callback
  // (the state is otherwise public) cannot complete a login in the victim's
  // browser. Lax SameSite lets the cookie ride along the top-level callback.
  const nonce = generateNonce();
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie =
    `${OAUTH_NONCE_COOKIE}=${nonce}; Path=/; Max-Age=${Math.floor(OAUTH_NONCE_TTL_MS / 1000)}` +
    `; SameSite=Lax${secure}`;

  const state = btoa(JSON.stringify({ r: redirectUri, n: nonce }));

  if (!oauthPortalUrl) return "/";

  const url = new URL(`${oauthPortalUrl}/app-auth`);
  url.searchParams.set("appId", appId ?? "");
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("type", "signIn");

  return url.toString();
};
