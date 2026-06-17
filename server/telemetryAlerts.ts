import { ENV } from "./_core/env";

/**
 * Threshold-based alerting on incoming telemetry. evaluateThresholds is a pure
 * function (compares a metric sample against configured thresholds and returns
 * the alerts it raises); dispatch is handled separately so it stays testable.
 *
 * Thresholds are configurable via env with sensible defaults, like the rest of
 * the project. A metric sample is partial (any field may be absent) — a missing
 * field never raises an alert.
 */
export type AlertSeverity = "warning" | "critical";

export interface TelemetryAlert {
  orderId: number;
  kind: string;
  severity: AlertSeverity;
  message: string;
  value: number;
  threshold: number;
}

export interface MetricSample {
  gpuUsagePercent?: number;
  cpuUsagePercent?: number;
  gpuMemoryUsedGb?: number;
  gpuMemoryTotalGb?: number;
  costThisMonth?: number;
  costProjected?: number;
}

function numEnv(value: string, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export interface AlertThresholds {
  gpuUsagePct: number;
  cpuUsagePct: number;
  gpuMemoryPct: number;
}

export function getThresholds(): AlertThresholds {
  return {
    gpuUsagePct: numEnv(ENV.alertGpuUsagePct, 95),
    cpuUsagePct: numEnv(ENV.alertCpuUsagePct, 95),
    gpuMemoryPct: numEnv(ENV.alertGpuMemoryPct, 90),
  };
}

/** Evaluate a metric sample against thresholds and return any alerts raised. */
export function evaluateThresholds(
  orderId: number,
  m: MetricSample,
  thresholds: AlertThresholds = getThresholds(),
): TelemetryAlert[] {
  const alerts: TelemetryAlert[] = [];

  if (m.gpuUsagePercent !== undefined && m.gpuUsagePercent > thresholds.gpuUsagePct) {
    alerts.push({
      orderId,
      kind: "gpu_usage",
      severity: "critical",
      message: `GPU usage ${m.gpuUsagePercent}% exceeds ${thresholds.gpuUsagePct}%`,
      value: m.gpuUsagePercent,
      threshold: thresholds.gpuUsagePct,
    });
  }

  if (m.cpuUsagePercent !== undefined && m.cpuUsagePercent > thresholds.cpuUsagePct) {
    alerts.push({
      orderId,
      kind: "cpu_usage",
      severity: "warning",
      message: `CPU usage ${m.cpuUsagePercent}% exceeds ${thresholds.cpuUsagePct}%`,
      value: m.cpuUsagePercent,
      threshold: thresholds.cpuUsagePct,
    });
  }

  if (
    m.gpuMemoryUsedGb !== undefined &&
    m.gpuMemoryTotalGb !== undefined &&
    m.gpuMemoryTotalGb > 0
  ) {
    const pct = (m.gpuMemoryUsedGb / m.gpuMemoryTotalGb) * 100;
    if (pct > thresholds.gpuMemoryPct) {
      alerts.push({
        orderId,
        kind: "gpu_memory",
        severity: "warning",
        message: `GPU memory at ${Math.round(pct)}% exceeds ${thresholds.gpuMemoryPct}%`,
        value: Math.round(pct),
        threshold: thresholds.gpuMemoryPct,
      });
    }
  }

  // Cost overrun: this month's spend already past the projected month total.
  if (
    m.costThisMonth !== undefined &&
    m.costProjected !== undefined &&
    m.costProjected > 0 &&
    m.costThisMonth > m.costProjected
  ) {
    alerts.push({
      orderId,
      kind: "cost_overrun",
      severity: "warning",
      message: `Cost this month (${m.costThisMonth}) exceeds projection (${m.costProjected})`,
      value: m.costThisMonth,
      threshold: m.costProjected,
    });
  }

  return alerts;
}

// --- Alert broadcaster (in-memory, same pattern as the provisioning stream) ---

type AlertListener = (alert: TelemetryAlert) => void;
const alertSubscribers = new Map<number, Set<AlertListener>>();

export function subscribeAlerts(orderId: number, listener: AlertListener): () => void {
  let set = alertSubscribers.get(orderId);
  if (!set) {
    set = new Set();
    alertSubscribers.set(orderId, set);
  }
  set.add(listener);
  return () => {
    const current = alertSubscribers.get(orderId);
    if (!current) return;
    current.delete(listener);
    if (current.size === 0) alertSubscribers.delete(orderId);
  };
}

export function publishAlert(alert: TelemetryAlert): void {
  const set = alertSubscribers.get(alert.orderId);
  if (!set) return;
  set.forEach(listener => {
    try {
      listener(alert);
    } catch (error) {
      console.error("[Alert] Listener threw:", String(error));
    }
  });
}

/** Test-only. */
export function __alertSubscriberCount(orderId: number): number {
  return alertSubscribers.get(orderId)?.size ?? 0;
}

/**
 * Evaluate a metric sample and dispatch any alerts: push each to open SSE
 * streams (live dashboard), and email the customer for critical ones. All
 * best-effort — alerting must never break telemetry ingestion.
 */
export async function processMetricAlerts(orderId: number, sample: MetricSample): Promise<void> {
  let alerts: TelemetryAlert[];
  try {
    alerts = evaluateThresholds(orderId, sample);
  } catch (error) {
    console.warn("[Alert] Evaluation failed:", String(error));
    return;
  }
  if (alerts.length === 0) return;

  for (const alert of alerts) {
    try {
      publishAlert(alert);
    } catch (error) {
      console.warn("[Alert] Publish failed:", String(error));
    }
  }

  // Email the customer for critical alerts only (avoid noise on warnings).
  const critical = alerts.filter(a => a.severity === "critical");
  if (critical.length === 0) return;
  try {
    const { getOrder, getLead } = await import("./db");
    const { sendClientEmail } = await import("./_core/email");
    const order = await getOrder(orderId);
    const lead = order ? await getLead(order.leadId) : null;
    if (lead?.email) {
      await sendClientEmail({
        to: lead.email,
        subject: `Alert: infrastructure threshold exceeded (ORD-${String(orderId).padStart(6, "0")})`,
        text: critical.map(a => `• ${a.message}`).join("\n") + "\n\n— DatacenterMarket",
      });
    }
  } catch (error) {
    console.warn("[Alert] Critical-alert email failed:", String(error));
  }
}
