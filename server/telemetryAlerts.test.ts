import { describe, expect, it } from "vitest";
import {
  evaluateThresholds,
  subscribeAlerts,
  publishAlert,
  __alertSubscriberCount,
  type AlertThresholds,
  type TelemetryAlert,
} from "./telemetryAlerts";

const TH: AlertThresholds = { gpuUsagePct: 95, cpuUsagePct: 95, gpuMemoryPct: 90 };

describe("evaluateThresholds", () => {
  it("raises no alerts for a healthy sample", () => {
    expect(evaluateThresholds(1, { gpuUsagePercent: 70, cpuUsagePercent: 40 }, TH)).toEqual([]);
  });

  it("raises a critical gpu_usage alert above the threshold", () => {
    const [a] = evaluateThresholds(1, { gpuUsagePercent: 97 }, TH);
    expect(a.kind).toBe("gpu_usage");
    expect(a.severity).toBe("critical");
    expect(a.value).toBe(97);
  });

  it("does not raise at exactly the threshold (strict >)", () => {
    expect(evaluateThresholds(1, { gpuUsagePercent: 95 }, TH)).toEqual([]);
  });

  it("raises gpu_memory from the used/total ratio", () => {
    const alerts = evaluateThresholds(1, { gpuMemoryUsedGb: 95, gpuMemoryTotalGb: 100 }, TH);
    expect(alerts.find(a => a.kind === "gpu_memory")).toBeTruthy();
  });

  it("ignores gpu_memory when total is missing or zero", () => {
    expect(evaluateThresholds(1, { gpuMemoryUsedGb: 95 }, TH)).toEqual([]);
    expect(evaluateThresholds(1, { gpuMemoryUsedGb: 95, gpuMemoryTotalGb: 0 }, TH)).toEqual([]);
  });

  it("raises cost_overrun when spend passes the projection", () => {
    const [a] = evaluateThresholds(1, { costThisMonth: 1200, costProjected: 1000 }, TH);
    expect(a.kind).toBe("cost_overrun");
  });

  it("raises multiple alerts at once", () => {
    const alerts = evaluateThresholds(1, { gpuUsagePercent: 99, cpuUsagePercent: 99 }, TH);
    expect(alerts.map(a => a.kind).sort()).toEqual(["cpu_usage", "gpu_usage"]);
  });

  it("never alerts on absent fields", () => {
    expect(evaluateThresholds(1, {}, TH)).toEqual([]);
  });
});

describe("alert broadcaster", () => {
  const mk = (orderId: number): TelemetryAlert => ({
    orderId, kind: "gpu_usage", severity: "critical", message: "x", value: 99, threshold: 95,
  });

  it("delivers alerts to subscribers of the order and purges on unsubscribe", () => {
    const got: TelemetryAlert[] = [];
    const unsub = subscribeAlerts(5, a => got.push(a));
    expect(__alertSubscriberCount(5)).toBe(1);
    publishAlert(mk(5));
    expect(got).toHaveLength(1);
    unsub();
    expect(__alertSubscriberCount(5)).toBe(0);
    publishAlert(mk(5));
    expect(got).toHaveLength(1);
  });

  it("isolates orders", () => {
    const got: TelemetryAlert[] = [];
    const unsub = subscribeAlerts(10, a => got.push(a));
    publishAlert(mk(20));
    expect(got).toHaveLength(0);
    unsub();
  });
});
