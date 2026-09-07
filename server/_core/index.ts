import "dotenv/config";
import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";
import express from "express";
import helmet from "helmet";
import { createServer } from "http";
import { sql } from "drizzle-orm";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { getStripeConfigurationStatus, registerStripeWebhook } from "../stripe";
import { registerTelemetryIngest } from "../telemetry";
import { registerProvisioningStream } from "../provisioningStream";
import { appRouter } from "../routers";
import { getDb } from "../db";
import { asyncHandler } from "./asyncHandler";
import { createContext } from "./context";
import { buildCspDirectives } from "./csp";
import {
  assertSecureProductionJwtSecret,
  getPublicRuntimeConfigurationStatus,
} from "./env";
import { installGracefulShutdown } from "./gracefulShutdown";
import { initRateLimitStore } from "./redisRateLimit";
import { closeRedis, isRedisReady } from "./redisClient";
import { trpcBatchLimit } from "./trpcBatchLimit";
import { serveStatic, setupVite } from "./vite";

const DEFAULT_READINESS_TIMEOUT_MS = 5_000;

function parseIntegerSetting(
  name: string,
  raw: string | undefined,
  fallback: number,
  min: number,
  max: number
): number {
  const value = raw === undefined || raw.trim() === "" ? fallback : Number(raw);
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}.`);
  }
  return value;
}

function parseSampleRate(
  name: string,
  raw: string | undefined,
  fallback: number
): number {
  const value = raw === undefined || raw.trim() === "" ? fallback : Number(raw);
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${name} must be a number between 0 and 1.`);
  }
  return value;
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Readiness check timed out")),
      timeoutMs
    );
    promise.then(
      value => {
        clearTimeout(timer);
        resolve(value);
      },
      error => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

async function isDatabaseReady(timeoutMs: number): Promise<boolean> {
  if (!process.env.DATABASE_URL) return false;
  try {
    const db = await getDb();
    if (!db) return false;
    await withTimeout(db.execute(sql`select 1`), timeoutMs);
    return true;
  } catch {
    return false;
  }
}

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
  // Sessions are HMAC-signed (HS256). Reject public examples, repeated values,
  // and low-entropy secrets before accepting any production traffic.
  assertSecureProductionJwtSecret();

  const databaseReadinessTimeoutMs = parseIntegerSetting(
    "DB_READINESS_TIMEOUT_MS",
    process.env.DB_READINESS_TIMEOUT_MS,
    DEFAULT_READINESS_TIMEOUT_MS,
    500,
    60_000
  );

  // Initialize Sentry early so it catches errors during startup too
  if (process.env.SENTRY_DSN) {
    const production = process.env.NODE_ENV === "production";
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      integrations: [nodeProfilingIntegration()],
      tracesSampleRate: parseSampleRate(
        "SENTRY_TRACES_SAMPLE_RATE",
        process.env.SENTRY_TRACES_SAMPLE_RATE,
        production ? 0.1 : 1
      ),
      profilesSampleRate: parseSampleRate(
        "SENTRY_PROFILES_SAMPLE_RATE",
        process.env.SENTRY_PROFILES_SAMPLE_RATE,
        production ? 0.02 : 1
      ),
    });
    console.log("[Sentry] Server monitoring initialized.");
  }

  const app = express();
  const server = createServer(app);
  // Bound slow request headers/bodies without limiting long-lived SSE responses.
  server.headersTimeout = 15_000;
  server.requestTimeout = 30_000;
  server.keepAliveTimeout = 5_000;

  // Behind a reverse proxy (Docker/PaaS), trust the first hop so req.ip reflects the
  // real client (rate limiting keys on it) instead of a spoofable X-Forwarded-For.
  // TRUST_PROXY_HOPS lets multi-proxy setups widen this without a code change.
  if (process.env.NODE_ENV === "production") {
    app.set(
      "trust proxy",
      parseIntegerSetting(
        "TRUST_PROXY_HOPS",
        process.env.TRUST_PROXY_HOPS,
        1,
        0,
        10
      )
    );
  }

  // Security headers (nosniff, frame-deny, HSTS, etc.) + a CSP tuned for this
  // SPA. script-src stays strict (no 'unsafe-inline') in production; dev loosens
  // it for Vite HMR. External origins beyond Google Fonts / the Forge maps proxy
  // are injected via CSP_EXTRA_ORIGINS. See ./csp.ts.
  app.use(
    helmet({
      contentSecurityPolicy: { directives: buildCspDirectives() },
    })
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
  // Readiness checks dependencies required to serve the marketplace. Redis is
  // optional when unconfigured, but a configured-yet-unreachable instance must
  // keep the replica out of rotation until it recovers or is restarted.
  app.get(
    "/ready",
    asyncHandler(async (_req, res) => {
      const redisConfigured = Boolean(process.env.REDIS_URL);
      const [databaseReady, redisReady] = await Promise.all([
        isDatabaseReady(databaseReadinessTimeoutMs),
        isRedisReady(),
      ]);
      const stripe = getStripeConfigurationStatus();
      const runtime = getPublicRuntimeConfigurationStatus();
      const stripeDisabled =
        !stripe.secretKeyConfigured && !stripe.webhookSecretConfigured;
      const stripeReady = stripe.ready || stripeDisabled;
      const ready = databaseReady && redisReady && stripeReady && runtime.ready;
      res.status(ready ? 200 : 503).json({
        status: ready ? "ready" : "not_ready",
        checks: {
          database: databaseReady ? "ready" : "unavailable",
          redis: redisConfigured
            ? redisReady
              ? "ready"
              : "unavailable"
            : "disabled",
          stripe: stripeReady
            ? stripeDisabled
              ? "disabled"
              : "ready"
            : "misconfigured",
          oauth: runtime.oauth,
          publicOrigin: runtime.publicOrigin,
          owner: runtime.owner,
          telemetry: runtime.telemetry,
        },
      });
    })
  );
  registerStorageProxy(app);
  // Provider-side telemetry ingestion (POST /api/telemetry/:orderId). Has its
  // own small JSON parser; production credentials are configured per provider.
  registerTelemetryIngest(app);
  // Real-time provisioning timeline (SSE). Must be registered before Vite's
  // catch-all so the stream route isn't swallowed by the SPA fallback.
  registerProvisioningStream(app);
  // Activate the Redis-backed rate-limit store when REDIS_URL is set (multi-
  // instance). No-op otherwise: the in-memory store stays in place.
  await initRateLimitStore();
  registerOAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    trpcBatchLimit(),
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

  const preferredPort = parseIntegerSetting(
    "PORT",
    process.env.PORT,
    3000,
    1,
    65_535
  );
  const port =
    process.env.NODE_ENV === "development"
      ? await findAvailablePort(preferredPort)
      : preferredPort;

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error) => reject(error);
    server.once("error", onError);
    server.listen(port, () => {
      server.off("error", onError);
      resolve();
    });
  });
  console.log(`Server running on http://localhost:${port}/`);

  installGracefulShutdown({
    server,
    cleanup: closeRedis,
    flushMonitoring: () =>
      process.env.SENTRY_DSN ? Sentry.flush(2_000) : Promise.resolve(true),
  });
}

void startServer().catch(async error => {
  console.error("[Server] Startup failed:", error);
  if (process.env.SENTRY_DSN) {
    Sentry.captureException(error);
    await Sentry.flush(2_000).catch(() => false);
  }
  process.exit(1);
});
