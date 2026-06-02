import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import {
  createOrder,
  createProvisioningEvent,
  deleteLead,
  getAllLeads,
  getAllOrders,
  getLead,
  getOffer,
  getOrder,
  updateLead,
} from "./db";
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
