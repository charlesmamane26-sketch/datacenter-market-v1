import { OAUTH_NONCE_COOKIE, OAUTH_NONCE_TTL_MS } from "@shared/const";

export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

/** Social providers the Manus portal federates (see server/_core/sdk.ts deriveLoginMethod). */
export type OAuthProvider = "google" | "github";

type OAuthConfig = {
  appId: string;
  portalUrl: string;
};

const readOAuthConfig = (): OAuthConfig | null => {
  const portalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL?.trim();
  const appId = import.meta.env.VITE_APP_ID?.trim();

  if (!portalUrl || !appId) return null;

  try {
    const parsed = new URL(portalUrl);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
  } catch {
    return null;
  }

  return { appId, portalUrl };
};

export const isOAuthConfigured = (): boolean => readOAuthConfig() !== null;

/** Cryptographically-random URL-safe nonce for the OAuth double-submit check. */
const generateNonce = (): string => {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
};

// Generate login URL at runtime so redirect URI reflects the current origin.
// `provider` is an optional hint to deep-link straight to Google/GitHub on the
// Manus portal instead of its method picker.
export const getLoginUrl = (provider?: OAuthProvider): string | null => {
  const config = readOAuthConfig();
  if (!config || typeof window === "undefined") return null;

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

  const url = new URL(`${config.portalUrl.replace(/\/+$/, "")}/app-auth`);
  url.searchParams.set("appId", config.appId);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("type", "signIn");
  // Best-effort provider hint. If the Manus portal honors it, the user lands
  // directly on Google/GitHub; if not, it is ignored and the portal shows its
  // normal method picker (where Google/GitHub are already offered). Either way
  // the flow, session and security are unchanged — the provider is otherwise
  // only reported back after login (sdk.deriveLoginMethod).
  if (provider) url.searchParams.set("provider", provider);

  return url.toString();
};
