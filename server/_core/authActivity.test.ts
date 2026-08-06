import { describe, expect, it } from "vitest";
import {
  LAST_SIGNED_IN_UPDATE_INTERVAL_MS,
  shouldRefreshLastSignedIn,
} from "./authActivity";

describe("lastSignedIn throttling", () => {
  const now = new Date("2026-08-06T12:00:00.000Z");

  it("skips a write for activity inside the throttle interval", () => {
    expect(
      shouldRefreshLastSignedIn(
        new Date(now.getTime() - LAST_SIGNED_IN_UPDATE_INTERVAL_MS + 1),
        now
      )
    ).toBe(false);
  });

  it("refreshes at the interval boundary and for an invalid timestamp", () => {
    expect(
      shouldRefreshLastSignedIn(
        new Date(now.getTime() - LAST_SIGNED_IN_UPDATE_INTERVAL_MS),
        now
      )
    ).toBe(true);
    expect(shouldRefreshLastSignedIn(new Date(Number.NaN), now)).toBe(true);
  });
});
