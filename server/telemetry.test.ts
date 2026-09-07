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

async function loadWithProviderKeys(keys: Record<number, string>) {
  vi.resetModules();
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("TELEMETRY_INGEST_KEY", "");
  vi.stubEnv("TELEMETRY_PROVIDER_KEYS", JSON.stringify(keys));
  return import("./telemetry");
}

afterEach(() => vi.unstubAllEnvs());

describe("MetricSchema", () => {
  it("accepts a partial sample and coerces numeric strings", async () => {
    const { MetricSchema } = await loadWithKey("k");
    const parsed = MetricSchema.safeParse({
      gpuUsagePercent: "87.5",
      gpuMemoryTotalGb: "640",
    });
    expect(parsed.success).toBe(true);
    expect(parsed.data).toEqual({
      gpuUsagePercent: 87.5,
      gpuMemoryTotalGb: 640,
    });
  });

  it("rejects out-of-range percentages", async () => {
    const { MetricSchema } = await loadWithKey("k");
    expect(MetricSchema.safeParse({ gpuUsagePercent: 150 }).success).toBe(
      false
    );
    expect(MetricSchema.safeParse({ cpuUsagePercent: -1 }).success).toBe(false);
  });

  it("rejects a non-integer total memory", async () => {
    const { MetricSchema } = await loadWithKey("k");
    expect(MetricSchema.safeParse({ gpuMemoryTotalGb: 12.5 }).success).toBe(
      false
    );
  });

  it("rejects an empty metric sample", async () => {
    const { MetricSchema } = await loadWithKey("k");
    expect(MetricSchema.safeParse({}).success).toBe(false);
  });
});

describe("isTelemetryEligibleOrder", () => {
  it("accepts only paid orders in an active infrastructure lifecycle", async () => {
    const { isTelemetryEligibleOrder } = await loadWithKey("k");
    expect(
      isTelemetryEligibleOrder({
        paymentStatus: "succeeded",
        status: "processing",
      })
    ).toBe(true);
    expect(
      isTelemetryEligibleOrder({
        paymentStatus: "succeeded",
        status: "provisioning",
      })
    ).toBe(true);
    expect(
      isTelemetryEligibleOrder({ paymentStatus: "succeeded", status: "active" })
    ).toBe(true);
    expect(
      isTelemetryEligibleOrder({
        paymentStatus: "pending",
        status: "processing",
      })
    ).toBe(false);
    expect(
      isTelemetryEligibleOrder({
        paymentStatus: "succeeded",
        status: "cancelled",
      })
    ).toBe(false);
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

  it("binds production credentials to exactly one provider", async () => {
    const provider12Key = "provider-12-telemetry-key-0000001";
    const provider13Key = "provider-13-telemetry-key-0000001";
    const { isAuthorized, resolveAuthorizedProvider } =
      await loadWithProviderKeys({ 12: provider12Key, 13: provider13Key });

    expect(resolveAuthorizedProvider(`Bearer ${provider12Key}`)).toBe(12);
    expect(isAuthorized(`Bearer ${provider12Key}`, 12)).toBe(true);
    expect(isAuthorized(`Bearer ${provider12Key}`, 13)).toBe(false);
    expect(isAuthorized(`Bearer ${provider13Key}`, 13)).toBe(true);
  });

  it("does not accept the legacy global key in production", async () => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("TELEMETRY_PROVIDER_KEYS", "");
    vi.stubEnv("TELEMETRY_INGEST_KEY", "legacy-global-key-that-is-long-enough");
    const { isAuthorized, hasTelemetryConfiguration } = await import(
      "./telemetry"
    );

    expect(hasTelemetryConfiguration()).toBe(false);
    expect(
      isAuthorized("Bearer legacy-global-key-that-is-long-enough", 12)
    ).toBe(false);
  });

  it("fails closed on malformed provider-key configuration", async () => {
    const { parseProviderTelemetryKeys } = await loadWithProviderKeys({
      12: "too-short",
    });
    expect(parseProviderTelemetryKeys()).toEqual(new Map());
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
