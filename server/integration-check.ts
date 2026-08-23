import "dotenv/config";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type Stripe from "stripe";
import { appRouter } from "./routers";
import { applyStripeEvent } from "./stripe";
import {
  createCheckoutOrderAtomic,
  getDb,
  getLead,
  getOffer,
  getOrder,
  linkOrderStripeReferences,
} from "./db";
import {
  leads as leadsTable,
  offers as offersTable,
  orders as ordersTable,
  providers as providersTable,
  provisioningEvents as provisioningEventsTable,
  stripeEvents as stripeEventsTable,
} from "../drizzle/schema";
import {
  CONSENT_POLICY_VERSION,
  PURCHASE_TERMS_VERSION,
} from "../shared/const";
import type { TrpcContext } from "./_core/context";
import { getSafeDatabaseDriverErrorCode } from "./dbPreflight";

/**
 * End-to-end funnel check against a REAL MySQL database (the "essai").
 *
 * It exercises the data path that the mocked unit tests cannot: real Drizzle queries,
 * insertId extraction, decimal/json columns, enum handling, and aggregation.
 *
 * Prereqs:
 *   1. A reachable MySQL/TiDB in DATABASE_URL
 *   2. `pnpm db:push`   (apply migrations)
 *   3. `pnpm db:seed`   (demo rows remain inactive/fail-closed)
 * Then: `pnpm integration-check`
 *
 * The check creates one isolated, sellable provider/offer fixture with a run-specific GPU type,
 * then removes it with every other test row. It never activates or mutates the demo catalogue.
 *
 * It does NOT cover the real Stripe API call (needs sk_test_) nor the OAuth redirect — auth is
 * simulated with a caller context, and payment is simulated by feeding applyStripeEvent the same
 * event Stripe would send.
 */
function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`✗ ${msg}`);
  console.log(`✓ ${msg}`);
}

const FIXTURE_PREFIX = "integration-check-";

const cleanupState: {
  leadId?: number;
  leadEmail?: string;
  orderId?: number;
  checkoutIdempotencyKey?: string;
  stripeEventId?: string;
  offerId?: number;
  offerName?: string;
  providerId?: number;
  providerSlug?: string;
} = {};

function assertFixtureMarker(value: string, field: string): void {
  if (!value.startsWith(FIXTURE_PREFIX)) {
    throw new Error(`Refusing to clean an unmarked integration ${field}`);
  }
}

async function cleanupIntegrationRows(): Promise<void> {
  const db = await getDb();
  if (!db) return;

  if (cleanupState.leadEmail) assertFixtureMarker(cleanupState.leadEmail, "lead");
  if (cleanupState.checkoutIdempotencyKey) {
    assertFixtureMarker(cleanupState.checkoutIdempotencyKey, "checkout");
  }
  if (cleanupState.stripeEventId) assertFixtureMarker(cleanupState.stripeEventId, "event");
  if (cleanupState.offerName) assertFixtureMarker(cleanupState.offerName, "offer");
  if (cleanupState.providerSlug) assertFixtureMarker(cleanupState.providerSlug, "provider");

  await db.transaction(async tx => {
    if (cleanupState.stripeEventId) {
      await tx
        .delete(stripeEventsTable)
        .where(eq(stripeEventsTable.eventId, cleanupState.stripeEventId));
    }

    let orderId = cleanupState.orderId;
    if (!orderId && cleanupState.checkoutIdempotencyKey) {
      const rows = await tx
        .select({ id: ordersTable.id })
        .from(ordersTable)
        .where(eq(ordersTable.checkoutIdempotencyKey, cleanupState.checkoutIdempotencyKey))
        .limit(1);
      orderId = rows[0]?.id;
    }
    if (orderId) {
      await tx
        .delete(provisioningEventsTable)
        .where(eq(provisioningEventsTable.orderId, orderId));
      await tx.delete(ordersTable).where(eq(ordersTable.id, orderId));
    }

    if (cleanupState.leadId) {
      await tx.delete(leadsTable).where(eq(leadsTable.id, cleanupState.leadId));
    } else if (cleanupState.leadEmail) {
      await tx.delete(leadsTable).where(eq(leadsTable.email, cleanupState.leadEmail));
    }

    if (cleanupState.offerId && cleanupState.offerName) {
      await tx
        .delete(offersTable)
        .where(
          and(
            eq(offersTable.id, cleanupState.offerId),
            eq(offersTable.name, cleanupState.offerName),
          ),
        );
    } else if (cleanupState.offerName) {
      await tx.delete(offersTable).where(eq(offersTable.name, cleanupState.offerName));
    }

    if (cleanupState.providerId && cleanupState.providerSlug) {
      await tx
        .delete(providersTable)
        .where(
          and(
            eq(providersTable.id, cleanupState.providerId),
            eq(providersTable.slug, cleanupState.providerSlug),
          ),
        );
    } else if (cleanupState.providerSlug) {
      await tx
        .delete(providersTable)
        .where(eq(providersTable.slug, cleanupState.providerSlug));
    }
  });

  for (const key of Object.keys(cleanupState) as Array<keyof typeof cleanupState>) {
    delete cleanupState[key];
  }
}

