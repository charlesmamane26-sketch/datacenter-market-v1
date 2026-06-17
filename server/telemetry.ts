import express, { type Express } from "express";
import { timingSafeEqual } from "crypto";
import { z } from "zod";
import { ENV } from "./_core/env";
import { createInfrastructureMetrics, getOrder } from "./db";
import { processMetricAlerts } from "./telemetryAlerts";

/**
 * Production telemetry ingestion. A provider-side agent POSTs metric samples for
 * an active order; we validate, authenticate with a shared key, and persist them
 * into `infrastructureMetrics` (the same table the client dashboard reads, and
 * that `simulate-telemetry.ts` writes to in dev).
 *
 * Auth is a shared bearer key (TELEMETRY_INGEST_KEY) compared in constant time —
 * the caller is a machine, not a session user. Without the key the route is
 * disabled (503), mirroring how Stripe is gated by its secret.
 */

// Decimals are stored as strings (mirrors the schema's decimal columns and how
// simulate-telemetry writes them); ints stay numbers. All fields optional except
// none — at least the GPU/CPU usage is expected, but partial samples are allowed.
const MetricSchema = z.object({
  gpuUsagePercent: z.coerce.number().min(0).max(100).optional(),
  gpuMemoryUsedGb: z.coerce.number().min(0).optional(),
  gpuMemoryTotalGb: z.coerce.number().int().min(0).optional(),
  cpuUsagePercent: z.coerce.number().min(0).max(100).optional(),
  ramUsedGb: z.coerce.number().min(0).optional(),
  ramTotalGb: z.coerce.number().int().min(0).optional(),
  costThisMonth: z.coerce.number().min(0).optional(),
  costProjected: z.coerce.number().min(0).optional(),
});

type MetricInput = z.infer<typeof MetricSchema>;

/** Constant-time bearer-key check. Returns false unless a key is configured. */
function isAuthorized(header: string | undefined): boolean {
  const configured = ENV.telemetryIngestKey;
  if (!configured) return false;
  if (typeof header !== "string" || !header.startsWith("Bearer ")) return false;
  const provided = header.slice("Bearer ".length);
  const a = Buffer.from(provided);
  const b = Buffer.from(configured);
  // timingSafeEqual throws on length mismatch — guard it, but still compare to
  // avoid leaking length via early return timing.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Decimal columns are stored as strings; ints as numbers. */
function toRow(orderId: number, m: MetricInput) {
  const str = (v: number | undefined) => (v === undefined ? undefined : v.toFixed(2));
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
  app.post("/api/telemetry/:orderId", express.json({ limit: "16kb" }), async (req, res) => {
    if (!ENV.telemetryIngestKey) {
      res.status(503).json({ error: "Telemetry ingestion is not configured." });
      return;
    }
    if (!isAuthorized(req.headers.authorization)) {
      res.status(401).json({ error: "Unauthorized." });
      return;
    }

    const orderId = Number(req.params.orderId);
    if (!Number.isInteger(orderId) || orderId <= 0) {
      res.status(400).json({ error: "Invalid orderId." });
      return;
    }

    const parsed = MetricSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid metric payload.", issues: parsed.error.issues });
      return;
    }

    // The order must exist; reject metrics for unknown orders so the table can't
    // be seeded with orphan rows.
    const order = await getOrder(orderId);
    if (!order) {
      res.status(404).json({ error: "Order not found." });
      return;
    }

    try {
      await createInfrastructureMetrics(toRow(orderId, parsed.data));
      res.status(202).json({ accepted: true });
      // Threshold alerting — fire-and-forget so it never delays the 202 response
      // and a failure can't turn a successful ingest into an error.
      void processMetricAlerts(orderId, parsed.data).catch(err =>
        console.warn("[Telemetry] Alert dispatch failed:", String(err)),
      );
    } catch (error) {
      console.error("[Telemetry] Failed to persist metric:", error);
      res.status(500).json({ error: "Failed to persist metric." });
    }
  });
}

// Exported for unit tests.
export { MetricSchema, isAuthorized, toRow };
