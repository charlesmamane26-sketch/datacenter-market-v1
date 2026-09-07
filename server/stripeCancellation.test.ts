import { describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";
import type { Order } from "../drizzle/schema";
import { cancelStripeResourcesForOrder } from "./stripe";

function order(overrides: Partial<Order> = {}): Order {
  return {
    id: 42,
    stripeCheckoutSessionId: null,
    stripeSubscriptionId: null,
    stripeTerminalAt: null,
    ...overrides,
  } as Order;
}

describe("admin Stripe cancellation", () => {
  it("expires an open Checkout Session before local cancellation", async () => {
    const retrieve = vi.fn().mockResolvedValue({
      id: "cs_42",
      status: "open",
      subscription: null,
    });
    const expire = vi.fn().mockResolvedValue({ id: "cs_42", status: "expired" });
    const stripe = {
      checkout: { sessions: { retrieve, expire } },
      subscriptions: { retrieve: vi.fn(), cancel: vi.fn() },
    } as unknown as Stripe;

    await expect(
      cancelStripeResourcesForOrder(order({ stripeCheckoutSessionId: "cs_42" }), stripe),
    ).resolves.toEqual({ subscriptionId: null, action: "checkout_expired" });
    expect(expire).toHaveBeenCalledWith(
      "cs_42",
      {},
      { idempotencyKey: "admin-cancel-order:42:checkout" },
    );
  });

  it("cancels the persisted subscription with a stable idempotency key", async () => {
    const retrieve = vi.fn().mockResolvedValue({ id: "sub_42", status: "active" });
    const cancel = vi.fn().mockResolvedValue({ id: "sub_42", status: "canceled" });
    const stripe = {
      checkout: { sessions: { retrieve: vi.fn(), expire: vi.fn() } },
      subscriptions: { retrieve, cancel },
    } as unknown as Stripe;

    await expect(
      cancelStripeResourcesForOrder(order({ stripeSubscriptionId: "sub_42" }), stripe),
    ).resolves.toEqual({ subscriptionId: "sub_42", action: "subscription_cancelled" });
    expect(cancel).toHaveBeenCalledWith(
      "sub_42",
      {},
      { idempotencyKey: "admin-cancel-order:42:subscription" },
    );
  });

  it("does not contact Stripe after the local terminal guard is set", async () => {
    const stripe = {
      checkout: { sessions: { retrieve: vi.fn(), expire: vi.fn() } },
      subscriptions: { retrieve: vi.fn(), cancel: vi.fn() },
    } as unknown as Stripe;
    await expect(
      cancelStripeResourcesForOrder(
        order({
          stripeSubscriptionId: "sub_42",
          stripeTerminalAt: new Date("2026-08-06T14:00:00Z"),
        }),
        stripe,
      ),
    ).resolves.toEqual({ subscriptionId: "sub_42", action: "none" });
    expect(stripe.subscriptions.retrieve).not.toHaveBeenCalled();
  });
});
