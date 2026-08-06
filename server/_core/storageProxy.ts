import type { Express } from "express";
import { clientIp, enforceRateLimit } from "../rateLimit";
import { ENV } from "./env";

const STORAGE_RATE_LIMIT = 120;
const STORAGE_RATE_WINDOW_MS = 60_000;
const STORAGE_FETCH_TIMEOUT_MS = 5_000;
const MAX_STORAGE_KEY_LENGTH = 512;
const MAX_STORAGE_KEY_SEGMENTS = 8;
const STORAGE_SEGMENT_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

export function normalizePublicStorageKey(
  raw: string | undefined
): string | null {
  if (!raw || raw.length > MAX_STORAGE_KEY_LENGTH || raw.includes("\\"))
    return null;
  const key = raw.replace(/^\/+/, "");
  const segments = key.split("/");
  if (
    segments.length === 0 ||
    segments.length > MAX_STORAGE_KEY_SEGMENTS ||
    segments.some(
      segment =>
        !STORAGE_SEGMENT_RE.test(segment) ||
        segment === "." ||
        segment === ".." ||
        segment.startsWith(".")
    )
  ) {
    return null;
  }
  return segments.join("/");
}

export function isStorageKeyPublic(key: string, rawPrefixes: string): boolean {
  const configuredPrefixes = rawPrefixes
    .split(",")
    .map(prefix => prefix.trim())
    .filter(Boolean);
  if (configuredPrefixes.length === 0) return true;

  const prefixes = configuredPrefixes.map(normalizePublicStorageKey);
  // A malformed allow-list must never silently broaden access to every key.
  if (prefixes.some(prefix => prefix === null)) return false;
  return prefixes.some(
    prefix => key === prefix || key.startsWith(`${prefix}/`)
  );
}

export function registerStorageProxy(app: Express) {
  app.get("/manus-storage/*", async (req, res) => {
    const key = normalizePublicStorageKey(
      (req.params as Record<string, string>)[0]
    );
    if (!key || !isStorageKeyPublic(key, ENV.storagePublicPrefixes)) {
      res.status(404).send("Not found");
      return;
    }

    if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
      res.status(503).send("Storage unavailable");
      return;
    }

    try {
      const rate = await enforceRateLimit(
        `storage:${clientIp(req)}`,
        STORAGE_RATE_LIMIT,
        STORAGE_RATE_WINDOW_MS
      );
      if (!rate.allowed) {
        res.set(
          "Retry-After",
          String(Math.max(1, Math.ceil(rate.retryAfterMs / 1000)))
        );
        res.status(429).send("Too many requests");
        return;
      }

      const forgeUrl = new URL(
        "v1/storage/presign/get",
        ENV.forgeApiUrl.replace(/\/+$/, "") + "/"
      );
      forgeUrl.searchParams.set("path", key);

      const forgeResp = await fetch(forgeUrl, {
        headers: { Authorization: `Bearer ${ENV.forgeApiKey}` },
        signal: AbortSignal.timeout(STORAGE_FETCH_TIMEOUT_MS),
      });

      if (!forgeResp.ok) {
        // Upstream error bodies may echo paths, tokens, or provider internals.
        // Discard them and keep the operational signal to the HTTP status only.
        await forgeResp.body?.cancel().catch(() => undefined);
        console.error(
          `[StorageProxy] Upstream request failed (status=${forgeResp.status})`
        );
        res.status(502).send("Storage backend error");
        return;
      }

      const { url } = (await forgeResp.json()) as { url?: unknown };
      if (typeof url !== "string") {
        res.status(502).send("Storage backend error");
        return;
      }

      const signedUrl = new URL(url);
      if (
        !["http:", "https:"].includes(signedUrl.protocol) ||
        (ENV.isProduction && signedUrl.protocol !== "https:")
      ) {
        res.status(502).send("Storage backend error");
        return;
      }

      res.set("Cache-Control", "no-store");
      res.redirect(307, signedUrl.toString());
    } catch (err) {
      const errorType = err instanceof Error ? err.name : "UnknownError";
      console.error(`[StorageProxy] Request failed (${errorType})`);
      res.status(502).send("Storage proxy error");
    }
  });
}
