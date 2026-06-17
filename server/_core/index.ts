import "dotenv/config";
import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";
import express from "express";
import helmet from "helmet";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { registerStripeWebhook } from "../stripe";
import { registerTelemetryIngest } from "../telemetry";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { buildCspDirectives } from "./csp";
import { initRateLimitStore } from "./redisRateLimit";
import { serveStatic, setupVite } from "./vite";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  // Sessions are HMAC-signed (HS256): a short JWT_SECRET would be brute-forceable,
  // so refuse to boot in production with a weak or missing one.
  if (process.env.NODE_ENV === "production" && (process.env.JWT_SECRET ?? "").length < 32) {
    throw new Error("JWT_SECRET must be at least 32 characters in production.");
  }

  // Initialize Sentry early so it catches errors during startup too
  if (process.env.SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      integrations: [
        nodeProfilingIntegration(),
      ],
      tracesSampleRate: 1.0,
      profilesSampleRate: 1.0,
    });
    console.log("[Sentry] Server monitoring initialized.");
  }

  const app = express();
  const server = createServer(app);

  // Behind a reverse proxy (Docker/PaaS), trust the first hop so req.ip reflects the
  // real client (rate limiting keys on it) instead of a spoofable X-Forwarded-For.
  // TRUST_PROXY_HOPS lets multi-proxy setups widen this without a code change.
  if (process.env.NODE_ENV === "production") {
    app.set("trust proxy", parseInt(process.env.TRUST_PROXY_HOPS || "1"));
  }

  // Security headers (nosniff, frame-deny, HSTS, etc.) + a CSP tuned for this
  // SPA. script-src stays strict (no 'unsafe-inline') in production; dev loosens
  // it for Vite HMR. External origins beyond Google Fonts / the Forge maps proxy
  // are injected via CSP_EXTRA_ORIGINS. See ./csp.ts.
  app.use(
    helmet({
      contentSecurityPolicy: { directives: buildCspDirectives() },
    }),
  );

  // Stripe webhook needs the raw request body — register it before the JSON body parser.
  registerStripeWebhook(app);
  // Body parser limit. tRPC payloads (leads, orders) are a few KB; keep this
  // small to bound JSON-parse memory on unauthenticated routes. Raise per-route
  // if a real upload path is ever added.
  app.use(express.json({ limit: "200kb" }));
  app.use(express.urlencoded({ limit: "200kb", extended: true }));
  // Lightweight liveness probe for load balancers / orchestrators.
  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });
  registerStorageProxy(app);
  // Provider-side telemetry ingestion (POST /api/telemetry/:orderId). Has its
  // own small JSON parser; disabled (503) unless TELEMETRY_INGEST_KEY is set.
  registerTelemetryIngest(app);
  // Activate the Redis-backed rate-limit store when REDIS_URL is set (multi-
  // instance). No-op otherwise: the in-memory store stays in place.
  await initRateLimitStore();
  registerOAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // The error handler must be before any other error middleware and after all controllers
  if (process.env.SENTRY_DSN) {
    Sentry.setupExpressErrorHandler(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
