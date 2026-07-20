import { describe, expect, it } from "vitest";
import { parseStaleOrderHours } from "./cancel-stale-orders";
import { parseRetentionDays } from "./purge-leads";

describe("maintenance duration validation", () => {
  it("uses safe defaults and accepts bounded positive integers", () => {
    expect(parseRetentionDays(undefined)).toBe(730);
    expect(parseRetentionDays(" 365 ")).toBe(365);
    expect(parseRetentionDays("3650")).toBe(3_650);
    expect(parseStaleOrderHours(undefined)).toBe(24);
    expect(parseStaleOrderHours(" 48 ")).toBe(48);
    expect(parseStaleOrderHours("720")).toBe(720);
  });

  it.each(["", "0", "-1", "1.5", "NaN", "Infinity", "3651"])(
    "rejects an unsafe lead retention value: %s",
    value => {
      expect(() => parseRetentionDays(value)).toThrow();
    }
  );

  it.each(["", "0", "-1", "1.5", "NaN", "Infinity", "721"])(
    "rejects an unsafe stale-order value: %s",
    value => {
      expect(() => parseStaleOrderHours(value)).toThrow();
    }
  );
});
