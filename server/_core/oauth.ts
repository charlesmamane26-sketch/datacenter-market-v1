import { COOKIE_NAME, OAUTH_NONCE_COOKIE, SESSION_TTL_MS } from "@shared/const";
import { parse as parseCookieHeader } from "cookie";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getOrigin } from "../stripe";
import { getSessionCookieOptions } from "./cookies";
import { enforceRateLimit, clientIp } from "../rateLimit";
import { asyncHandler } from "./asyncHandler";
import { sdk } from "./sdk";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

function optionalDisplayName(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function safeErrorType(error: unknown): string {
  const name = error instanceof Error ? error.name : "UnknownError";
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "string" && /^[A-Z0-9_-]{1,64}$/i.test(code)
    ? `${name}/${code}`
    : name;
}

/** Decoded OAuth state: redirect URI plus the CSRF nonce (legacy: no nonce). */
export function parseState(
  state: string
): { redirectUri: string; nonce?: string } | null {
  try {
    const decoded = atob(state);
    try {
      const parsed = JSON.parse(decoded) as { r?: unknown; n?: unknown };
      if (parsed && typeof parsed.r === "string") {
        return {
          redirectUri: parsed.r,
          nonce: typeof parsed.n === "string" ? parsed.n : undefined,
        };
      }
    } catch {
      // Not JSON — legacy bare redirect URI.
    }
    return { redirectUri: decoded };
  } catch {
    return null;
  }
}

/**
 * The state carries the redirect URI that will be sent back to the OAuth server
 * during the code exchange. Accept it only if it points at *this* deployment: a
 * forged state pointing elsewhere would hand the token exchange an
 * attacker-controlled redirect URI.
 */
function isValidRedirect(redirectUri: string, req: Request): boolean {
  try {
    const url = new URL(redirectUri);
    const expectedOrigin = getOrigin(req);
    return (
      expectedOrigin != null &&
      expectedOrigin.length > 0 &&
      url.origin === expectedOrigin
    );
  } catch {
    return false;
  }
}

export function registerOAuthRoutes(app: Express) {
  app.get(
    "/api/oauth/callback",
    asyncHandler(async (req: Request, res: Response) => {
      try {
        // Anti-abuse: throttle the code exchange per client IP (20 / minute) to
        // blunt brute-forcing of the authorization code and callback spam.
        const limit = await enforceRateLimit(
          `oauth:${clientIp(req)}`,
          20,
          60_000
        );
        if (!limit.allowed) {
          res.status(429).json({ error: "too many requests" });
          return;
        }

        const code = getQueryParam(req, "code");
        const state = getQueryParam(req, "state");

        if (!code || !state) {
          res.status(400).json({ error: "code and state are required" });
          return;
        }

        const parsed = parseState(state);
        if (!parsed || !isValidRedirect(parsed.redirectUri, req)) {
          res.status(400).json({ error: "invalid state" });
          return;
        }

        // CSRF double-submit: the nonce embedded in the state must match the nonce
        // cookie set when the flow started in this browser. Always clear the cookie.
        const nonceCookie = parseCookieHeader(req.headers.cookie ?? "")[
          OAUTH_NONCE_COOKIE
        ];
        const cookieOpts = getSessionCookieOptions(req);
        res.clearCookie(OAUTH_NONCE_COOKIE, cookieOpts);
        if (
          !parsed.nonce ||
          typeof nonceCookie !== "string" ||
          nonceCookie !== parsed.nonce
        ) {
          res.status(400).json({ error: "invalid state" });
          return;
        }

        const tokenResponse = await sdk.exchangeCodeForToken(code, state);
        const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);

        if (!userInfo.openId) {
          res.status(400).json({ error: "openId missing from user info" });
          return;
        }

        const displayName = optionalDisplayName(userInfo.name);
        await db.upsertUser({
          openId: userInfo.openId,
          name: displayName,
          email: userInfo.email ?? null,
          loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
          lastSignedIn: new Date(),
        });

        const sessionToken = await sdk.createSessionToken(userInfo.openId, {
          // Session verification requires a non-empty name claim. Keep nameless
          // OAuth profiles valid with a stable, non-PII fallback label.
          name: displayName ?? "Utilisateur",
          expiresInMs: SESSION_TTL_MS,
        });

        const cookieOptions = getSessionCookieOptions(req);
        res.cookie(COOKIE_NAME, sessionToken, {
          ...cookieOptions,
          maxAge: SESSION_TTL_MS,
        });

        res.redirect(302, "/");
      } catch (error) {
        // OAuth client errors can contain request config, authorization codes, or
        // tokens. Log only a bounded type/code summary and forward a sanitized error.
        console.error(`[OAuth] Callback failed (${safeErrorType(error)})`);
        throw new Error("OAuth callback failed");
      }
    })
  );
}
