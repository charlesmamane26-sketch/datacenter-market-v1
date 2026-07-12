import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import {
  createLead,
  createOrder,
  createProvisioningEvent,
  deleteLead,
  getAllLeads,
  getAllOffers,
  getAllOrders,
  getLead,
  getOffer,
  getOrder,
  updateLead,
  updateOrder,
} from "./db";
import { signLeadClaim } from "./leadClaim";
import { __resetRateLimit } from "./rateLimit";
import type { TrpcContext } from "./_core/context";

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
  getLatestMetricsForOrder: vi.fn(),
}));

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
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

beforeEach(() => {
  vi.resetAllMocks();
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
    await expect(caller.leads.delete({ id: 5 })).resolves.toEqual({ success: true });
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

describe("orders.create pricing (server-side, ignores client)", () => {
  it("derives amounts from the offer and returns the new order id", async () => {
    vi.mocked(getOffer).mockResolvedValue({
      id: 7,
      monthlyPrice: "18400.00",
      setupFee: "2000.00",
    } as any);
    vi.mocked(getLead).mockResolvedValue({ id: 3, userId: 1 } as any);
    vi.mocked(createOrder).mockResolvedValue([{ insertId: 42 }] as any);

    const caller = appRouter.createCaller(ctxFor(makeUser(1)));
    const result = await caller.orders.create({ leadId: 3, offerId: 7 });

    // The amount the order is created with comes from the offer, not the caller.
    expect(createOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 1,
        leadId: 3,
        offerId: 7,
        monthlyRecurring: "18400.00",
        setupFee: "2000.00",
        totalAmount: "20400.00",
      }),
    );
    expect(result).toMatchObject({ id: 42, totalAmount: "20400.00" });
    // The funnel is wired: the order seeds a provisioning timeline and marks the lead "offered"
    // (it converts only on payment success — see stripe.test.ts).
    expect(createProvisioningEvent).toHaveBeenCalledTimes(5);
    expect(updateLead).toHaveBeenCalledWith(
      3,
      expect.objectContaining({ status: "offered", selectedOfferId: 7 }),
    );
  });

  it("rejects an unknown offer", async () => {
    vi.mocked(getOffer).mockResolvedValue(null as any);
    const caller = appRouter.createCaller(ctxFor(makeUser(1)));
    await expect(
      caller.orders.create({ leadId: 3, offerId: 999 }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("orders.create lead ownership (IDOR contract)", () => {
  beforeEach(() => {
    vi.mocked(getOffer).mockResolvedValue({
      id: 7,
      monthlyPrice: "18400.00",
      setupFee: "0",
    } as any);
    vi.mocked(createOrder).mockResolvedValue([{ insertId: 42 }] as any);
  });

  it("hides another user's lead as NOT_FOUND and creates nothing", async () => {
    vi.mocked(getLead).mockResolvedValue({ id: 3, userId: 2 } as any);
    const caller = appRouter.createCaller(ctxFor(makeUser(1)));
    await expect(
      caller.orders.create({ leadId: 3, offerId: 7 }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(createOrder).not.toHaveBeenCalled();
    expect(updateLead).not.toHaveBeenCalled();
  });

  it("claims an anonymous lead (userId null) with a valid claim token", async () => {
    vi.mocked(getLead).mockResolvedValue({ id: 3, userId: null } as any);
    const caller = appRouter.createCaller(ctxFor(makeUser(1)));
    await expect(
      caller.orders.create({ leadId: 3, offerId: 7, claimToken: signLeadClaim(3) }),
    ).resolves.toMatchObject({ id: 42 });
    expect(updateLead).toHaveBeenCalledWith(
      3,
      expect.objectContaining({ status: "offered", selectedOfferId: 7, userId: 1 }),
    );
  });

  it("refuses to claim an anonymous lead without a valid claim token (IDOR fix)", async () => {
    vi.mocked(getLead).mockResolvedValue({ id: 3, userId: null } as any);
    const caller = appRouter.createCaller(ctxFor(makeUser(1)));
    // No token: an attacker enumerating lead IDs cannot claim/hijack the lead.
    await expect(caller.orders.create({ leadId: 3, offerId: 7 })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    // Wrong token (e.g. computed for a different lead) is rejected too.
    await expect(
      caller.orders.create({ leadId: 3, offerId: 7, claimToken: signLeadClaim(999) }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(createOrder).not.toHaveBeenCalled();
    expect(updateLead).not.toHaveBeenCalled();
  });

  it("keeps the existing owner on an owned lead", async () => {
    vi.mocked(getLead).mockResolvedValue({ id: 3, userId: 1 } as any);
    const caller = appRouter.createCaller(ctxFor(makeUser(1)));
    await expect(caller.orders.create({ leadId: 3, offerId: 7 })).resolves.toMatchObject({
      id: 42,
    });
    expect(updateLead).toHaveBeenCalledWith(
      3,
      expect.objectContaining({ userId: 1 }),
    );
  });
});

describe("leads.update authorization (admin-only)", () => {
  it("forbids a regular user", async () => {
    const caller = appRouter.createCaller(ctxFor(makeUser(1)));
    await expect(
      caller.leads.update({ id: 5, status: "rejected" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(updateLead).not.toHaveBeenCalled();
  });

  it("lets an admin update any lead", async () => {
    vi.mocked(updateLead).mockResolvedValue(undefined as any);
    vi.mocked(getLead).mockResolvedValue({ id: 5, status: "rejected" } as any);
    const caller = appRouter.createCaller(ctxFor(makeUser(99, "admin")));
    await expect(caller.leads.update({ id: 5, status: "rejected" })).resolves.toMatchObject({
      id: 5,
    });
    expect(updateLead).toHaveBeenCalledWith(5, {
      status: "rejected",
      selectedOfferId: undefined,
    });
  });
});

describe("leads.create input bounds", () => {
  it("rejects oversized strings and non-positive budgets", async () => {
    const caller = appRouter.createCaller(ctxFor(null));
    await expect(
      caller.leads.create({ email: "a@b.com", company: "x".repeat(256), consent: true }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      caller.leads.create({ email: "a@b.com", monthlyBudget: -100, consent: true }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("leads.create RGPD consent", () => {
  it("rejects capture without explicit consent", async () => {
    const caller = appRouter.createCaller(ctxFor(null));
    // Missing consent.
    await expect(
      caller.leads.create({ email: "a@b.com" } as any),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    // consent:false is not accepted (z.literal(true)).
    await expect(
      caller.leads.create({ email: "a@b.com", consent: false } as any),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(createLead).not.toHaveBeenCalled();
  });

  it("records proof of consent and returns a claim token", async () => {
    vi.mocked(createLead).mockResolvedValue([{ insertId: 77 }] as any);
    const caller = appRouter.createCaller(ctxFor(null));
    const result = await caller.leads.create({ email: "a@b.com", consent: true });
    // consentedAt (a Date) + policy version are persisted for accountability.
    expect(createLead).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "a@b.com",
        consentedAt: expect.any(Date),
        consentPolicyVersion: expect.any(String),
      }),
    );
    // The creator gets the capability token needed to later claim the lead.
    expect(result.id).toBe(77);
    expect(result.claimToken).toBe(signLeadClaim(77));
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
      { status: "active", monthlyRecurring: "18400.00" },
      { status: "processing", monthlyRecurring: "21600.00" },
      { status: "cancelled", monthlyRecurring: "9600.00" },
    ] as any);

    const caller = appRouter.createCaller(ctxFor(makeUser(99, "admin")));
    const stats = await caller.admin.stats();

    expect(stats).toMatchObject({
      totalLeads: 4,
      convertedLeads: 2,
      conversionRate: 50,
      totalOrders: 3,
      monthlyRevenue: 40000, // 18400 + 21600 (cancelled excluded)
      avgDealSize: 20000, // 40000 / 2 billable orders
    });
  });

  it("forbids non-admin callers", async () => {
    const caller = appRouter.createCaller(ctxFor(makeUser(1)));
    await expect(caller.admin.stats()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("offers.match does not leak a lead's private criteria", () => {
  // Cheaper offer has a non-requested GPU; the requested GPU is pricier. If the
  // lead's criteria are (illegitimately) applied, the pool is filtered to H100 and
  // "cheapest" becomes the H100 offer; otherwise it's the globally cheapest A100.
  const catalogue = [
    { id: 1, gpuType: "A100", monthlyPrice: "1000", setupFee: "0", deploymentTime: "48h" },
    { id: 2, gpuType: "H100", monthlyPrice: "5000", setupFee: "0", deploymentTime: "24h" },
  ];
  const anonLead = { id: 5, userId: null, gpuRequirement: "h100", monthlyBudget: null };

  const cheapestId = (offers: any[]) => offers.find(o => o.category === "cheapest")?.id;

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
    const offers = await caller.offers.match({ leadId: 5, claimToken: signLeadClaim(5) });
    expect(cheapestId(offers)).toBe(2); // pool filtered to the requested H100
  });
});

describe("orders.updatePaymentStatus (admin) does not regress lifecycle", () => {
  it("advances a still-pending order to processing on success", async () => {
    vi.mocked(getOrder).mockResolvedValue({ id: 10, status: "pending" } as any);
    const caller = appRouter.createCaller(ctxFor(makeUser(99, "admin")));
    await caller.orders.updatePaymentStatus({ id: 10, paymentStatus: "succeeded" });
    expect(updateOrder).toHaveBeenCalledWith(
      10,
      expect.objectContaining({ paymentStatus: "succeeded", status: "processing" }),
    );
  });

  it("does NOT drag an active order back to pending when payment is marked failed", async () => {
    vi.mocked(getOrder).mockResolvedValue({ id: 10, status: "active" } as any);
    const caller = appRouter.createCaller(ctxFor(makeUser(99, "admin")));
    await caller.orders.updatePaymentStatus({ id: 10, paymentStatus: "failed" });
    // paymentStatus updates, but status is left untouched (no "pending" override).
    const call = vi.mocked(updateOrder).mock.calls[0][1] as Record<string, unknown>;
    expect(call.paymentStatus).toBe("failed");
    expect(call).not.toHaveProperty("status");
  });

  it("does not re-run provisioning by re-deriving processing on an already-active order", async () => {
    vi.mocked(getOrder).mockResolvedValue({ id: 10, status: "active" } as any);
    const caller = appRouter.createCaller(ctxFor(makeUser(99, "admin")));
    await caller.orders.updatePaymentStatus({ id: 10, paymentStatus: "succeeded" });
    const call = vi.mocked(updateOrder).mock.calls[0][1] as Record<string, unknown>;
    expect(call).not.toHaveProperty("status"); // stays "active", not reset to "processing"
  });
});

describe("orders.checkout", () => {
  it("returns SERVICE_UNAVAILABLE when Stripe is not configured", async () => {
    // STRIPE_SECRET_KEY is unset in tests, so getStripe() returns null and we fail fast
    // before any order is created.
    const caller = appRouter.createCaller(ctxFor(makeUser(1)));
    await expect(
      caller.orders.checkout({ leadId: 3, offerId: 7 }),
    ).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
    expect(createOrder).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated callers", async () => {
    const caller = appRouter.createCaller(ctxFor(null));
    await expect(
      caller.orders.checkout({ leadId: 3, offerId: 7 }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
