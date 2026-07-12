import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildCheckoutSessionParams, applyStripeEvent, getOrigin } from "./stripe";
import { updateOrder, getOrder, updateLead } from "./db";

vi.mock("./db", () => ({ updateOrder: vi.fn(), getOrder: vi.fn(), updateLead: vi.fn() }));

beforeEach(() => {
  vi.resetAllMocks();
});

describe("buildCheckoutSessionParams", () => {
  const base = {
    orderId: 42,
    leadId: 3,
    offerId: 7,
    offerName: "H100 Cluster",
    monthlyPrice: "18400.00",
    setupFee: "2000.00",
    origin: "https://app.example.com",
  };

  it("computes amounts in cents and wires subscription mode + metadata + URLs", () => {
    const p = buildCheckoutSessionParams(base);
    expect(p.mode).toBe("subscription");
    expect(p.metadata).toEqual({ orderId: "42" });
    expect(p.client_reference_id).toBe("42");
    expect(p.success_url).toBe("https://app.example.com/confirmation?orderId=42");
    expect(p.cancel_url).toBe("https://app.example.com/checkout?offerId=7&leadId=3");

    const items = p.line_items as any[];
    expect(items).toHaveLength(2);
    expect(items[0].price_data.unit_amount).toBe(1840000); // 18400.00 EUR -> cents
    expect(items[0].price_data.recurring).toEqual({ interval: "month" });
    expect(items[1].price_data.unit_amount).toBe(200000); // 2000.00 setup
    expect(items[1].price_data.recurring).toBeUndefined(); // one-time
  });

  it("omits the setup line item when there is no setup fee", () => {
    const p = buildCheckoutSessionParams({ ...base, setupFee: "0" });
    expect(p.line_items).toHaveLength(1);
  });
});

describe("applyStripeEvent", () => {
  it("marks the order paid and converts the lead on checkout.session.completed", async () => {
    vi.mocked(getOrder).mockResolvedValue({ id: 42, leadId: 3, offerId: 7 } as any);
    const event = {
      type: "checkout.session.completed",
      data: { object: { metadata: { orderId: "42" }, subscription: "sub_123" } },
    } as any;
    const handled = await applyStripeEvent(event);
    expect(handled).toBe(true);
    expect(updateOrder).toHaveBeenCalledWith(42, {
      paymentStatus: "succeeded",
      status: "processing",
      stripePaymentIntentId: "sub_123",
    });
    // The lead is converted only now, on payment success.
    expect(updateLead).toHaveBeenCalledWith(3, { status: "converted", selectedOfferId: 7 });
  });

  it("falls back to client_reference_id and payment_intent", async () => {
    vi.mocked(getOrder).mockResolvedValue({ id: 99, leadId: 5, offerId: 8 } as any);
    const event = {
      type: "checkout.session.completed",
      data: { object: { client_reference_id: "99", payment_intent: "pi_1" } },
    } as any;
    await applyStripeEvent(event);
    expect(updateOrder).toHaveBeenCalledWith(
      99,
      expect.objectContaining({ stripePaymentIntentId: "pi_1" }),
    );
  });

  it("ignores unrelated event types", async () => {
    const handled = await applyStripeEvent({ type: "payment_intent.created", data: { object: {} } } as any);
    expect(handled).toBe(false);
    expect(updateOrder).not.toHaveBeenCalled();
  });

  it("is idempotent: a redelivered event for an already-paid order is a no-op", async () => {
    vi.mocked(getOrder).mockResolvedValue({
      id: 42,
      leadId: 3,
      offerId: 7,
      paymentStatus: "succeeded",
      status: "provisioning",
    } as any);
    const event = {
      type: "checkout.session.completed",
      data: { object: { metadata: { orderId: "42" }, subscription: "sub_123" } },
    } as any;
    const handled = await applyStripeEvent(event);
    expect(handled).toBe(true); // acknowledged so Stripe stops retrying
    expect(updateOrder).not.toHaveBeenCalled(); // later transitions are not clobbered
    expect(updateLead).not.toHaveBeenCalled();
  });

  it("ignores events referencing an unknown order", async () => {
    vi.mocked(getOrder).mockResolvedValue(null as any);
    const event = {
      type: "checkout.session.completed",
      data: { object: { metadata: { orderId: "404" } } },
    } as any;
    const handled = await applyStripeEvent(event);
    expect(handled).toBe(false);
    expect(updateOrder).not.toHaveBeenCalled();
  });

  it("ignores sessions without an order reference", async () => {
    const handled = await applyStripeEvent({
      type: "checkout.session.completed",
      data: { object: { id: "cs_1" } },
    } as any);
    expect(handled).toBe(false);
    expect(updateOrder).not.toHaveBeenCalled();
  });
});

describe("getOrigin", () => {
  it("prefers the Origin header", () => {
    expect(getOrigin({ headers: { origin: "https://a.com" } } as any)).toBe("https://a.com");
  });

  it("builds from x-forwarded-proto + host when there is no Origin", () => {
    expect(getOrigin({ headers: { "x-forwarded-proto": "https", host: "b.com" } } as any)).toBe(
      "https://b.com",
    );
  });
});
