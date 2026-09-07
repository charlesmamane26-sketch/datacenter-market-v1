import { describe, expect, it } from "vitest";
import {
  assertSecureProductionJwtSecret,
  getJwtSecretIssue,
  getPublicRuntimeConfigurationStatus,
  parseTelemetryProviderKeys,
} from "./env";

const RANDOM_HEX_SECRET =
  "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08";
const RANDOM_PROVIDER_KEY = "provider-key-0123456789-ABCDEFGHIJ-xyz";

function productionEnv(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "production",
    JWT_SECRET: RANDOM_HEX_SECRET,
    VITE_APP_ID: "app-123",
    OAUTH_SERVER_URL: "https://oauth.example.com",
    PUBLIC_BASE_URL: "https://market.example.com",
    OWNER_OPEN_ID: "owner-123",
    ...overrides,
  };
}

describe("production environment validation", () => {
  it("rejects the public example and obvious low-entropy secrets", () => {
    expect(getJwtSecretIssue("change-me-to-a-long-random-string")).toBe(
      "known_placeholder"
    );
    expect(getJwtSecretIssue("a".repeat(64))).toBe("low_entropy");
    expect(() =>
      assertSecureProductionJwtSecret(
        productionEnv({ JWT_SECRET: "change-me-to-a-long-random-string" })
      )
    ).toThrow(/not suitable for production/);
  });

  it("accepts a random 64-character hexadecimal secret", () => {
    expect(getJwtSecretIssue(RANDOM_HEX_SECRET)).toBeNull();
    expect(() =>
      assertSecureProductionJwtSecret(productionEnv())
    ).not.toThrow();
  });

  it("reports only sanitized readiness states for required production config", () => {
    expect(getPublicRuntimeConfigurationStatus(productionEnv())).toEqual({
      ready: true,
      oauth: "ready",
      publicOrigin: "ready",
      owner: "ready",
      telemetry: "disabled",
    });

    expect(
      getPublicRuntimeConfigurationStatus(
        productionEnv({ OAUTH_SERVER_URL: "http://oauth.example.com" })
      )
    ).toMatchObject({ ready: false, oauth: "misconfigured" });
    expect(
      getPublicRuntimeConfigurationStatus(
        productionEnv({ PUBLIC_BASE_URL: "https://market.example.com/path" })
      )
    ).toMatchObject({ ready: false, publicOrigin: "misconfigured" });
    expect(
      getPublicRuntimeConfigurationStatus(productionEnv({ OWNER_OPEN_ID: "" }))
    ).toMatchObject({ ready: false, owner: "misconfigured" });
  });

  it("validates per-provider telemetry keys without exposing their values", () => {
    const encoded = JSON.stringify({ 42: RANDOM_PROVIDER_KEY });
    expect(parseTelemetryProviderKeys(encoded)).toEqual({
      42: RANDOM_PROVIDER_KEY,
    });
    expect(parseTelemetryProviderKeys("{}")).toBeNull();
    expect(
      parseTelemetryProviderKeys(JSON.stringify({ bad: RANDOM_PROVIDER_KEY }))
    ).toBeNull();
    expect(
      parseTelemetryProviderKeys(JSON.stringify({ 42: "too-short" }))
    ).toBeNull();
    expect(
      parseTelemetryProviderKeys(
        JSON.stringify({ [Number.MAX_SAFE_INTEGER + 1]: RANDOM_PROVIDER_KEY })
      )
    ).toBeNull();
    expect(
      parseTelemetryProviderKeys(
        JSON.stringify({ 42: RANDOM_PROVIDER_KEY, 43: RANDOM_PROVIDER_KEY })
      )
    ).toBeNull();

    expect(
      getPublicRuntimeConfigurationStatus(
        productionEnv({ TELEMETRY_PROVIDER_KEYS: encoded })
      )
    ).toMatchObject({ ready: true, telemetry: "ready" });
    expect(
      getPublicRuntimeConfigurationStatus(
        productionEnv({ TELEMETRY_INGEST_KEY: RANDOM_PROVIDER_KEY })
      )
    ).toMatchObject({ ready: false, telemetry: "misconfigured" });
  });
});
