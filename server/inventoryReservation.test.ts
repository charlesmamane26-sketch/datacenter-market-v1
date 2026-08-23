import { describe, expect, it } from "vitest";
import {
  buildLeadErasurePatch,
  hasActiveInventoryReservation,
} from "./db";

describe("inventory reservation ledger", () => {
  it("recognizes only a reservation which has not already been released", () => {
    const reservedAt = new Date("2026-08-06T12:00:00Z");
    expect(
      hasActiveInventoryReservation({ inventoryReservedAt: reservedAt, inventoryReleasedAt: null }),
    ).toBe(true);
    expect(
      hasActiveInventoryReservation({
        inventoryReservedAt: reservedAt,
        inventoryReleasedAt: new Date("2026-08-06T12:05:00Z"),
      }),
    ).toBe(false);
    // Legacy rows must never manufacture capacity during a release.
    expect(
      hasActiveInventoryReservation({ inventoryReservedAt: null, inventoryReleasedAt: null }),
    ).toBe(false);
  });
});

describe("referenced lead erasure", () => {
  it("removes every PII/consent field while retaining a deterministic tombstone", () => {
    const erasedAt = new Date("2026-08-06T13:00:00Z");
    expect(buildLeadErasurePatch(42, erasedAt)).toEqual({
      userId: null,
      email: "erased-42@redacted.invalid",
      company: null,
      contactName: null,
      contactRole: null,
      workloadType: null,
      gpuRequirement: null,
      monthlyBudget: null,
      deploymentDuration: null,
      infrastructureConstraints: null,
      consentedAt: null,
      consentPolicyVersion: null,
      personalDataErasedAt: erasedAt,
    });
  });
});