async function createIntegrationInventoryFixture() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const token = `${Date.now()}-${randomUUID().replaceAll("-", "").slice(0, 12)}`;
  const providerSlug = `${FIXTURE_PREFIX}${token}`;
  const offerName = `${FIXTURE_PREFIX}${token}`;
  const gpuRequirement = `${FIXTURE_PREFIX}gpu-${token}`;
  cleanupState.providerSlug = providerSlug;
  cleanupState.offerName = offerName;

  await db.insert(providersTable).values({
    name: `Integration Check ${token}`,
    slug: providerSlug,
    isActive: true,
    notes: "Temporary provider created by pnpm integration-check; safe to delete.",
  });
  const providerRows = await db
    .select()
    .from(providersTable)
    .where(eq(providersTable.slug, providerSlug))
    .limit(1);
  const provider = providerRows[0];
  assert(provider, "temporary integration provider created");
  cleanupState.providerId = provider.id;

  await db.insert(offersTable).values({
    name: offerName,
    providerId: provider.id,
    gpuType: gpuRequirement,
    gpuCount: 1,
    cpuCores: 8,
    ramGb: 32,
    storageGb: 100,
    location: "Integration Test Region",
    monthlyPrice: "100.00",
    setupFee: "10.00",
    sla: "99.0%",
    deploymentTime: "1h",
    description: "Temporary deterministic fixture for the real-database funnel check.",
    features: ["integration-only"],
    isActive: true,
    availabilityStatus: "available",
    availableCapacity: 1,
    availabilityUpdatedAt: new Date(),
    // A hard process kill cannot run finally-style cleanup. Fail closed quickly
    // even in that case, while leaving ample time for this database-only check.
    availabilityExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
  });
  const offerRows = await db
    .select()
    .from(offersTable)
    .where(
      and(eq(offersTable.providerId, provider.id), eq(offersTable.name, offerName)),
    )
    .limit(1);
  const offer = offerRows[0];
  assert(offer, "temporary integration offer created");
  cleanupState.offerId = offer.id;

  return { provider, offer, gpuRequirement };
}

