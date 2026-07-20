import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyStripeEvent,
  buildCheckoutSessionParams,
  evaluateStripeConfiguration,
  getCheckoutSessionReferences,
  getCheckoutSessionRedirectUrl,
  getOrigin,
  getStripeSecretKeyMode,
} from "./stripe";
import {
  claimStripeEvent,
  completeStripeEvent,
  failStripeEvent,
  getLead,
  getOrder,
  getOrderByStripeCheckoutSessionId,
  getOrderByStripeSubscriptionId,
} from "./db";
import { sendOrderConfirmed, sendPaymentFailed } from "./clientNotifications";

vi.mock("./db", () => ({
  claimStripeEvent: vi.fn(),
  completeStripeEvent: vi.fn(),
  failStripeEvent: vi.fn(),
  getLead: vi.fn(),
  getOrder: vi.fn(),
  getOrderByStripeCheckoutSessionId: vi.fn(),
  getOrderByStripeSubscriptionId: vi.fn(),
}));
vi.mock("./clientNotifications", () => ({
  sendOrderConfirmed: vi.fn(),
  sendPaymentFailed: vi.fn(),
}));

const order = {
  id: 42,
  userId: 1,
  leadId: 3,
  offerId: 7,
  status: "pending",
  paymentStatus: "pending",
  stripeCheckoutSessionId: "cs_42",
  stripeSubscriptionId: null,
} as any;

let transitionPlan: any;
let currentOrder: any;

function event(type: string, object: Record<string, unknown>, id = `evt_${type}`, created = 100) {
  return { id, type, created, data: { object } } as any;
}

beforeEach(() => {
  vi.resetAllMocks();
  transitionPlan = undefined;
  currentOrder = { ...order };
  vi.mocked(claimStripeEvent).mockResolvedValue("claimed");
  vi.mocked(completeStripeEvent).mockImplementation(async (
    _eventId,
    orderId,
    eventCreated,
    eventDomain,
    build,
  ) => {
    if (orderId == null) {
      transitionPlan = null;
      return { order: null, changed: false, duplicate: false };
    }
    if (
      currentOrder[
        eventDomain === "checkout"
          ? "stripeLastCheckoutEventCreated"
          : eventDomain === "invoice"
            ? "stripeLastInvoiceEventCreated"
            : "stripeLastSubscriptionEventCreated"
      ] != null &&
      eventCreated <
        currentOrder[
          eventDomain === "checkout"
            ? "stripeLastCheckoutEventCreated"
            : eventDomain === "invoice"
              ? "stripeLastInvoiceEventCreated"
              : "stripeLastSubscriptionEventCreated"
        ]
    ) {
      transitionPlan = null;
      return { order: currentOrder, changed: false, duplicate: false };
    }
    transitionPlan = build?.(currentOrder) ?? null;
    const cursorField =
      eventDomain === "checkout"
        ? "stripeLastCheckoutEventCreated"
        : eventDomain === "invoice"
          ? "stripeLastInvoiceEventCreated"
          : "stripeLastSubscriptionEventCreated";
    currentOrder = {
      ...currentOrder,
      ...(transitionPlan?.order ?? {}),
      [cursorField]: eventCreated,
    };
    return { order: currentOrder, changed: true, duplicate: false };
  });
});

