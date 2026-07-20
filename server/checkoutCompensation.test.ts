import { describe, expect, it } from "vitest";
import type { Order } from "../drizzle/schema";
import { isExpiredCheckoutReleasable, isFailedCheckoutCompensatable } from "./db";

function pendingUnboundOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 42,
    userId: 1,
    leadId: 3,
    offerId: 7,
    providerId: 2,
    status: "pending",
    totalAmount: "20400.00",
    setupFee: "2000.00",
    monthlyRecurring: "18400.00",
    stripePaymentIntentId: null,
    stripeCheckoutSessionId: null,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    stripeSubscriptionStatus: null,
    stripeLastCheckoutEventCreated: null,
    stripeLastInvoiceEventCreated: null,
    stripeLastSubscriptionEventCreated: null,
    stripeTerminalAt: null,
    paymentStatus: "pending",
    checkoutIdempotencyKey: "checkout-compensation-0001",
    termsAcceptedAt: new Date("2026-07-20T10:00:00Z"),
    termsVersion: "2026-07-20",
    provisioningStartedAt: null,
    provisioningCompletedAt: null,
    contractUrl: null,
    createdAt: new Date("2026-07-20T10:00:00Z"),
    updatedAt: new Date("2026-07-20T10:00:00Z"),
    ...overrides,
  };
}

const expected = {
  orderId: 42,
  userId: 1,
  idempotencyKey: "checkout-compensation-0001",
};

describe("failed checkout compensation guard", () => {
  it("allows only the exact pending, unpaid and Stripe-unbound aggregate", () => {
    expect(isFailedCheckoutCompensatable(pendingUnboundOrder(), expected)).toBe(true);
  });

  it.each([
    { stripeCheckoutSessionId: "cs_test_42" },
    { stripePaymentIntentId: "pi_42" },
    { stripeCustomerId: "cus_42" },
    { stripeSubscriptionId: "sub_42" },
    { stripeSubscriptionStatus: "incomplete" },
    { stripeLastCheckoutEventCreated: 1_721_469_600 },
    { stripeLastInvoiceEventCreated: 1_721_469_600 },
    { stripeLastSubscriptionEventCreated: 1_721_469_600 },
    { stripeTerminalAt: new Date("2026-07-20T10:01:00Z") },
  ] satisfies Partial<Order>[])('preserves an aggregate with Stripe state: $stripeCheckoutSessionId$stripePaymentIntentId$stripeCustomerId$stripeSubscriptionId$stripeSubscriptionStatus$stripeLastCheckoutEventCreated$stripeLastInvoiceEventCreated$stripeLastSubscriptionEventCreated$stripeTerminalAt', patch => {
    expect(isFailedCheckoutCompensatable(pendingUnboundOrder(patch), expected)).toBe(false);
  });

  it.each([
    { status: "cancelled" as const },
    { status: "processing" as const },
    { paymentStatus: "succeeded" as const },
    { paymentStatus: "failed" as const },
  ])("preserves a non-compensatable lifecycle state: %o", patch => {
    expect(isFailedCheckoutCompensatable(pendingUnboundOrder(patch), expected)).toBe(false);
  });

  it("rejects a stale request identity", () => {
    expect(
      isFailedCheckoutCompensatable(pendingUnboundOrder(), {
        ...expected,
        idempotencyKey: "checkout-another-request-0001",
      }),
    ).toBe(false);
  });
});

describe("expired linked checkout release guard", () => {
  const releaseExpected = {
    orderId: 42,
    userId: 1,
    idempotencyKey: "checkout-compensation-0001",
    checkoutSessionId: "cs_expired_42",
  };

  it("allows the exact linked pending/unpaid order", () => {
    expect(
      isExpiredCheckoutReleasable(
        pendingUnboundOrder({ stripeCheckoutSessionId: "cs_expired_42" }),
        releaseExpected,
      ),
    ).toBe(true);
  });

  it.each([
    { order: { stripeCheckoutSessionId: "cs_other" } },
    { order: { status: "processing" as const } },
    { order: { paymentStatus: "succeeded" as const } },
    { expected: { userId: 2 } },
    { expected: { idempotencyKey: "checkout-another-request-0001" } },
  ])("preserves a raced or mismatched order: %o", ({ order = {}, expected: patch = {} }) => {
    expect(
      isExpiredCheckoutReleasable(
        pendingUnboundOrder({ stripeCheckoutSessionId: "cs_expired_42", ...order }),
        { ...releaseExpected, ...patch },
      ),
    ).toBe(false);
  });
});