function authedCtx(
  userId: number,
  role: "user" | "admin" = "user"
): TrpcContext {
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
    req: {
      protocol: "https",
      headers: { origin: "https://test.local" },
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

function publicCtx(clientIp: string): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {}, ip: clientIp } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

const INITIAL_PROVISIONING_EVENTS = [
  {
    eventType: "order_received",
    status: "completed",
    description: "Your infrastructure request has been confirmed.",
  },
  {
    eventType: "provider_matching",
    status: "in_progress",
    description: "Matching your workload to the best provider.",
  },
  {
    eventType: "contract_generation",
    status: "pending",
    description: "Generating your service contract.",
  },
  {
    eventType: "provisioning",
    status: "pending",
    description: "Setting up your infrastructure.",
  },
  {
    eventType: "ready",
    status: "pending",
    description: "Your infrastructure is ready to use.",
  },
] satisfies Parameters<typeof createCheckoutOrderAtomic>[0]["events"];

function sumMoney(...amounts: (string | null | undefined)[]): string {
  const cents = amounts.reduce(
    (total, amount) => total + Math.round(Number(amount ?? 0) * 100),
    0
  );
  return (cents / 100).toFixed(2);
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "✗ DATABASE_URL is not set. Run `pnpm db:push && pnpm db:seed` first, then re-run."
    );
  }

  const db = await getDb();
  assert(db, "database client initialized");
  const catalogue = await db.select().from(offersTable);
  assert(
    catalogue.length > 0,
    `offers catalogue is seeded (${catalogue.length} offers)`
  );
  const fixture = await createIntegrationInventoryFixture();
  const caller = appRouter.createCaller(publicCtx(fixture.provider.slug));

  // 1. Lead capture (public) — exercises insert + insertId extraction. Consent is
  // mandatory (RGPD) and the response carries the claim token for later steps.
  const leadEmail = `${FIXTURE_PREFIX}${randomUUID()}@example.com`;
  cleanupState.leadEmail = leadEmail;
  const lead = await caller.leads.create({
    email: leadEmail,
    contactName: "Integration Test",
    workloadType: "inference",
    gpuRequirement: fixture.gpuRequirement,
    monthlyBudget: 25000,
    consent: true,
    consentPolicyVersion: CONSENT_POLICY_VERSION,
  });
  assert(typeof lead.id === "number", `lead created (id=${lead.id})`);
  assert(
    typeof lead.claimToken === "string",
    "lead capture returned a claim token"
  );
  const leadId = lead.id!;
  cleanupState.leadId = leadId;
  const claimToken = lead.claimToken;

  // 2. Matching reads the real catalogue and ranks it (claim token authorizes
  // tailoring to the anonymous lead's criteria). One offer can win several
  // views, so the API deliberately deduplicates offers and exposes all winning categories.
  const matched = await caller.offers.match({ leadId, claimToken });
  assert(
    matched.length >= 1 && matched.length <= 3,
    `matched ${matched.length} unique winning offer(s)`
  );
  assert(
    matched.length === 1 && matched[0].id === fixture.offer.id,
    "matching selected only the run-specific inventory fixture",
  );
  const categories = new Set(matched.flatMap(offer => offer.categories));
  const expectedCategories = ["best_value", "cheapest", "fastest"] as const;
  assert(
    expectedCategories.every(category => categories.has(category)),
    `matched all ranking views (${[...categories].sort().join(",")})`
  );

  // 3. Persist the local checkout aggregate used by orders.checkout, without making a
  // network call to Stripe. Prices come from the selected database offer, never input.
  // The atomic helper also seeds provisioning, claims the anonymous lead and marks it offered.
  const offerId = matched[0].id;
  const selectedOffer = await getOffer(offerId);
  assert(selectedOffer, `selected offer exists (id=${offerId})`);
  assert(selectedOffer.providerId != null, `selected offer has a supplier snapshot`);
  const monthlyRecurring = selectedOffer.monthlyPrice;
  const setupFee = selectedOffer.setupFee ?? "0";
  const idempotencyKey = `${FIXTURE_PREFIX}${leadId}-${randomUUID()}`;
  cleanupState.checkoutIdempotencyKey = idempotencyKey;
  const checkoutInput: Parameters<typeof createCheckoutOrderAtomic>[0] = {
    order: {
      userId: 1,
      leadId,
      offerId,
      providerId: selectedOffer.providerId,
      totalAmount: sumMoney(monthlyRecurring, setupFee),
      setupFee,
      monthlyRecurring,
      status: "pending",
      paymentStatus: "pending",
      checkoutIdempotencyKey: idempotencyKey,
      termsAcceptedAt: new Date(),
      termsVersion: PURCHASE_TERMS_VERSION,
    },
    events: INITIAL_PROVISIONING_EVENTS,
    expectedLeadUserId: null,
  };
  const checkout = await createCheckoutOrderAtomic(checkoutInput);
  assert(checkout.created, `checkout order created (id=${checkout.order.id})`);
  const retry = await createCheckoutOrderAtomic(checkoutInput);
  assert(
    !retry.created && retry.order.id === checkout.order.id,
    "checkout idempotency retry reused the same order"
  );
  const order = checkout.order;
  const orderId = order.id;
  cleanupState.orderId = orderId;
  assert(
    order.paymentStatus === "pending" && order.status === "pending",
    `order remains pending before webhook (${order.paymentStatus}/${order.status})`
  );
  assert(
    order.monthlyRecurring === monthlyRecurring && order.setupFee === setupFee,
    `order priced from the offer (${order.monthlyRecurring} EUR/mo)`
  );
  const events = await appRouter
    .createCaller(authedCtx(1))
    .provisioning.getEvents({ orderId });
  assert(
    events.length === 5,
    `provisioning timeline seeded (${events.length} events)`
  );
  const leadAfterOrder = await getLead(leadId);
  assert(
    leadAfterOrder?.status === "offered",
    `lead is "offered" pre-payment (got ${leadAfterOrder?.status})`
  );

  // 4. Payment webhook -> order paid + lead converted.
  const checkoutSessionId = `cs_integration_${orderId}`;
  const stripeEventId = `${FIXTURE_PREFIX}event-${orderId}-${randomUUID()}`;
  cleanupState.stripeEventId = stripeEventId;
  await linkOrderStripeReferences(orderId, { checkoutSessionId });
  const event = {
    id: stripeEventId,
    type: "checkout.session.completed",
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: checkoutSessionId,
        metadata: { orderId: String(orderId) },
        subscription: `sub_integration_${orderId}`,
        payment_status: "paid",
      },
    },
  } as unknown as Stripe.Event;
  const handled = await applyStripeEvent(event);
  assert(handled, "webhook handled checkout.session.completed");
  const paidOrder = await getOrder(orderId);
  assert(
    paidOrder?.paymentStatus === "succeeded" &&
      paidOrder?.status === "processing",
    `order marked paid (${paidOrder?.paymentStatus}/${paidOrder?.status})`
  );
  const convertedLead = await getLead(leadId);
  assert(
    convertedLead?.status === "converted",
    `lead converted on payment (got ${convertedLead?.status})`
  );

  // 5. Admin KPIs reflect the data.
  const stats = await appRouter
    .createCaller(authedCtx(99, "admin"))
    .admin.stats();
  assert(
    stats.totalLeads >= 1 && stats.totalOrders >= 1,
    `admin.stats: ${stats.totalLeads} leads, ${stats.totalOrders} orders, conversion ${stats.conversionRate}%`
  );

}

function safeErrorMessage(error: unknown): string {
  const safeDriverCode = getSafeDatabaseDriverErrorCode(error);
  return (
    error instanceof Error && error.message.startsWith("✗ ")
      ? error.message
      : safeDriverCode
        ? `database driver error ${safeDriverCode}`
        : error instanceof Error
          ? error.name
          : "unknown error"
  );
}

async function run(): Promise<void> {
  let exitCode = 0;
  try {
    await main();
  } catch (error) {
    exitCode = 1;
    console.error(`\n❌ Integration check failed: ${safeErrorMessage(error)}`);
  }

  try {
    await cleanupIntegrationRows();
  } catch (error) {
    exitCode = 1;
    console.error(
      `\n❌ Integration cleanup failed (${safeErrorMessage(error)}); ` +
        "inspect rows with the integration-check- prefix.",
    );
  }

  if (exitCode === 0) {
    console.log(
      "\n✅ Full funnel verified against the real database. Test rows cleaned up.",
    );
  }
  process.exit(exitCode);
}

void run();
