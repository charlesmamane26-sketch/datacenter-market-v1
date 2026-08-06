import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import {
  compensateFailedCheckout,
  createCheckoutOrderAtomic,
  createProvisioningEventAndAdvanceOrder,
  createLead,
  deleteLead,
  getAllLeads,
  getAllOffers,
  getAllOrders,
  getLead,
  getOffer,
  getOrder,
  getOrderByCheckoutIdempotencyKey,
  linkOrderStripeReferences,
  releaseExpiredCheckout,
  ensureCheckoutOrderReservation,
  transitionOrderStatus,
  updateOrderPaymentStatusAtomic,
  updateLead,
  updateOrder,
} from "./db";
import {
  createCheckoutSession,
  getCheckoutSessionReferences,
  getStripe,
  retrieveCheckoutSession,
  cancelStripeResourcesForOrder,
} from "./stripe";
import { signLeadClaim, verifyLeadClaim } from "./leadClaim";
import { __resetRateLimit } from "./rateLimit";
import { OrderLifecycleError } from "./orderLifecycle";
import type { TrpcContext } from "./_core/context";
import {
  CONSENT_POLICY_VERSION,
  PURCHASE_TERMS_VERSION,
} from "@shared/const";

// Unit-test authorization & pricing logic without a real database by mocking the db layer.
vi.mock("./db", () => ({
  createLead: vi.fn(),
  deleteLead: vi.fn(),
  getLead: vi.fn(),
  updateLead: vi.fn(),
  getAllLeads: vi.fn(),
  getAllOffers: vi.fn(),
  getOffer: vi.fn(),
  createOrder: vi.fn(),
  getOrder: vi.fn(),
  getOrdersByUser: vi.fn(),
  getAllOrders: vi.fn(),
  updateOrder: vi.fn(),
  getProvisioningEventsByOrder: vi.fn(),
  createProvisioningEvent: vi.fn(),
  createProvisioningEventAndAdvanceOrder: vi.fn(),
  getLatestMetricsForOrder: vi.fn(),
  compensateFailedCheckout: vi.fn(),
  createCheckoutOrderAtomic: vi.fn(),
  getOrderByCheckoutIdempotencyKey: vi.fn(),
  linkOrderStripeReferences: vi.fn(),
  releaseExpiredCheckout: vi.fn(),
  ensureCheckoutOrderReservation: vi.fn(),
  transitionOrderStatus: vi.fn(),
  updateOrderPaymentStatusAtomic: vi.fn(),
  CheckoutConflictError: class CheckoutConflictError extends Error {},
}));

vi.mock("./stripe", async importOriginal => {
  const actual = await importOriginal<typeof import("./stripe")>();
  return {
    ...actual,
    getStripe: vi.fn(),
    createCheckoutSession: vi.fn(),
    getCheckoutSessionReferences: vi.fn(),
    retrieveCheckoutSession: vi.fn(),
    cancelStripeResourcesForOrder: vi.fn(),
  };
});

type SessionUser = NonNullable<TrpcContext["user"]>;