describe("Stripe configuration safety", () => {
  const configured = {
    secretKey: "sk_test_example",
    webhookSecret: "whsec_example",
    livePaymentsEnabled: false,
    publicBaseUrl: "",
    isProduction: false,
  };

  it.each([
    ["sk_test_example", "test"],
    ["rk_test_example", "test"],
    ["sk_live_example", "live"],
    ["rk_live_example", "live"],
    ["", "missing"],
    ["pk_test_example", "invalid"],
    ["sk_unknown_example", "invalid"],
  ] as const)("classifies %s as %s", (key, expected) => {
    expect(getStripeSecretKeyMode(key)).toBe(expected);
  });

  it("requires the API key and webhook signing secret as a valid pair", () => {
    expect(
      evaluateStripeConfiguration({ ...configured, webhookSecret: "" }),
    ).toEqual(
      expect.objectContaining({
        ready: false,
        mode: "test",
        issues: ["webhook_secret_missing"],
      }),
    );
    expect(
      evaluateStripeConfiguration({
        ...configured,
        secretKey: "",
        webhookSecret: "not-a-signing-secret",
      }).issues,
    ).toEqual(["secret_key_missing", "webhook_secret_invalid"]);
  });

  it("rejects an unknown API key prefix", () => {
    expect(
      evaluateStripeConfiguration({ ...configured, secretKey: "pk_test_publishable" }),
    ).toEqual(
      expect.objectContaining({
        ready: false,
        mode: "invalid",
        issues: ["secret_key_invalid"],
      }),
    );
  });

  it.each(["sk_live_example", "rk_live_example"])(
    "requires the explicit live gate for %s",
    secretKey => {
      const blocked = evaluateStripeConfiguration({ ...configured, secretKey });
      expect(blocked).toEqual(
        expect.objectContaining({
          ready: false,
          mode: "live",
          issues: ["live_payments_disabled"],
        }),
      );
      expect(
        evaluateStripeConfiguration({
          ...configured,
          secretKey,
          livePaymentsEnabled: true,
        }).ready,
      ).toBe(true);
    },
  );

  it("requires a clean HTTPS PUBLIC_BASE_URL in production", () => {
    expect(
      evaluateStripeConfiguration({ ...configured, isProduction: true }).issues,
    ).toEqual(["public_base_url_missing"]);
    expect(
      evaluateStripeConfiguration({
        ...configured,
        isProduction: true,
        publicBaseUrl: "http://app.example.com",
      }).issues,
    ).toEqual(["public_base_url_invalid"]);
    expect(
      evaluateStripeConfiguration({
        ...configured,
        isProduction: true,
        publicBaseUrl: "https://app.example.com/checkout?unsafe=true",
      }).issues,
    ).toEqual(["public_base_url_invalid"]);
    expect(
      evaluateStripeConfiguration({
        ...configured,
        isProduction: true,
        publicBaseUrl: "https://app.example.com/",
      }),
    ).toEqual(
      expect.objectContaining({ ready: true, mode: "test", issues: [] }),
    );
  });
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

  it("uses server amounts and binds metadata to both the session and subscription", () => {
    const params = buildCheckoutSessionParams(base);
    expect(params.mode).toBe("subscription");
    expect(params.metadata).toEqual({ orderId: "42" });
    expect(params.subscription_data?.metadata).toEqual({ orderId: "42" });
    expect(params.client_reference_id).toBe("42");
    expect(params.success_url).toBe("https://app.example.com/confirmation?orderId=42");
    expect(params.cancel_url).toBe("https://app.example.com/checkout?offerId=7&leadId=3");
    const items = params.line_items as any[];
    expect(items).toHaveLength(2);
    expect(items[0].price_data.currency).toBe("eur");
    expect(items[0].price_data.unit_amount).toBe(1_840_000);
    expect(items[0].price_data.recurring).toEqual({ interval: "month" });
    expect(items[0].price_data.product_data.name).toBe("H100 Cluster — monthly");
    expect(items[1].price_data.currency).toBe("eur");
    expect(items[1].price_data.unit_amount).toBe(200_000);
    expect(items[1].price_data.recurring).toBeUndefined();
    expect(items[1].price_data.product_data.name).toBe(
      "H100 Cluster — one-time setup fee",
    );
  });

  it("omits a zero setup fee", () => {
    expect(buildCheckoutSessionParams({ ...base, setupFee: "0" }).line_items).toHaveLength(1);
  });
});

