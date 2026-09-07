import express, { type Express } from "express";
import { timingSafeEqual } from "crypto";
import { z } from "zod";
import { ENV, parseTelemetryProviderKeys } from "./_core/env";
import { asyncHandler } from "./_core/asyncHandler";
import { createInfrastructureMetrics, getOrder } from "./db";
import { clientIp, enforceRateLimit } from "./rateLimit";
import { processMetricAlerts } from "./telemetryAlerts";

/**
 * Production telemetry ingestion. A provider-side agent POSTs metric samples for
 * an active order; we validate, authenticate with a shared key, and persist them
 * into `infrastructureMetrics` (the same table the client dashboard reads, and
 * that `simulate-telemetry.ts` writes to in dev).
 *
 * Auth uses one bearer key per provider (TELEMETRY_PROVIDER_KEYS, a JSON object
 * keyed by provider id) and binds that identity to order.providerId. The legacy
 * global TELEMETRY_INGEST_KEY is accepted only outside production so one
 * provider credential can never write metrics for another provider's order.
 */

// Decimals are stored as strings (mirrors the schema's decimal columns and how
// simulate-telemetry writes them); ints stay numbers. Individual fields are
// optional so partial samples work, but an empty sample is rejected.
const MetricSchema = z
  .object({
    gpuUsagePercent: z.coerce.number().min(0).max(100).optional(),
    gpuMemoryUsedGb: z.coerce.number().min(0).optional(),
    gpuMemoryTotalGb: z.coerce.number().int().min(0).optional(),
    cpuUsagePercent: z.coerce.number().min(0).max(100).optional(),
    ramUsedGb: z.coerce.number().min(0).optional(),
    ramTotalGb: z.coerce.number().int().min(0).optional(),
    costThisMonth: z.coerce.number().min(0).optional(),
    costProjected: z.coerce.number().min(0).optional(),
  })
  .refine(sample => Object.values(sample).some(value => value !== undefined), {
    message: "At least one metric field is required.",
  });

type MetricInput = z.infer<typeof MetricSchema>;
type AuthorizedProvider = number | "legacy";
const TELEMETRY_ORDER_STATUSES = new Set([
  "processing",
  "provisioning",
  "active",
]);

function isTelemetryEligibleOrder(order: {
  paymentStatus: string;
  status: string;
}): boolean {
  return (
    order.paymentStatus === "succeeded" &&
    TELEMETRY_ORDER_STATUSES.has(order.status)
  );
}

function constantTimeKeyMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function parseProviderTelemetryKeys(
  raw = process.env.TELEMETRY_PROVIDER_KEYS
): Map<number, string> {
  const parsed = parseTelemetryProviderKeys(raw);
  const providerKeys = new Map<number, string>();
  for (const [providerId, key] of Object.entries(parsed ?? {})) {
    providerKeys.set(Number(providerId), key);
  }
  return providerKeys;
}

/** Resolve the provider represented by a bearer key without leaking the key. */
export function resolveAuthorizedProvider(
  header: string | undefined
): AuthorizedProvider | null {
  if (typeof header !== "string" || !header.startsWith("Bearer ")) return null;
  const provided = header.slice("Bearer ".length);
  for (const [providerId, key] of parseProviderTelemetryKeys()) {
    if (constantTimeKeyMatch(provided, key)) return providerId;
  }

  if (
    process.env.NODE_ENV !== "production" &&
    ENV.telemetryIngestKey &&
    constantTimeKeyMatch(provided, ENV.telemetryIngestKey)
  ) {
    return "legacy";
  }
  return null;
}

/** Constant-time bearer-key check, optionally bound to an expected provider. */
function isAuthorized(
  header: string | undefined,
  providerId?: number
): boolean {
  const authorized = resolveAuthorizedProvider(header);
  return (
    authorized === "legacy" ||
    (typeof authorized === "number" &&
      (providerId === undefined || authorized === providerId))
  );
}

function hasTelemetryConfiguration(): boolean {
  return (
    parseProviderTelemetryKeys().size > 0 ||
    (process.env.NODE_ENV !== "production" && Boolean(ENV.telemetryIngestKey))
  );
}

/** Decimal columns are stored as strings; ints as numbers. */
function toRow(orderId: number, m: MetricInput) {
  const str = (v: number | undefined) =>
    v === undefined ? undefined : v.toFixed(2);
  return {
    orderId,
    gpuUsagePercent: str(m.gpuUsagePercent),
    gpuMemoryUsedGb: str(m.gpuMemoryUsedGb),
    gpuMemoryTotalGb: m.gpuMemoryTotalGb,
    cpuUsagePercent: str(m.cpuUsagePercent),
    ramUsedGb: str(m.ramUsedGb),
    ramTotalGb: m.ramTotalGb,
    costThisMonth: str(m.costThisMonth),
    costProjected: str(m.costProjected),
  };
}

export function registerTelemetryIngest(app: Express) {
  app.post(
    "/api/telemetry/:orderId",
    express.json({ limit: "16kb" }),
    asyncHandler(async (req, res) => {
      if (!hasTelemetryConfiguration()) {
        res
          .status(503)
          .json({ error: "Telemetry ingestion is not configured." });
        return;
      }
      const authorizedProvider = resolveAuthorizedProvider(
        req.headers.authorization
      );
      if (authorizedProvider === null) {
        res.status(401).json({ error: "Unauthorized." });
        return;
      }

      const orderId = Number(req.params.orderId);
      if (!Number.isInteger(orderId) || orderId <= 0) {
        res.status(400).json({ error: "Invalid orderId." });
        return;
      }

      const limit = await enforceRateLimit(
        `telemetry:${authorizedProvider}:${orderId}:${clientIp(req)}`,
        120,
        60_000
      );
      if (!limit.allowed) {
        res.status(429).json({ error: "Too many telemetry samples." });
        return;
      }

      const parsed = MetricSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: "Invalid metric payload.",
          issues: parsed.error.issues,
        });
        return;
      }

      // The order must exist; reject metrics for unknown orders so the table can't
      // be seeded with orphan rows.
      const order = await getOrder(orderId);
      if (!order) {
        res.status(404).json({ error: "Order not found." });
        return;
      }
      if (
        authorizedProvider !== "legacy" &&
        order.providerId !== authorizedProvider
      ) {
        // Use the same response as a missing order to prevent cross-provider id
        // probing with an otherwise valid machine credential.
        res.status(404).json({ error: "Order not found." });
        return;
      }
      if (!isTelemetryEligibleOrder(order)) {
        res
          .status(409)
          .json({ error: "Order is not eligible for telemetry ingestion." });
        return;
      }

      try {
        await createInfrastructureMetrics(toRow(orderId, parsed.data));
        res.status(202).json({ accepted: true });
        // Threshold alerting — fire-and-forget so it never delays the 202 response
        // and a failure can't turn a successful ingest into an error.
        void processMetricAlerts(orderId, parsed.data).catch(err =>
          console.warn("[Telemetry] Alert dispatch failed:", String(err))
        );
      } catch (error) {
        console.error("[Telemetry] Failed to persist metric:", error);
        res.status(500).json({ error: "Failed to persist metric." });
      }
    })
  );
}

// Exported for unit tests.
export {
  MetricSchema,
  hasTelemetryConfiguration,
  isAuthorized,
  isTelemetryEligibleOrder,
  toRow,
};
