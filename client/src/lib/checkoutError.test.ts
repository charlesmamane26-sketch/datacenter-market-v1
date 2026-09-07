import { describe, expect, it } from "vitest";
import { describeCheckoutError } from "./checkoutError";

function trpcError(code: string, message: string) {
  return { data: { code }, message };
}

describe("describeCheckoutError", () => {
  it("rotates the idempotency key only for an expired Stripe session", () => {
    expect(
      describeCheckoutError(
        trpcError(
          "CONFLICT",
          "This Checkout Session is no longer payable. Start a new checkout attempt."
        )
      )
    ).toMatchObject({ action: "retry", resetIdempotencyKey: true });
  });

  it("routes an unavailable offer back to the catalogue without claiming expiry", () => {
    const result = describeCheckoutError(
      trpcError("CONFLICT", "This offer is no longer available.")
    );
    expect(result.action).toBe("results");
    expect(result.resetIdempotencyKey).toBeUndefined();
  });

  it("routes a finalized lead to a new request", () => {
    expect(
      describeCheckoutError(
        trpcError(
          "CONFLICT",
          "A lead in status converted cannot start a new order."
        )
      )
    ).toMatchObject({ action: "new-request" });
  });

  it("does not expose unknown server messages", () => {
    const result = describeCheckoutError(
      trpcError("INTERNAL_SERVER_ERROR", "secret detail")
    );
    expect(result.message).not.toContain("secret detail");
    expect(result.action).toBe("retry");
  });

  it("does not encourage an immediate retry after rate limiting", () => {
    const result = describeCheckoutError(
      trpcError("TOO_MANY_REQUESTS", "Too many checkout attempts")
    );
    expect(result.message).toContain("Attendez une minute");
    expect(result.action).toBeUndefined();
  });

  it("requires a reload when the accepted terms version is stale", () => {
    expect(
      describeCheckoutError(trpcError("BAD_REQUEST", "Invalid literal value"))
    ).toMatchObject({ action: "reload", actionLabel: "Recharger la page" });
  });
});
