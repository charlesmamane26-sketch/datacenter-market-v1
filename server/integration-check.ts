import "dotenv/config";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import { appRouter } from "./routers";
import { applyStripeEvent } from "./stripe";
import { getDb, getLead, getOrder, deleteLead } from "./db";
import { offers as offersTable, orders as ordersTable } from "../drizzle/schema";
import type { TrpcContext } from "./_core/context";

/**
 * End-to-end funnel check against a REAL MySQL database (the "essai").
 *
 * It exercises the data path that the mocked unit tests cannot: real Drizzle queries,
 * insertId extraction, decimal/json columns, enum handling, and aggregation.
 *
 * Prereqs:
 *   1. A reachable MySQL/TiDB in DATABASE_URL
 *   2. `pnpm db:push`   (apply migrations)
 *   3. `pnpm db:seed`   (seed the offers catalogue)
 * Then: `pnpm integration-check`
 *
 * It does NOT cover the real Stripe API call (needs sk_test_) nor the OAuth redirect — auth is
 * simulated with a caller context, and payment is simulated by feeding applyStripeEvent the same
 * event Stripe would send.
 */
function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`✗ ${msg}`);
  console.log(`✓ ${msg}`);
}

function authedCtx(userId: number, role: "user" | "admin" = "user"): TrpcContext {
  return {
    user: {
      id: userId,
      openId: `int-${userId}`,
      name: "Integration",
      email: `int${userId}@example.com`,
      loginMethod: "test",
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: { origin: "https://test.local" } } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

const publicCtx: TrpcContext = {
  user: null,
  req: { protocol: "https", headers: {} } as TrpcContext["req"],
  res: {} as TrpcContext["res"],
};

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set. Run `pnpm db:push && pnpm db:seed` first, then re-run.");
    process.exit(1);
  }

  const db = await getDb();
  assert(db, "connected to the database");
  const catalogue = await db.select().from(offersTable);
  assert(catalogue.length > 0, `offers catalogue is seeded (${catalogue.length} offers)`);

  // 1. Lead capture (public) — exercises insert + insertId extraction.
  const lead = await appRouter.createCaller(publicCtx).leads.create({
    email: "integration+lead@example.com",
    contactName: "Integration Test",
    workloadType: "inference",
    gpuRequirement: "h100",
    monthlyBudget: 25000,
  });
  assert(typeof lead.id === "number", `lead created (id=${lead.id})`);
  const leadId = lead.id!;

  // 2. Matching reads the real catalogue and ranks it.
  const matched = await appRouter.createCaller(publicCtx).offers.match({ leadId });
  assert(matched.length === 3, `matched 3 offers`);
  const cats = matched.map(o => o.category).sort().join(",");
  assert(cats === "best_value,cheapest,fastest", `matched one offer per view (${cats})`);

  // 3. Order creation (authed) — server-side pricing, provisioning timeline, lead -> offered.
  const offerId = matched[0].id;
  const order = await appRouter.createCaller(authedCtx(1)).orders.create({ leadId, offerId });
  assert(typeof order.id === "number", `order created (id=${order.id})`);
  const orderId = order.id!;
  assert(Number(order.monthlyRecurring) > 0, `order priced from the offer (${order.monthlyRecurring} EUR/mo)`);
  const events = await appRouter.createCaller(authedCtx(1)).provisioning.getEvents({ orderId });
  assert(events.length === 5, `provisioning timeline seeded (${events.length} events)`);
  const leadAfterOrder = await getLead(leadId);
  assert(leadAfterOrder?.status === "offered", `lead is "offered" pre-payment (got ${leadAfterOrder?.status})`);

  // 4. Payment webhook -> order paid + lead converted.
  const event = {
    type: "checkout.session.completed",
    data: { object: { metadata: { orderId: String(orderId) }, subscription: "sub_integration" } },
  } as unknown as Stripe.Event;
  const handled = await applyStripeEvent(event);
  assert(handled, "webhook handled checkout.session.completed");
  const paidOrder = await getOrder(orderId);
  assert(
    paidOrder?.paymentStatus === "succeeded" && paidOrder?.status === "processing",
    `order marked paid (${paidOrder?.paymentStatus}/${paidOrder?.status})`,
  );
  const convertedLead = await getLead(leadId);
  assert(convertedLead?.status === "converted", `lead converted on payment (got ${convertedLead?.status})`);

  // 5. Admin KPIs reflect the data.
  const stats = await appRouter.createCaller(authedCtx(99, "admin")).admin.stats();
  assert(
    stats.totalLeads >= 1 && stats.totalOrders >= 1,
    `admin.stats: ${stats.totalLeads} leads, ${stats.totalOrders} orders, conversion ${stats.conversionRate}%`,
  );

  // Cleanup the rows we created (the DB may be shared).
  await db.delete(ordersTable).where(eq(ordersTable.id, orderId));
  await deleteLead(leadId);

  console.log("\n✅ Full funnel verified against the real database. Test rows cleaned up.");
  process.exit(0);
}

main().catch(err => {
  console.error("\n❌ Integration check failed:", err);
  process.exit(1);
});
