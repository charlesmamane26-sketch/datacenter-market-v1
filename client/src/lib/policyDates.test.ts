import { describe, expect, it } from "vitest";
import {
  CONSENT_POLICY_UPDATED_AT_FR,
  CONSENT_POLICY_VERSION,
  PURCHASE_TERMS_UPDATED_AT_FR,
  PURCHASE_TERMS_VERSION,
} from "@shared/const";

describe("shared policy dates", () => {
  it("derives the visible French dates from the persisted versions", () => {
    expect(CONSENT_POLICY_VERSION).toBe("2026-07-12");
    expect(CONSENT_POLICY_UPDATED_AT_FR).toBe("12 juillet 2026");
    expect(PURCHASE_TERMS_VERSION).toBe("2026-05-27");
    expect(PURCHASE_TERMS_UPDATED_AT_FR).toBe("27 mai 2026");
  });
});