describe("Checkout Session references", () => {
  it("extracts exact session, customer and subscription ids", () => {
    expect(
      getCheckoutSessionReferences({
        id: "cs_42",
        customer: { id: "cus_1" },
        subscription: { id: "sub_1", status: "active" },
        payment_intent: "pi_1",
      } as any),
    ).toEqual({
      sessionId: "cs_42",
      customerId: "cus_1",
      subscriptionId: "sub_1",
      subscriptionStatus: "active",
      paymentReference: "pi_1",
    });
  });

  it("resumes only open sessions and routes completed sessions to confirmation", () => {
    expect(
      getCheckoutSessionRedirectUrl(
        { status: "open", url: "https://checkout.stripe.test/c/pay", payment_status: "unpaid" } as any,
        42,
        "https://app.example.com/",
      ),
    ).toBe("https://checkout.stripe.test/c/pay");
    expect(
      getCheckoutSessionRedirectUrl(
        { status: "complete", url: null, payment_status: "unpaid" } as any,
        42,
        "https://app.example.com",
      ),
    ).toBe("https://app.example.com/confirmation?orderId=42");
  });

  it("routes paid sessions to confirmation and rejects expired sessions", () => {
    expect(
      getCheckoutSessionRedirectUrl(
        { status: "complete", url: null, payment_status: "paid" } as any,
        42,
        "https://app.example.com",
      ),
    ).toBe("https://app.example.com/confirmation?orderId=42");
    expect(() =>
      getCheckoutSessionRedirectUrl(
        { status: "expired", url: "https://checkout.stripe.test/c/expired", payment_status: "unpaid" } as any,
        42,
        "https://app.example.com",
      ),
    ).toThrowError(expect.objectContaining({ code: "CONFLICT" }));
  });
});

