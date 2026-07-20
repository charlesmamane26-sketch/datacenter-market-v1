import { describe, expect, it } from "vitest";
import { isAvailabilityStale, isOfferSellable } from "./inventory";

const NOW = new Date("2026-07-20T12:00:00.000Z");

describe("supplier inventory sellability", () => {
  it("accepts active, fresh capacity in a sellable state", () => {
    expect(
      isOfferSellable(
        {
          isActive: true,
          availabilityStatus: "limited",
          availableCapacity: 1,
          availabilityExpiresAt: new Date("2026-07-20T13:00:00.000Z"),
          provider: { isActive: true },
        },
        NOW,
      ),
    ).toBe(true);
  });

  it("rejects every non-sellable operational condition", () => {
    const cases = [
      { isActive: false },
      { availabilityStatus: "unavailable" as const },
      { availabilityStatus: "maintenance" as const },
      { availableCapacity: 0 },
      { provider: { isActive: false } },
      { availabilityExpiresAt: new Date("2026-07-20T12:00:00.000Z") },
    ];

    for (const patch of cases) {
      expect(
        isOfferSellable(
          {
            isActive: true,
            availabilityStatus: "available",
            availableCapacity: 1,
            provider: { isActive: true },
            ...patch,
          },
          NOW,
        ),
      ).toBe(false);
    }
  });

  it("fails closed when supplier attribution is missing", () => {
    expect(isOfferSellable({}, NOW)).toBe(false);
    expect(isOfferSellable({ provider: null }, NOW)).toBe(false);
  });

  it("marks missing, invalid, or elapsed expiry values stale", () => {
    expect(isAvailabilityStale({ availabilityExpiresAt: null }, NOW)).toBe(true);
    expect(
      isAvailabilityStale(
        { availabilityExpiresAt: new Date("2026-07-20T11:59:59.000Z") },
        NOW,
      ),
    ).toBe(true);
    expect(isAvailabilityStale({ availabilityExpiresAt: "not-a-date" as never }, NOW)).toBe(true);
  });
});
