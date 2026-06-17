import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * isAuthorized reads ENV.telemetryIngestKey, so we stub the key per case and
 * re-import. MetricSchema / toRow are pure and tested directly.
 */
async function loadWithKey(key: string | undefined) {
  vi.resetModules();
  if (key !== undefined) vi.stubEnv("TELEMETRY_INGEST_KEY", key);
  return import("./telemetry");
}

afterEach(() => vi.unstubAllEnvs());

describe("MetricSchema", () => {
  it("accepts a partial sample and coerces numeric strings", async () => {
    const { MetricSchema } = await loadWithKey("k");
    const parsed = MetricSchema.safeParse({ gpuUsagePercent: "87.5", gpuMemoryTotalGb: "640" });
    expect(parsed.success).toBe(true);
    expect(parsed.data).toEqual({ gpuUsagePercent: 87.5, gpuMemoryTotalGb: 640 });
  });

  it("rejects out-of-range percentages", async () => {
    const { MetricSchema } = await loadWithKey("k");
    expect(MetricSchema.safeParse({ gpuUsagePercent: 150 }).success).toBe(false);
    expect(MetricSchema.safeParse({ cpuUsagePercent: -1 }).success).toBe(false);
  });

  it("rejects a non-integer total memory", async () => {
    const { MetricSchema } = await loadWithKey("k");
    expect(MetricSchema.safeParse({ gpuMemoryTotalGb: 12.5 }).success).toBe(false);
  });
});

describe("isAuthorized", () => {
  it("accepts the exact bearer key", async () => {
    const { isAuthorized } = await loadWithKey("super-secret");
    expect(isAuthorized("Bearer super-secret")).toBe(true);
  });

  it("rejects a wrong key, missing prefix, or undefined header", async () => {
    const { isAuthorized } = await loadWithKey("super-secret");
    expect(isAuthorized("Bearer nope")).toBe(false);
    expect(isAuthorized("super-secret")).toBe(false);
    expect(isAuthorized(undefined)).toBe(false);
  });

  it("rejects everything when no key is configured", async () => {
    const { isAuthorized } = await loadWithKey("");
    expect(isAuthorized("Bearer anything")).toBe(false);
  });
});

describe("toRow", () => {
  it("stringifies decimals to 2 places and leaves ints as numbers", async () => {
    const { toRow } = await loadWithKey("k");
    const row = toRow(42, {
      gpuUsagePercent: 87.5,
      gpuMemoryTotalGb: 640,
      cpuUsagePercent: 33,
    });
    expect(row.orderId).toBe(42);
    expect(row.gpuUsagePercent).toBe("87.50");
    expect(row.cpuUsagePercent).toBe("33.00");
    expect(row.gpuMemoryTotalGb).toBe(640);
    // Omitted fields stay undefined (partial sample).
    expect(row.ramUsedGb).toBeUndefined();
  });
});