describe("applyStripeEvent journal and transitions", () => {
  it("atomically marks an exactly-bound paid Checkout Session and converts its lead", async () => {
    vi.mocked(getOrderByStripeCheckoutSessionId).mockResolvedValue(order);
    vi.mocked(getLead).mockResolvedValue({ id: 3, email: "client@example.com" } as any);
    const handled = await applyStripeEvent(
      event("checkout.session.completed", {
        id: "cs_42",
        customer: "cus_1",
        subscription: "sub_1",
        payment_status: "paid",
      }),
    );

    expect(handled).toBe(true);
    expect(claimStripeEvent).toHaveBeenCalledWith("evt_checkout.session.completed", "checkout.session.completed");
    expect(transitionPlan).toEqual({
      order: expect.objectContaining({
        paymentStatus: "succeeded",
        status: "processing",
        stripeCustomerId: "cus_1",
        stripeSubscriptionId: "sub_1",
      }),
      lead: { status: "converted", selectedOfferId: 7 },
    });
    expect(sendOrderConfirmed).toHaveBeenCalledWith("client@example.com", 42);
  });

  it("does not trust order metadata when the Checkout Session id was not persisted", async () => {
    vi.mocked(getOrderByStripeCheckoutSessionId).mockResolvedValue(null);
    expect(
      await applyStripeEvent(
        event("checkout.session.completed", {
          id: "cs_foreign",
          metadata: { orderId: "42" },
          payment_status: "paid",
        }),
      ),
    ).toBe(false);
    expect(completeStripeEvent).toHaveBeenCalledWith(
      "evt_checkout.session.completed",
      null,
      100,
      "checkout",
    );
  });

  it("acknowledges an unpaid completed session without converting the lead", async () => {
    vi.mocked(getOrderByStripeCheckoutSessionId).mockResolvedValue(order);
    await applyStripeEvent(
      event("checkout.session.completed", { id: "cs_42", payment_status: "unpaid" }),
    );
    expect(transitionPlan?.lead).toBeUndefined();
    expect(transitionPlan?.order?.paymentStatus).toBeUndefined();
  });

  it("cancels an asynchronous Checkout failure and leaves the lead unconverted", async () => {
    vi.mocked(getOrderByStripeCheckoutSessionId).mockResolvedValue(order);
    vi.mocked(getLead).mockResolvedValue({ id: 3, email: "client@example.com" } as any);
    await applyStripeEvent(
      event("checkout.session.async_payment_failed", { id: "cs_42", payment_status: "unpaid" }),
    );
    expect(transitionPlan).toEqual({
      order: expect.objectContaining({ paymentStatus: "failed", status: "cancelled" }),
    });
    expect(sendPaymentFailed).toHaveBeenCalledWith("client@example.com", 42);
  });

  it("deduplicates a processed event id before reading an order", async () => {
    vi.mocked(claimStripeEvent).mockResolvedValue("processed");
    expect(
      await applyStripeEvent(event("checkout.session.completed", { id: "cs_42", payment_status: "paid" })),
    ).toBe(true);
    expect(getOrderByStripeCheckoutSessionId).not.toHaveBeenCalled();
    expect(completeStripeEvent).not.toHaveBeenCalled();
  });

  it("marks the journal attempt failed when a transition throws", async () => {
    vi.mocked(getOrderByStripeCheckoutSessionId).mockResolvedValue(order);
    vi.mocked(completeStripeEvent).mockRejectedValue(new Error("deadlock"));
    await expect(
      applyStripeEvent(event("checkout.session.completed", { id: "cs_42", payment_status: "paid" })),
    ).rejects.toThrow("deadlock");
    expect(failStripeEvent).toHaveBeenCalledWith("evt_checkout.session.completed", expect.any(Error));
  });

  it("handles invoice.paid by subscription and repairs the lead invariant", async () => {
    vi.mocked(getOrderByStripeSubscriptionId).mockResolvedValue({
      ...order,
      stripeCheckoutSessionId: "cs_42",
      stripeSubscriptionId: "sub_1",
    } as any);
    await applyStripeEvent(
      event("invoice.paid", {
        id: "in_1",
        customer: "cus_1",
        subscription: "sub_1",
        payment_intent: "pi_1",
      }),
    );
    expect(transitionPlan.order).toEqual(
      expect.objectContaining({ paymentStatus: "succeeded", stripeSubscriptionId: "sub_1" }),
    );
    expect(transitionPlan.lead).toEqual({ status: "converted", selectedOfferId: 7 });
  });

  it("records invoice.payment_failed as a payment failure", async () => {
    vi.mocked(getOrderByStripeSubscriptionId).mockResolvedValue({
      ...order,
      stripeSubscriptionId: "sub_1",
    } as any);
    await applyStripeEvent(event("invoice.payment_failed", { id: "in_1", subscription: "sub_1" }));
    expect(transitionPlan.order).toEqual(
      expect.objectContaining({ paymentStatus: "failed", status: "cancelled" }),
    );
  });

  it("keeps invoice.payment_action_required non-terminal", async () => {
    vi.mocked(getOrderByStripeSubscriptionId).mockResolvedValue({
      ...order,
      stripeSubscriptionId: "sub_1",
    } as any);
    await applyStripeEvent(
      event("invoice.payment_action_required", { id: "in_1", subscription: "sub_1" }),
    );
    expect(transitionPlan.order).toEqual(expect.objectContaining({ paymentStatus: "pending" }));
    expect(transitionPlan.order.status).toBeUndefined();
    expect(sendPaymentFailed).not.toHaveBeenCalled();
  });

  it("ignores an older invoice failure after a newer payment success", async () => {
    vi.mocked(getOrderByStripeSubscriptionId).mockResolvedValue({
      ...order,
      stripeSubscriptionId: "sub_1",
    } as any);

    await applyStripeEvent(
      event("invoice.paid", { id: "in_1", subscription: "sub_1" }, "evt_paid_new", 200),
    );
    await applyStripeEvent(
      event("invoice.payment_failed", { id: "in_1", subscription: "sub_1" }, "evt_failed_old", 199),
    );

    expect(currentOrder.paymentStatus).toBe("succeeded");
    expect(currentOrder.status).toBe("processing");
    expect(transitionPlan).toBeNull();
  });

  it("keeps success when a failure-like invoice event has the same timestamp", async () => {
    vi.mocked(getOrderByStripeSubscriptionId).mockResolvedValue({
      ...order,
      stripeSubscriptionId: "sub_1",
    } as any);

    await applyStripeEvent(
      event("invoice.paid", { id: "in_1", subscription: "sub_1" }, "evt_paid_equal", 200),
    );
    await applyStripeEvent(
      event("invoice.payment_failed", { id: "in_1", subscription: "sub_1" }, "evt_failed_equal", 200),
    );

    expect(currentOrder.paymentStatus).toBe("succeeded");
    expect(currentOrder.status).toBe("processing");
  });

  it("does not resurrect an order after a terminal subscription event", async () => {
    vi.mocked(getOrderByStripeSubscriptionId).mockResolvedValue({
      ...order,
      stripeSubscriptionId: "sub_1",
    } as any);

    await applyStripeEvent(
      event(
        "customer.subscription.deleted",
        { id: "sub_1", customer: "cus_1", status: "canceled" },
        "evt_terminal",
        300,
      ),
    );
    await applyStripeEvent(
      event("invoice.paid", { id: "in_2", subscription: "sub_1" }, "evt_paid_late", 301),
    );

    expect(currentOrder.paymentStatus).toBe("cancelled");
    expect(currentOrder.status).toBe("cancelled");
    expect(currentOrder.stripeTerminalAt).toBeInstanceOf(Date);
  });

  it("does not let a newer subscription update suppress an older valid invoice payment", async () => {
    vi.mocked(getOrderByStripeSubscriptionId).mockResolvedValue({
      ...order,
      stripeSubscriptionId: "sub_1",
    } as any);

    await applyStripeEvent(
      event(
        "customer.subscription.updated",
        { id: "sub_1", customer: "cus_1", status: "active" },
        "evt_subscription_newer",
        201,
      ),
    );
    await applyStripeEvent(
      event("invoice.paid", { id: "in_1", subscription: "sub_1" }, "evt_invoice_older", 200),
    );

    expect(currentOrder.paymentStatus).toBe("succeeded");
    expect(currentOrder.status).toBe("processing");
  });

  it("treats a paused subscription as recoverable", async () => {
    vi.mocked(getOrderByStripeSubscriptionId).mockResolvedValue({
      ...order,
      stripeSubscriptionId: "sub_1",
    } as any);

    await applyStripeEvent(
      event(
        "customer.subscription.updated",
        { id: "sub_1", customer: "cus_1", status: "paused" },
        "evt_paused",
        250,
      ),
    );

    expect(currentOrder.paymentStatus).toBe("pending");
    expect(currentOrder.stripeTerminalAt).toBeUndefined();
  });

  it("tracks subscription updates and terminal deletion", async () => {
    vi.mocked(getOrderByStripeSubscriptionId).mockResolvedValue({
      ...order,
      stripeSubscriptionId: "sub_1",
    } as any);
    await applyStripeEvent(
      event("customer.subscription.updated", {
        id: "sub_1",
        customer: "cus_1",
        status: "past_due",
      }),
    );
    expect(transitionPlan.order).toEqual(
      expect.objectContaining({ stripeSubscriptionStatus: "past_due", paymentStatus: "failed" }),
    );

    await applyStripeEvent(
      event("customer.subscription.deleted", {
        id: "sub_1",
        customer: "cus_1",
        status: "canceled",
      }, "evt_deleted"),
    );
    expect(transitionPlan.order).toEqual(
      expect.objectContaining({ stripeSubscriptionStatus: "canceled", paymentStatus: "cancelled", status: "cancelled" }),
    );
  });

  it("ignores unrelated event types without journaling them", async () => {
    expect(await applyStripeEvent(event("payment_intent.created", {}))).toBe(false);
    expect(claimStripeEvent).not.toHaveBeenCalled();
  });
});

describe("getOrigin", () => {
  it("prefers the Origin header", () => {
    expect(getOrigin({ headers: { origin: "https://a.com" } } as any)).toBe("https://a.com");
  });

  it("builds from forwarded protocol and host outside production", () => {
    expect(getOrigin({ headers: { "x-forwarded-proto": "https", host: "b.com" } } as any)).toBe(
      "https://b.com",
    );
  });
});
