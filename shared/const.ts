export const COOKIE_NAME = "app_session_id";
// Short-lived cookie holding the OAuth CSRF nonce. The same nonce is embedded in
// the OAuth `state`; the callback accepts the login only if the two match
// (double-submit), binding the callback to the browser that started the flow.
export const OAUTH_NONCE_COOKIE = "oauth_nonce";
export const OAUTH_NONCE_TTL_MS = 1000 * 60 * 10; // 10 minutes
export const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;
// Session lifetime. Kept short because there is no server-side revocation:
// a stolen JWT stays valid until it expires (logout only clears the cookie).
export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;
export const AXIOS_TIMEOUT_MS = 30_000;
export const UNAUTHED_ERR_MSG = 'Please login (10001)';
export const NOT_ADMIN_ERR_MSG = 'You do not have required permission (10002)';
