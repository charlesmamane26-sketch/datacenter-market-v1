import { ENV } from "./env";

/**
 * Builds the Content-Security-Policy directives for helmet.
 *
 * Design notes:
 * - script-src never allows 'unsafe-inline' in production: that is the directive
 *   that actually blocks XSS. The app bundle is external (Vite build), so no
 *   inline script is needed in prod.
 * - style-src allows 'unsafe-inline' because `components/ui/chart.tsx` injects a
 *   runtime <style> for chart colors. Inline *styles* cannot execute JS, so this
 *   is a low-risk concession; tighten to hashes later if desired.
 * - Known external origins (Google Fonts, the Forge maps proxy) are hard-coded.
 *   Deployment-specific origins (Umami analytics, OAuth portal, Sentry ingest)
 *   are injected via CSP_EXTRA_ORIGINS (space-separated) so the policy can be
 *   widened without a code change. An unset origin is simply not added.
 * - In development, Vite's HMR client needs 'unsafe-inline', 'unsafe-eval' and a
 *   ws: connection, so the policy is loosened accordingly.
 */
const FORGE_MAPS_ORIGIN = "https://forge.butterfly-effect.dev";

function extraOrigins(): string[] {
  return (process.env.CSP_EXTRA_ORIGINS ?? "")
    .split(/\s+/)
    .map(o => o.trim())
    .filter(Boolean);
}

export function buildCspDirectives(): Record<string, string[]> {
  const dev = !ENV.isProduction;
  const extra = extraOrigins();

  const scriptSrc = ["'self'", FORGE_MAPS_ORIGIN, ...extra];
  const connectSrc = ["'self'", FORGE_MAPS_ORIGIN, ...extra];

  if (dev) {
    // Vite HMR: inline bootstrap script, esbuild eval, and the HMR websocket.
    scriptSrc.push("'unsafe-inline'", "'unsafe-eval'");
    connectSrc.push("ws:", "wss:");
  }

  return {
    defaultSrc: ["'self'"],
    scriptSrc,
    // 'unsafe-inline' required by chart.tsx's injected <style>; harmless for JS.
    styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
    fontSrc: ["'self'", "https://fonts.gstatic.com"],
    imgSrc: ["'self'", "data:", "blob:", FORGE_MAPS_ORIGIN],
    connectSrc,
    frameSrc: ["'none'"],
    frameAncestors: ["'none'"],
    baseUri: ["'self'"],
    formAction: ["'self'", ...extra],
    objectSrc: ["'none'"],
  };
}