function makeUser(id: number, role: "user" | "admin" = "user"): SessionUser {
  return {
    id,
    openId: `user-${id}`,
    name: `User ${id}`,
    email: `user${id}@example.com`,
    loginMethod: "manus",
    role,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
}

function ctxFor(user: TrpcContext["user"]): TrpcContext {
  return {
    user,
    req: {
      protocol: "https",
      headers: { origin: "https://test.local" },
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getStripe).mockReturnValue(null);
  vi.mocked(ensureCheckoutOrderReservation).mockResolvedValue({ id: 42 } as any);
  vi.mocked(cancelStripeResourcesForOrder).mockResolvedValue({
    subscriptionId: null,
    action: "none",
  });
  // enforceRateLimit is NOT mocked here (only ./db is), so reset the in-memory
  // limiter between tests to keep per-user/IP counters deterministic.
  __resetRateLimit();
});

describe("orders.get authorization (IDOR contract)", () => {
  it("rejects unauthenticated callers", async () => {
    const caller = appRouter.createCaller(ctxFor(null));
    await expect(caller.orders.get({ id: 1 })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("lets an owner read their own order", async () => {
    const order = { id: 10, userId: 1 };
    vi.mocked(getOrder).mockResolvedValue(order as any);
    const caller = appRouter.createCaller(ctxFor(makeUser(1)));
    await expect(caller.orders.get({ id: 10 })).resolves.toEqual(order);
  });

  it("hides another user's order as NOT_FOUND", async () => {
    vi.mocked(getOrder).mockResolvedValue({ id: 10, userId: 2 } as any);
    const caller = appRouter.createCaller(ctxFor(makeUser(1)));
    await expect(caller.orders.get({ id: 10 })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("lets an admin read any order", async () => {
    const order = { id: 10, userId: 2 };
    vi.mocked(getOrder).mockResolvedValue(order as any);
    const caller = appRouter.createCaller(ctxFor(makeUser(99, "admin")));
    await expect(caller.orders.get({ id: 10 })).resolves.toEqual(order);
  });

  it("returns NOT_FOUND when the order is missing", async () => {
    vi.mocked(getOrder).mockResolvedValue(null as any);
    const caller = appRouter.createCaller(ctxFor(makeUser(1)));
    await expect(caller.orders.get({ id: 404 })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

describe("leads.get authorization", () => {
  it("hides another user's lead as NOT_FOUND", async () => {
    vi.mocked(getLead).mockResolvedValue({ id: 5, userId: 2 } as any);
    const caller = appRouter.createCaller(ctxFor(makeUser(1)));
    await expect(caller.leads.get({ id: 5 })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("lets the owner read their own lead", async () => {
    const lead = { id: 5, userId: 1 };
    vi.mocked(getLead).mockResolvedValue(lead as any);
    const caller = appRouter.createCaller(ctxFor(makeUser(1)));
    await expect(caller.leads.get({ id: 5 })).resolves.toEqual(lead);
  });

  it("keeps anonymous leads (userId null) admin-only", async () => {
    vi.mocked(getLead).mockResolvedValue({ id: 5, userId: null } as any);

    const user = appRouter.createCaller(ctxFor(makeUser(1)));
    await expect(user.leads.get({ id: 5 })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });

    const admin = appRouter.createCaller(ctxFor(makeUser(99, "admin")));
    await expect(admin.leads.get({ id: 5 })).resolves.toMatchObject({ id: 5 });
  });
});

describe("leads.delete authorization (RGPD erasure)", () => {
  it("lets an admin delete a lead", async () => {
    vi.mocked(deleteLead).mockResolvedValue(undefined as any);
    const caller = appRouter.createCaller(ctxFor(makeUser(99, "admin")));
    await expect(caller.leads.delete({ id: 5 })).resolves.toEqual({
      success: true,
    });
    expect(deleteLead).toHaveBeenCalledWith(5);
  });

  it("forbids a non-admin", async () => {
    const caller = appRouter.createCaller(ctxFor(makeUser(1)));
    await expect(caller.leads.delete({ id: 5 })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(deleteLead).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated callers", async () => {
    const caller = appRouter.createCaller(ctxFor(null));
    await expect(caller.leads.delete({ id: 5 })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});

const STRIPE_CHECKOUT_URL = "https://checkout.stripe.test/session/cs_test_42";

function enableStripeCheckout() {
  vi.mocked(getStripe).mockReturnValue({} as any);
  const session = {
    id: "cs_test_42",
    url: STRIPE_CHECKOUT_URL,
    status: "open",
    payment_status: "unpaid",
    customer: null,
    subscription: null,
    payment_intent: null,
  } as any;
  vi.mocked(createCheckoutSession).mockResolvedValue(session);
  vi.mocked(retrieveCheckoutSession).mockResolvedValue(session);
  vi.mocked(getCheckoutSessionReferences).mockReturnValue({
    sessionId: "cs_test_42",
    customerId: null,
    subscriptionId: null,
    subscriptionStatus: null,
    paymentReference: "cs_test_42",
  });
}

function persistedCheckoutOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 42,
    userId: 1,
    leadId: 3,
    offerId: 7,
    totalAmount: "18400.00",
    setupFee: "0",
    monthlyRecurring: "18400.00",
    status: "pending",
    paymentStatus: "pending",
    stripeCheckoutSessionId: null,
    ...overrides,
  } as any;
}

function checkoutInput(idempotencyKey: string, claimToken?: string) {
  return {
    leadId: 3,
    offerId: 7,
    claimToken,
    termsAccepted: true as const,
    termsVersion: PURCHASE_TERMS_VERSION as typeof PURCHASE_TERMS_VERSION,
    idempotencyKey,
  };
}

describe("orders.checkout pricing (server-side, ignores client)", () => {
  it("derives amounts from the offer and returns the new order id", async () => {
    enableStripeCheckout();
    vi.mocked(getOffer).mockResolvedValue({
      id: 7,
      providerId: 2,
      name: "H100 Cluster",
      monthlyPrice: "18400.00",
      setupFee: "2000.00",
    } as any);
    vi.mocked(getLead).mockResolvedValue({ id: 3, userId: 1 } as any);
    vi.mocked(createCheckoutOrderAtomic).mockResolvedValue({
      order: persistedCheckoutOrder({
        totalAmount: "20400.00",
        setupFee: "2000.00",
      }),
      created: true,
    } as any);

    const caller = appRouter.createCaller(ctxFor(makeUser(1)));
    const result = await caller.orders.checkout({
      ...checkoutInput("checkout-pricing-test-0001"),
      // Unknown fields are discarded by the input schema. Prices always come from the offer.
      monthlyRecurring: "0.01",
      setupFee: "0.00",
      totalAmount: "0.01",
    } as any);

    expect(createCheckoutOrderAtomic).toHaveBeenCalledWith(
      expect.objectContaining({
        order: expect.objectContaining({
          userId: 1,
          leadId: 3,
          offerId: 7,
          providerId: 2,
          monthlyRecurring: "18400.00",
          setupFee: "2000.00",
          totalAmount: "20400.00",
          status: "pending",
          paymentStatus: "pending",
          checkoutIdempotencyKey: "checkout-pricing-test-0001",
          termsAcceptedAt: expect.any(Date),
        }),
        expectedLeadUserId: 1,
      })
    );
    const atomicInput = vi.mocked(createCheckoutOrderAtomic).mock.calls[0][0];
    expect(atomicInput.events).toHaveLength(5);
    expect(atomicInput.events[0]).toMatchObject({
      eventType: "order_received",
      status: "completed",
    });
    expect(createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 42,
        monthlyPrice: "18400.00",
        setupFee: "2000.00",
      }),
      "checkout:1:checkout-pricing-test-0001"
    );
    expect(linkOrderStripeReferences).toHaveBeenCalledWith(
      42,
      expect.objectContaining({ checkoutSessionId: "cs_test_42" })
    );
    expect(result).toEqual({ orderId: 42, url: STRIPE_CHECKOUT_URL });
    // Checkout remains pending: only a verified Stripe webhook may mark it paid/converted.
    expect(updateOrder).not.toHaveBeenCalled();
    // Lead claim + "offered" transition happen inside the same DB transaction as the order/events.
    expect(updateLead).not.toHaveBeenCalled();
  });

  it("rejects an unknown offer", async () => {
    enableStripeCheckout();
    vi.mocked(getOffer).mockResolvedValue(null as any);
    const caller = appRouter.createCaller(ctxFor(makeUser(1)));
    await expect(
      caller.orders.checkout({
        ...checkoutInput("checkout-unknown-offer-0001"),
        offerId: 999,
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(createCheckoutOrderAtomic).not.toHaveBeenCalled();
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });

  it("rejects a legacy offer without a supplier snapshot", async () => {
    enableStripeCheckout();
    vi.mocked(getOffer).mockResolvedValue({
      id: 7,
      providerId: null,
      name: "Legacy offer",
      monthlyPrice: "100.00",
      setupFee: "0",
    } as any);
    const caller = appRouter.createCaller(ctxFor(makeUser(1)));

    await expect(
      caller.orders.checkout(checkoutInput("checkout-no-provider-0001")),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(createCheckoutOrderAtomic).not.toHaveBeenCalled();
  });
});

describe("orders.checkout linked Session retry", () => {
  it("retrieves the bound Stripe Session without revalidating expired inventory", async () => {
    enableStripeCheckout();
    vi.mocked(getOrderByCheckoutIdempotencyKey).mockResolvedValue(
      persistedCheckoutOrder({ stripeCheckoutSessionId: "cs_test_42" }),
    );
    // Once the immutable Session is bound, catalogue availability is irrelevant
    // to an idempotent retry and this mock must never be consulted.
    vi.mocked(getOffer).mockResolvedValue(null as any);
    const caller = appRouter.createCaller(ctxFor(makeUser(1)));

    await expect(
      caller.orders.checkout(checkoutInput("checkout-linked-session-0001")),
    ).resolves.toEqual({ orderId: 42, url: STRIPE_CHECKOUT_URL });

    expect(retrieveCheckoutSession).toHaveBeenCalledWith("cs_test_42");
    expect(getOffer).not.toHaveBeenCalled();
    expect(createCheckoutSession).not.toHaveBeenCalled();
    expect(createCheckoutOrderAtomic).not.toHaveBeenCalled();
  });

  it("releases an explicitly expired Session and returns CONFLICT for key rotation", async () => {
    enableStripeCheckout();
    vi.mocked(getOrderByCheckoutIdempotencyKey).mockResolvedValue(
      persistedCheckoutOrder({ stripeCheckoutSessionId: "cs_test_42" }),
    );
    vi.mocked(retrieveCheckoutSession).mockResolvedValue({
      id: "cs_test_42",
      url: null,
      status: "expired",
      payment_status: "unpaid",
    } as any);
    vi.mocked(releaseExpiredCheckout).mockResolvedValue("released");
    const caller = appRouter.createCaller(ctxFor(makeUser(1)));

    await expect(
      caller.orders.checkout(checkoutInput("checkout-expired-session-0001")),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    expect(releaseExpiredCheckout).toHaveBeenCalledWith({
      orderId: 42,
      userId: 1,
      idempotencyKey: "checkout-expired-session-0001",
      checkoutSessionId: "cs_test_42",
    });
    expect(linkOrderStripeReferences).not.toHaveBeenCalled();
  });

  it("does not release the order when Session retrieval fails ambiguously", async () => {
    enableStripeCheckout();
    vi.mocked(getOrderByCheckoutIdempotencyKey).mockResolvedValue(
      persistedCheckoutOrder({ stripeCheckoutSessionId: "cs_test_42" }),
    );
    vi.mocked(retrieveCheckoutSession).mockRejectedValue(new Error("Stripe network timeout"));
    const caller = appRouter.createCaller(ctxFor(makeUser(1)));

    await expect(
      caller.orders.checkout(checkoutInput("checkout-retrieve-timeout-0001")),
    ).rejects.toThrow("Stripe network timeout");

    expect(releaseExpiredCheckout).not.toHaveBeenCalled();
    expect(linkOrderStripeReferences).not.toHaveBeenCalled();
  });

  it("keeps the confirmation path for a complete Session with deferred payment", async () => {
    enableStripeCheckout();
    vi.mocked(getOrderByCheckoutIdempotencyKey).mockResolvedValue(
      persistedCheckoutOrder({ stripeCheckoutSessionId: "cs_test_42" }),
    );
    vi.mocked(retrieveCheckoutSession).mockResolvedValue({
      id: "cs_test_42",
      url: null,
      status: "complete",
      payment_status: "unpaid",
      customer: null,
      subscription: null,
      payment_intent: null,
    } as any);
    const caller = appRouter.createCaller(ctxFor(makeUser(1)));

    await expect(
      caller.orders.checkout(checkoutInput("checkout-complete-unpaid-0001")),
    ).resolves.toEqual({
      orderId: 42,
      url: "https://test.local/confirmation?orderId=42",
    });

    expect(releaseExpiredCheckout).not.toHaveBeenCalled();
    expect(linkOrderStripeReferences).toHaveBeenCalledOnce();
  });
});

describe("orders.checkout failure compensation", () => {
  const offer = {
    id: 7,
    providerId: 2,
    name: "H100 Cluster",
    monthlyPrice: "18400.00",
    setupFee: "2000.00",
  } as any;

  beforeEach(() => {
    enableStripeCheckout();
    vi.mocked(getOffer).mockResolvedValue(offer);
    vi.mocked(getLead).mockResolvedValue({
      id: 3,
      userId: 1,
      status: "qualified",
      selectedOfferId: null,
    } as any);
    vi.mocked(createCheckoutOrderAtomic).mockResolvedValue({
      order: persistedCheckoutOrder({ setupFee: "2000.00", totalAmount: "20400.00" }),
      created: true,
      // Simulate a concurrent lead update after the authorization read. The
      // transaction-locked snapshot, not getLead's stale value, must be restored.
      previousLeadStatus: "offered",
      previousSelectedOfferId: 6,
    } as any);
    vi.mocked(compensateFailedCheckout).mockResolvedValue("compensated");
  });

  it("uses the locked atomic snapshot when inventory disappears before Stripe", async () => {
    vi.mocked(getOffer).mockResolvedValueOnce(offer).mockResolvedValueOnce(null as any);
    const caller = appRouter.createCaller(ctxFor(makeUser(1)));

    await expect(
      caller.orders.checkout(checkoutInput("checkout-compensate-stock-0001")),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    expect(createCheckoutSession).not.toHaveBeenCalled();
    expect(compensateFailedCheckout).toHaveBeenCalledWith({
      orderId: 42,
      userId: 1,
      idempotencyKey: "checkout-compensate-stock-0001",
      previousLeadStatus: "offered",
      previousSelectedOfferId: 6,
    });
  });

  it("compensates a Stripe Session creation failure without masking it", async () => {
    vi.mocked(createCheckoutSession).mockRejectedValueOnce(new Error("Stripe unavailable"));
    const caller = appRouter.createCaller(ctxFor(makeUser(1)));

    await expect(
      caller.orders.checkout(checkoutInput("checkout-compensate-stripe-0001")),
    ).rejects.toThrow("Stripe unavailable");

    expect(compensateFailedCheckout).toHaveBeenCalledOnce();
    expect(linkOrderStripeReferences).not.toHaveBeenCalled();
  });

  it("compensates when the Stripe Session could not be linked locally", async () => {
    vi.mocked(linkOrderStripeReferences).mockRejectedValueOnce(new Error("Database unavailable"));
    const caller = appRouter.createCaller(ctxFor(makeUser(1)));

    await expect(
      caller.orders.checkout(checkoutInput("checkout-compensate-link-0001")),
    ).rejects.toThrow("Database unavailable");

    expect(createCheckoutSession).toHaveBeenCalledOnce();
    expect(compensateFailedCheckout).toHaveBeenCalledOnce();
  });

  it("does not compensate an aggregate returned by a concurrent idempotent creator", async () => {
    vi.mocked(createCheckoutOrderAtomic).mockResolvedValueOnce({
      order: persistedCheckoutOrder(),
      created: false,
    } as any);
    vi.mocked(createCheckoutSession).mockRejectedValueOnce(new Error("Stripe unavailable"));
    const caller = appRouter.createCaller(ctxFor(makeUser(1)));

    await expect(
      caller.orders.checkout(checkoutInput("checkout-concurrent-owner-0001")),
    ).rejects.toThrow("Stripe unavailable");

    expect(compensateFailedCheckout).not.toHaveBeenCalled();
  });

  it("does not compensate an order that already existed before this request", async () => {
    vi.mocked(getOrderByCheckoutIdempotencyKey).mockResolvedValueOnce(persistedCheckoutOrder());
    vi.mocked(createCheckoutSession).mockRejectedValueOnce(new Error("Stripe unavailable"));
    const caller = appRouter.createCaller(ctxFor(makeUser(1)));

    await expect(
      caller.orders.checkout(checkoutInput("checkout-existing-order-0001")),
    ).rejects.toThrow("Stripe unavailable");

    expect(createCheckoutOrderAtomic).not.toHaveBeenCalled();
    expect(compensateFailedCheckout).not.toHaveBeenCalled();
  });
});

describe("orders.checkout lead ownership (IDOR contract)", () => {
  beforeEach(() => {
    enableStripeCheckout();
    vi.mocked(getOffer).mockResolvedValue({
      id: 7,
      providerId: 2,
      name: "H100 Cluster",
      monthlyPrice: "18400.00",
      setupFee: "0",
    } as any);
    vi.mocked(createCheckoutOrderAtomic).mockResolvedValue({
      order: persistedCheckoutOrder(),
      created: true,
    } as any);
  });

  it("hides another user's lead as NOT_FOUND and creates nothing", async () => {
    vi.mocked(getLead).mockResolvedValue({ id: 3, userId: 2 } as any);
    const caller = appRouter.createCaller(ctxFor(makeUser(1)));
    await expect(
      caller.orders.checkout(checkoutInput("checkout-foreign-lead-0001"))
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(createCheckoutOrderAtomic).not.toHaveBeenCalled();
    expect(createCheckoutSession).not.toHaveBeenCalled();
    expect(updateLead).not.toHaveBeenCalled();
  });

  it("claims an anonymous lead (userId null) with a valid claim token", async () => {
    vi.mocked(getLead).mockResolvedValue({ id: 3, userId: null } as any);
    const caller = appRouter.createCaller(ctxFor(makeUser(1)));
    await expect(
      caller.orders.checkout(
        checkoutInput("checkout-claim-lead-0001", signLeadClaim(3))
      )
    ).resolves.toEqual({ orderId: 42, url: STRIPE_CHECKOUT_URL });
    expect(createCheckoutOrderAtomic).toHaveBeenCalledWith(
      expect.objectContaining({
        order: expect.objectContaining({ userId: 1, leadId: 3, offerId: 7 }),
        expectedLeadUserId: null,
      })
    );
  });

  it("refuses to claim an anonymous lead without a valid claim token (IDOR fix)", async () => {
    vi.mocked(getLead).mockResolvedValue({ id: 3, userId: null } as any);
    const caller = appRouter.createCaller(ctxFor(makeUser(1)));
    // No token: an attacker enumerating lead IDs cannot claim/hijack the lead.
    await expect(
      caller.orders.checkout(checkoutInput("checkout-missing-claim-0001"))
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    // Wrong token (e.g. computed for a different lead) is rejected too.
    await expect(
      caller.orders.checkout(
        checkoutInput("checkout-wrong-claim-0001", signLeadClaim(999))
      )
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(createCheckoutOrderAtomic).not.toHaveBeenCalled();
    expect(createCheckoutSession).not.toHaveBeenCalled();
    expect(updateLead).not.toHaveBeenCalled();
  });

  it("keeps the existing owner on an owned lead", async () => {
    vi.mocked(getLead).mockResolvedValue({ id: 3, userId: 1 } as any);
    const caller = appRouter.createCaller(ctxFor(makeUser(1)));
    await expect(
      caller.orders.checkout(checkoutInput("checkout-owned-lead-0001"))
    ).resolves.toEqual({ orderId: 42, url: STRIPE_CHECKOUT_URL });
    expect(createCheckoutOrderAtomic).toHaveBeenCalledWith(
      expect.objectContaining({ expectedLeadUserId: 1 })
    );
  });
});

describe("leads.update authorization (admin-only)", () => {
  it("forbids a regular user", async () => {
    const caller = appRouter.createCaller(ctxFor(makeUser(1)));
    await expect(
      caller.leads.update({ id: 5, status: "rejected" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(updateLead).not.toHaveBeenCalled();
  });

  it("lets an admin update any lead", async () => {
    vi.mocked(updateLead).mockResolvedValue(undefined as any);
    vi.mocked(getLead).mockResolvedValue({ id: 5, status: "rejected" } as any);
    const caller = appRouter.createCaller(ctxFor(makeUser(99, "admin")));
    await expect(
      caller.leads.update({ id: 5, status: "rejected" })
    ).resolves.toMatchObject({
      id: 5,
    });
    expect(updateLead).toHaveBeenCalledWith(5, {
      status: "rejected",
      selectedOfferId: undefined,
    });
  });

  it("reserves the converted transition to the Stripe webhook", async () => {
    const caller = appRouter.createCaller(ctxFor(makeUser(99, "admin")));
    await expect(
      caller.leads.update({ id: 5, status: "converted" } as any)
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(updateLead).not.toHaveBeenCalled();
  });
});

describe("leads.create input bounds", () => {
  it("rejects oversized strings and non-positive budgets", async () => {
    const caller = appRouter.createCaller(ctxFor(null));
    await expect(
      caller.leads.create({
        email: "a@b.com",
        company: "x".repeat(256),
        consent: true,
        consentPolicyVersion: CONSENT_POLICY_VERSION,
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      caller.leads.create({
        email: "a@b.com",
        monthlyBudget: -100,
        consent: true,
        consentPolicyVersion: CONSENT_POLICY_VERSION,
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("leads.create RGPD consent", () => {
  it("rejects capture without explicit consent", async () => {
    const caller = appRouter.createCaller(ctxFor(null));
    // Missing consent.
    await expect(
      caller.leads.create({ email: "a@b.com" } as any)
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    // consent:false is not accepted (z.literal(true)).
    await expect(
      caller.leads.create({ email: "a@b.com", consent: false } as any)
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(createLead).not.toHaveBeenCalled();
  });

  it("records proof of consent and returns a claim token", async () => {
    vi.mocked(createLead).mockResolvedValue([{ insertId: 77 }] as any);
    const caller = appRouter.createCaller(ctxFor(null));
    const result = await caller.leads.create({
      email: "a@b.com",
      consent: true,
      consentPolicyVersion: CONSENT_POLICY_VERSION,
    });
    // consentedAt (a Date) + policy version are persisted for accountability.
    expect(createLead).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "a@b.com",
        consentedAt: expect.any(Date),
        consentPolicyVersion: expect.any(String),
      })
    );
    // The creator gets the capability token needed to later claim the lead.
    expect(result.id).toBe(77);
    expect(verifyLeadClaim(77, result.claimToken)).toBe(true);
  });

  it("rejects a stale privacy-policy version", async () => {
    const caller = appRouter.createCaller(ctxFor(null));
    await expect(
      caller.leads.create({
        email: "a@b.com",
        consent: true,
        consentPolicyVersion: "2026-01-01",
      } as any)
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(createLead).not.toHaveBeenCalled();
  });
});

describe("admin.stats (real KPIs)", () => {
  it("computes conversion and revenue from leads and orders", async () => {
    vi.mocked(getAllLeads).mockResolvedValue([
      { status: "new" },
      { status: "converted" },
      { status: "converted" },
      { status: "rejected" },
    ] as any);
    vi.mocked(getAllOrders).mockResolvedValue([
      {
        status: "active",
        paymentStatus: "succeeded",
        monthlyRecurring: "18400.00",
      },
      {
        status: "processing",
        paymentStatus: "succeeded",
        monthlyRecurring: "21600.00",
      },
      {
        status: "pending",
        paymentStatus: "pending",
        monthlyRecurring: "50000.00",
      },
      {
        status: "cancelled",
        paymentStatus: "succeeded",
        monthlyRecurring: "9600.00",
      },
    ] as any);

    const caller = appRouter.createCaller(ctxFor(makeUser(99, "admin")));
    const stats = await caller.admin.stats();

    expect(stats).toMatchObject({
      totalLeads: 4,
      convertedLeads: 2,
      conversionRate: 50,
      totalOrders: 4,
      monthlyRevenue: 40000, // 18400 + 21600 (cancelled excluded)
      avgDealSize: 20000, // 40000 / 2 billable orders
    });
  });

  it("forbids non-admin callers", async () => {
    const caller = appRouter.createCaller(ctxFor(makeUser(1)));
    await expect(caller.admin.stats()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});

describe("offers.match does not leak a lead's private criteria", () => {
  // Cheaper offer has a non-requested GPU; the requested GPU is pricier. If the
  // lead's criteria are (illegitimately) applied, the pool is filtered to H100 and
  // "cheapest" becomes the H100 offer; otherwise it's the globally cheapest A100.
  const catalogue = [
    {
      id: 1,
      gpuType: "A100",
      monthlyPrice: "1000",
      setupFee: "0",
      deploymentTime: "48h",
    },
    {
      id: 2,
      gpuType: "H100",
      monthlyPrice: "5000",
      setupFee: "0",
      deploymentTime: "24h",
    },
  ];
  const anonLead = {
    id: 5,
    userId: null,
    gpuRequirement: "h100",
    monthlyBudget: null,
  };

  const cheapestId = (offers: any[]) =>
    offers.find(
      o => o.categories?.includes("cheapest") || o.category === "cheapest"
    )?.id;

  beforeEach(() => {
    vi.mocked(getAllOffers).mockResolvedValue(catalogue as any);
    vi.mocked(getLead).mockResolvedValue(anonLead as any);
  });

  it("ignores leadId for an anonymous caller with no claim token", async () => {
    const caller = appRouter.createCaller(ctxFor(null));
    const offers = await caller.offers.match({ leadId: 5 });
    expect(cheapestId(offers)).toBe(1); // full-catalogue ranking, criteria NOT applied
  });

  it("applies the lead's criteria when a valid claim token is presented", async () => {
    const caller = appRouter.createCaller(ctxFor(null));
    const offers = await caller.offers.match({
      leadId: 5,
      claimToken: signLeadClaim(5),
    });
    expect(cheapestId(offers)).toBe(2); // pool filtered to the requested H100
    expect(offers).toHaveLength(1);
    expect(offers[0].categories).toEqual(["best_value", "fastest", "cheapest"]);
  });
});

describe("orders.updatePaymentStatus (admin) does not regress lifecycle", () => {
  it("advances a still-pending order to processing on success", async () => {
    vi.mocked(updateOrderPaymentStatusAtomic).mockResolvedValue({
      id: 10,
      status: "processing",
      paymentStatus: "succeeded",
    } as any);
    const caller = appRouter.createCaller(ctxFor(makeUser(99, "admin")));
    await expect(caller.orders.updatePaymentStatus({
      id: 10,
      paymentStatus: "succeeded",
    })).resolves.toMatchObject({ status: "processing", paymentStatus: "succeeded" });
    expect(updateOrderPaymentStatusAtomic).toHaveBeenCalledWith(10, "succeeded", undefined);
  });

  it("does NOT drag an active order back to pending when payment is marked failed", async () => {
    vi.mocked(updateOrderPaymentStatusAtomic).mockResolvedValue({
      id: 10,
      status: "active",
      paymentStatus: "failed",
    } as any);
    const caller = appRouter.createCaller(ctxFor(makeUser(99, "admin")));
    await expect(caller.orders.updatePaymentStatus({
      id: 10,
      paymentStatus: "failed",
    })).resolves.toMatchObject({ status: "active", paymentStatus: "failed" });
  });

  it("does not re-run provisioning by re-deriving processing on an already-active order", async () => {
    vi.mocked(updateOrderPaymentStatusAtomic).mockResolvedValue({
      id: 10,
      status: "active",
      paymentStatus: "succeeded",
    } as any);
    const caller = appRouter.createCaller(ctxFor(makeUser(99, "admin")));
    await expect(caller.orders.updatePaymentStatus({
      id: 10,
      paymentStatus: "succeeded",
    })).resolves.toMatchObject({ status: "active" });
  });
});

describe("admin order and provisioning lifecycle", () => {
  it("surfaces an invalid manual service transition as a conflict", async () => {
    vi.mocked(getOrder).mockResolvedValue({ id: 10, status: "pending" } as any);
    vi.mocked(transitionOrderStatus).mockRejectedValue(
      new OrderLifecycleError("Stripe must confirm payment before service activation."),
    );
    const caller = appRouter.createCaller(ctxFor(makeUser(99, "admin")));

    await expect(
      caller.orders.updateStatus({ id: 10, status: "active" }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(updateOrder).not.toHaveBeenCalled();
  });

  it("returns not found when the locked order no longer exists", async () => {
    vi.mocked(transitionOrderStatus).mockResolvedValue(null);
    const caller = appRouter.createCaller(ctxFor(makeUser(99, "admin")));

    await expect(
      caller.orders.updateStatus({ id: 404, status: "cancelled" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("publishes a provisioning event only from the committed aggregate", async () => {
    const event = {
      id: 81,
      orderId: 10,
      eventType: "provider_matching" as const,
      status: "completed" as const,
      description: "Provider selected",
      completedAt: new Date(),
      createdAt: new Date(),
    };
    const order = { id: 10, leadId: 3, status: "processing" } as any;
    vi.mocked(createProvisioningEventAndAdvanceOrder).mockResolvedValue({ event, order });
    const caller = appRouter.createCaller(ctxFor(makeUser(99, "admin")));

    await expect(
      caller.provisioning.createEvent({
        orderId: 10,
        eventType: "provider_matching",
        status: "completed",
        description: "Provider selected",
      }),
    ).resolves.toEqual({ event, order });
    expect(createProvisioningEventAndAdvanceOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 10,
        eventType: "provider_matching",
        status: "completed",
      }),
    );
  });
});

describe("orders.checkout", () => {
  const checkoutInput = {
    leadId: 3,
    offerId: 7,
    termsAccepted: true as const,
    termsVersion: PURCHASE_TERMS_VERSION as typeof PURCHASE_TERMS_VERSION,
    idempotencyKey: "checkout-test-key-0001",
  };

  it("returns SERVICE_UNAVAILABLE when Stripe is not configured", async () => {
    // STRIPE_SECRET_KEY is unset in tests, so getStripe() returns null and we fail fast
    // before any order is created.
    const caller = appRouter.createCaller(ctxFor(makeUser(1)));
    await expect(caller.orders.checkout(checkoutInput)).rejects.toMatchObject({
      code: "SERVICE_UNAVAILABLE",
    });
    expect(createCheckoutOrderAtomic).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated callers", async () => {
    const caller = appRouter.createCaller(ctxFor(null));
    await expect(caller.orders.checkout(checkoutInput)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("rejects checkout without explicit terms acceptance", async () => {
    const caller = appRouter.createCaller(ctxFor(makeUser(1)));
    await expect(
      caller.orders.checkout({
        leadId: 3,
        offerId: 7,
        idempotencyKey: "checkout-test-key-0002",
      } as any)
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(getOrderByCheckoutIdempotencyKey).not.toHaveBeenCalled();
  });
});
