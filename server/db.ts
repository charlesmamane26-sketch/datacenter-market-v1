import { eq, desc, lt, gt, and, notInArray, inArray, isNull, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  leads,
  offers,
  providers,
  orders,
  provisioningEvents,
  infrastructureMetrics,
  stripeEvents,
  type Lead,
  type Order,
  type Provider,
  type ProvisioningEvent,
} from "../drizzle/schema";
import { ENV } from './_core/env';
import { isAvailabilityStale, isOfferSellable } from "./inventory";
import {
  assertManualOrderTransition,
  deriveProvisioningOrderPatch,
} from "./orderLifecycle";

let _db: ReturnType<typeof drizzle> | null = null;

function resultHeader(result: unknown): { affectedRows?: number; insertId?: number } | undefined {
  return Array.isArray(result)
    ? (result[0] as { affectedRows?: number; insertId?: number } | undefined)
    : undefined;
}

function isDuplicateEntryError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: unknown; errno?: unknown; cause?: unknown };
  if (candidate.code === "ER_DUP_ENTRY" || candidate.errno === 1062) return true;
  return candidate.cause !== error && isDuplicateEntryError(candidate.cause);
}

export class CheckoutConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CheckoutConflictError";
  }
}

export class InventoryConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InventoryConflictError";
  }
}

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// Leads queries
export async function createLead(data: typeof leads.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(leads).values(data);
  return result;
}

export async function getLead(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.select().from(leads).where(eq(leads.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function updateLead(id: number, data: Partial<typeof leads.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(leads).set(data).where(eq(leads.id, id));
}

export async function getLeadsByUser(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return db.select().from(leads).where(eq(leads.userId, userId));
}

export async function getAllLeads() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return db.select().from(leads);
}

export async function deleteLead(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(leads).where(eq(leads.id, id));
}

/**
 * RGPD retention: deletes every non-converted lead older than `days`. Run via
 * `pnpm db:purge`.
 *
 * "Non-converted" = any status except `converted` (a real customer with a paid
 * order — kept as a business record). Crucially this includes `offered`/
 * `qualified` prospects whose checkout was abandoned: previously those were never
 * purged (status filter too narrow) and, because they carried a — later
 * cancelled — order row, the order guard excluded them too, so their PII lingered
 * indefinitely past the retention window. A lead is now protected from erasure
 * only while it is referenced by a *live* (non-cancelled) order.
 */
export async function purgeLeadsOlderThan(days: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // Protect only leads tied to a live order. Cancelled orders (abandoned
  // checkouts) do not keep their lead's PII out of the purge.
  const orderRows = await db
    .select({ leadId: orders.leadId })
    .from(orders)
    .where(notInArray(orders.status, ["cancelled"]));
  const referencedLeadIds = orderRows.map(row => row.leadId);

  const conditions = [
    // updatedAt is the best available proxy for the prospect's last activity;
    // do not erase a lead that was recently re-qualified merely because it was
    // originally captured before the retention cutoff.
    lt(leads.updatedAt, cutoff),
    notInArray(leads.status, ["converted"]),
  ];
  if (referencedLeadIds.length > 0) {
    conditions.push(notInArray(leads.id, referencedLeadIds));
  }

  await db.delete(leads).where(and(...conditions));
}

// Offers queries

/**
 * The mysql2 driver can return JSON columns as raw strings depending on version;
 * normalize `features` to an array at the data boundary so every consumer
 * (matching engine, tRPC clients) always sees string[].
 */
function normalizeOffer<T extends { features: unknown }>(offer: T): T {
  if (typeof offer.features === "string") {
    try {
      return { ...offer, features: JSON.parse(offer.features) };
    } catch {
      return { ...offer, features: [] };
    }
  }
  return offer;
}

const publicProviderSelection = {
  id: providers.id,
  name: providers.name,
  slug: providers.slug,
  isActive: providers.isActive,
};

function sellableOfferWhere(now: Date = new Date()) {
  return and(
    eq(offers.isActive, true),
    inArray(offers.availabilityStatus, ["available", "limited"]),
    gt(offers.availableCapacity, 0),
    gt(offers.availabilityExpiresAt, now),
    // Migration 0006 backfills legacy rows. Missing, deleted, or inactive
    // suppliers all fail closed after the LEFT JOIN.
    eq(providers.isActive, true),
  );
}

function normalizePublicProvider<T extends { id: number }>(provider: T | null): T | null {
  return provider;
}

/** Public catalogue: only operationally sellable offers are returned. */
export async function getAllOffers() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const rows = await db
    .select({ offer: offers, provider: publicProviderSelection })
    .from(offers)
    .leftJoin(providers, eq(offers.providerId, providers.id))
    .where(sellableOfferWhere());
  return rows.map(row => ({
    ...normalizeOffer(row.offer),
    provider: normalizePublicProvider(row.provider),
  }));
}

/**
 * Loads an offer by id. Internal consumers default to historical/raw access;
 * public catalogue and first-time checkout callers opt into `sellableOnly`.
 */
export async function getOffer(id: number, options: { sellableOnly?: boolean } = {}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db
    .select({ offer: offers, provider: publicProviderSelection })
    .from(offers)
    .leftJoin(providers, eq(offers.providerId, providers.id))
    .where(
      options.sellableOnly
        ? and(eq(offers.id, id), sellableOfferWhere())
        : eq(offers.id, id),
    )
    .limit(1);
  return result.length > 0
    ? {
        ...normalizeOffer(result[0].offer),
        provider: normalizePublicProvider(result[0].provider),
      }
    : null;
}

// Supplier inventory queries

export async function getAllProviders() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.select().from(providers).orderBy(providers.name);
}

export async function getProvider(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const rows = await db.select().from(providers).where(eq(providers.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function createProvider(data: typeof providers.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(providers).values(data);
  const insertId = resultHeader(result)?.insertId;
  if (insertId) return getProvider(insertId);

  // Some mysql2-compatible services do not expose insertId consistently.
  const rows = await db.select().from(providers).where(eq(providers.slug, data.slug)).limit(1);
  return rows[0] ?? null;
}

export async function updateProvider(
  id: number,
  data: Partial<Omit<typeof providers.$inferInsert, "id" | "createdAt" | "updatedAt">>,
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(providers).set(data).where(eq(providers.id, id));
  return getProvider(id);
}

type InventoryOfferRow = {
  offer: typeof offers.$inferSelect;
  provider: Provider | null;
};

function normalizeInventoryOffer(row: InventoryOfferRow, now: Date) {
  const offer = normalizeOffer(row.offer);
  return {
    ...offer,
    provider: row.provider,
    isSellable: isOfferSellable({ ...offer, provider: row.provider }, now),
    availabilityIsStale: isAvailabilityStale(offer, now),
  };
}

export async function getInventoryOffers() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const now = new Date();
  const rows = await db
    .select({ offer: offers, provider: providers })
    .from(offers)
    .leftJoin(providers, eq(offers.providerId, providers.id))
    .orderBy(offers.name);
  return rows.map(row => normalizeInventoryOffer(row, now));
}

async function getInventoryOffer(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const rows = await db
    .select({ offer: offers, provider: providers })
    .from(offers)
    .leftJoin(providers, eq(offers.providerId, providers.id))
    .where(eq(offers.id, id))
    .limit(1);
  return rows[0] ? normalizeInventoryOffer(rows[0], new Date()) : null;
}

export async function updateOfferInventory(
  id: number,
  expectedVersion: number,
  data: Partial<
    Pick<
      typeof offers.$inferInsert,
      | "providerId"
      | "isActive"
      | "availabilityStatus"
      | "availableCapacity"
      | "availabilityExpiresAt"
    >
  >,
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db
    .update(offers)
    .set({
      ...data,
      availabilityUpdatedAt: new Date(),
      inventoryVersion: sql`${offers.inventoryVersion} + 1`,
    })
    .where(and(eq(offers.id, id), eq(offers.inventoryVersion, expectedVersion)));
  if ((resultHeader(result)?.affectedRows ?? 0) === 0) {
    const current = await getInventoryOffer(id);
    if (!current) return null;
    throw new InventoryConflictError(
      "Inventory changed in another admin session. Reload before saving again.",
    );
  }
  return getInventoryOffer(id);
}

// Orders queries
export async function createOrder(data: typeof orders.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(orders).values(data);
  return result;
}

export async function getOrder(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getOrderByCheckoutIdempotencyKey(userId: number, key: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db
    .select()
    .from(orders)
    .where(and(eq(orders.userId, userId), eq(orders.checkoutIdempotencyKey, key)))
    .limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getOrderByStripeCheckoutSessionId(sessionId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db
    .select()
    .from(orders)
    .where(eq(orders.stripeCheckoutSessionId, sessionId))
    .limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getOrderByStripeSubscriptionId(subscriptionId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db
    .select()
    .from(orders)
    .where(eq(orders.stripeSubscriptionId, subscriptionId))
    .limit(1);
  return result.length > 0 ? result[0] : null;
}

type InitialProvisioningEvent = Omit<typeof provisioningEvents.$inferInsert, "orderId">;

export type CheckoutOrderAtomicResult =
  | {
      order: Order;
      created: true;
      previousLeadStatus: Lead["status"];
      previousSelectedOfferId: number | null;
    }
  | { order: Order; created: false };

/**
 * Creates the local checkout aggregate atomically. Locking the lead serializes
 * concurrent attempts, while the (userId, checkoutIdempotencyKey) unique index
 * makes a retry return the original order instead of creating a duplicate.
 */
export async function createCheckoutOrderAtomic(input: {
  order: typeof orders.$inferInsert & { checkoutIdempotencyKey: string };
  events: InitialProvisioningEvent[];
  expectedLeadUserId: number | null;
}): Promise<CheckoutOrderAtomicResult> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  try {
    return await db.transaction(async tx => {
      // Lock and re-check operational inventory inside the same transaction as
      // order creation. This closes the race where an admin disables capacity
      // after the funnel displayed it but before Checkout persists the order.
      const offerRows = await tx
        .select()
        .from(offers)
        .where(eq(offers.id, input.order.offerId))
        .limit(1)
        .for("update");
      const checkoutOffer = offerRows[0];
      let checkoutProvider: Provider | null = null;
      if (checkoutOffer?.providerId != null) {
        const providerRows = await tx
          .select()
          .from(providers)
          .where(eq(providers.id, checkoutOffer.providerId))
          .limit(1)
          .for("update");
        checkoutProvider = providerRows[0] ?? null;
      }
      if (
        !checkoutOffer ||
        (checkoutOffer.providerId != null && !checkoutProvider) ||
        !isOfferSellable({ ...checkoutOffer, provider: checkoutProvider })
      ) {
        throw new CheckoutConflictError("This offer is no longer available.");
      }
      if (input.order.providerId !== checkoutOffer.providerId) {
        throw new CheckoutConflictError("This offer supplier changed during checkout.");
      }

      const leadRows = await tx
        .select()
        .from(leads)
        .where(eq(leads.id, input.order.leadId))
        .limit(1)
        .for("update");
      const lead = leadRows[0];

      // Re-check idempotency only after acquiring the lead lock. A concurrent
      // request with the same key may have committed while this transaction was
      // waiting for that lock.
      const existingRows = await tx
        .select()
        .from(orders)
        .where(
          and(
            eq(orders.userId, input.order.userId),
            eq(orders.checkoutIdempotencyKey, input.order.checkoutIdempotencyKey),
          ),
        )
        .limit(1);
      if (existingRows[0]) return { order: existingRows[0], created: false };

      if (!lead || lead.userId !== input.expectedLeadUserId) {
        throw new CheckoutConflictError("Lead ownership changed during checkout.");
      }
      if (lead.status === "converted" || lead.status === "rejected") {
        throw new CheckoutConflictError(`Lead status ${lead.status} cannot start checkout.`);
      }
      // This is the compensation snapshot. It must be captured from the row
      // protected by the lead lock, never from the authorization read which
      // happened before this transaction.
      const previousLeadStatus = lead.status;
      const previousSelectedOfferId = lead.selectedOfferId;

      const liveOrders = await tx
        .select({ id: orders.id })
        .from(orders)
        .where(
          and(
            eq(orders.leadId, input.order.leadId),
            inArray(orders.status, ["pending", "processing", "provisioning", "active"]),
          ),
        )
        .limit(1)
        .for("update");
      if (liveOrders.length > 0) {
        throw new CheckoutConflictError("This lead already has an active checkout or order.");
      }

      const insertResult = await tx.insert(orders).values(input.order);
      const insertId = resultHeader(insertResult)?.insertId;
      if (!insertId) throw new Error("Database did not return the created order id.");

      if (input.events.length > 0) {
        await tx.insert(provisioningEvents).values(
          input.events.map(event => ({ ...event, orderId: insertId })),
        );
      }
      await tx
        .update(leads)
        .set({
          status: "offered",
          selectedOfferId: input.order.offerId,
          userId: lead.userId ?? input.order.userId,
        })
        .where(eq(leads.id, lead.id));

      const createdRows = await tx.select().from(orders).where(eq(orders.id, insertId)).limit(1);
      if (!createdRows[0]) throw new Error("Created order could not be reloaded.");
      return {
        order: createdRows[0],
        created: true,
        previousLeadStatus,
        previousSelectedOfferId,
      };
    });
  } catch (error) {
    if (isDuplicateEntryError(error)) {
      const existing = await getOrderByCheckoutIdempotencyKey(
        input.order.userId,
        input.order.checkoutIdempotencyKey,
      );
      if (existing) return { order: existing, created: false };
    }
    throw error;
  }
}

export type FailedCheckoutCompensationInput = {
  orderId: number;
  userId: number;
  idempotencyKey: string;
  previousLeadStatus: Lead["status"];
  previousSelectedOfferId: number | null;
};

export type FailedCheckoutCompensationResult = "compensated" | "preserved" | "missing";

export type ExpiredCheckoutReleaseInput = {
  orderId: number;
  userId: number;
  idempotencyKey: string;
  checkoutSessionId: string;
};

export type ExpiredCheckoutReleaseResult = "released" | "preserved" | "missing";

/**
 * A local checkout may only be compensated before Stripe is bound to it. The
 * identity checks keep a stale request from cancelling another checkout, while
 * the Stripe-state checks preserve webhook authority if remote work progressed.
 */
export function isFailedCheckoutCompensatable(
  order: Order,
  expected: Pick<FailedCheckoutCompensationInput, "orderId" | "userId" | "idempotencyKey">,
): boolean {
  return (
    order.id === expected.orderId &&
    order.userId === expected.userId &&
    order.checkoutIdempotencyKey === expected.idempotencyKey &&
    order.status === "pending" &&
    order.paymentStatus === "pending" &&
    order.stripeCheckoutSessionId == null &&
    order.stripePaymentIntentId == null &&
    order.stripeCustomerId == null &&
    order.stripeSubscriptionId == null &&
    order.stripeSubscriptionStatus == null &&
    order.stripeLastCheckoutEventCreated == null &&
    order.stripeLastInvoiceEventCreated == null &&
    order.stripeLastSubscriptionEventCreated == null &&
    order.stripeTerminalAt == null
  );
}

/** Guard used only after Stripe explicitly reports that the bound Session expired. */
export function isExpiredCheckoutReleasable(
  order: Order,
  expected: ExpiredCheckoutReleaseInput,
): boolean {
  return (
    order.id === expected.orderId &&
    order.userId === expected.userId &&
    order.checkoutIdempotencyKey === expected.idempotencyKey &&
    order.stripeCheckoutSessionId === expected.checkoutSessionId &&
    order.status === "pending" &&
    order.paymentStatus === "pending"
  );
}

/**
 * Compensates a checkout that failed after its local aggregate was committed.
 *
 * The cancelled order remains as an audit/idempotency record and its payment
 * status stays pending: only Stripe webhooks determine payment outcomes. The
 * lead is restored only while it still reflects this checkout and no other live
 * order has taken its place. A later verified Stripe event can still advance the
 * cancelled order, so an ambiguous remote success is never discarded.
 */
export async function compensateFailedCheckout(
  input: FailedCheckoutCompensationInput,
): Promise<FailedCheckoutCompensationResult> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Resolve the lead before entering the transaction so its row can be locked
  // first. createCheckoutOrderAtomic uses lead -> order too; matching that order
  // avoids the compensation/new-checkout deadlock cycle.
  const candidateRows = await db
    .select({ leadId: orders.leadId })
    .from(orders)
    .where(eq(orders.id, input.orderId))
    .limit(1);
  const candidate = candidateRows[0];
  if (!candidate) return "missing";

  return db.transaction(async tx => {
    const leadRows = await tx
      .select()
      .from(leads)
      .where(eq(leads.id, candidate.leadId))
      .limit(1)
      .for("update");
    const lead = leadRows[0];

    const orderRows = await tx
      .select()
      .from(orders)
      .where(eq(orders.id, input.orderId))
      .limit(1)
      .for("update");
    const order = orderRows[0];
    if (!order) return "missing";
    // Revalidate both the pre-read relationship and every identity/lifecycle
    // predicate after both locks were acquired.
    if (order.leadId !== candidate.leadId || !isFailedCheckoutCompensatable(order, input)) {
      return "preserved";
    }

    // Keep the predicates on the write as a second safety belt if this helper is
    // ever changed to use a weaker transaction isolation level.
    const updateResult = await tx
      .update(orders)
      .set({ status: "cancelled" })
      .where(
        and(
          eq(orders.id, input.orderId),
          eq(orders.userId, input.userId),
          eq(orders.checkoutIdempotencyKey, input.idempotencyKey),
          eq(orders.status, "pending"),
          eq(orders.paymentStatus, "pending"),
          isNull(orders.stripeCheckoutSessionId),
          isNull(orders.stripePaymentIntentId),
          isNull(orders.stripeCustomerId),
          isNull(orders.stripeSubscriptionId),
          isNull(orders.stripeSubscriptionStatus),
          isNull(orders.stripeLastCheckoutEventCreated),
          isNull(orders.stripeLastInvoiceEventCreated),
          isNull(orders.stripeLastSubscriptionEventCreated),
          isNull(orders.stripeTerminalAt),
        ),
      );
    if ((resultHeader(updateResult)?.affectedRows ?? 0) !== 1) return "preserved";

    if (
      lead &&
      lead.userId === order.userId &&
      lead.status === "offered" &&
      lead.selectedOfferId === order.offerId
    ) {
      const otherLiveOrders = await tx
        .select({ id: orders.id })
        .from(orders)
        .where(
          and(
            eq(orders.leadId, order.leadId),
            inArray(orders.status, ["pending", "processing", "provisioning", "active"]),
          ),
        )
        .limit(1)
        .for("update");
      if (otherLiveOrders.length === 0) {
        await tx
          .update(leads)
          .set({
            status: input.previousLeadStatus,
            selectedOfferId: input.previousSelectedOfferId,
          })
          .where(
            and(
              eq(leads.id, lead.id),
              eq(leads.userId, order.userId),
              eq(leads.status, "offered"),
              eq(leads.selectedOfferId, order.offerId),
            ),
          );
      }
    }

    return "compensated";
  });
}

/**
 * Releases a local live-order gate after Stripe explicitly returned an expired
 * bound Checkout Session. Payment status is intentionally untouched; this is a
 * checkout-lifecycle fact, not a payment webhook transition.
 */
export async function releaseExpiredCheckout(
  input: ExpiredCheckoutReleaseInput,
): Promise<ExpiredCheckoutReleaseResult> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const candidateRows = await db
    .select({ leadId: orders.leadId })
    .from(orders)
    .where(eq(orders.id, input.orderId))
    .limit(1);
  const candidate = candidateRows[0];
  if (!candidate) return "missing";

  return db.transaction(async tx => {
    // Match checkout creation/compensation lock order: lead, then order.
    await tx
      .select({ id: leads.id })
      .from(leads)
      .where(eq(leads.id, candidate.leadId))
      .limit(1)
      .for("update");

    const orderRows = await tx
      .select()
      .from(orders)
      .where(eq(orders.id, input.orderId))
      .limit(1)
      .for("update");
    const order = orderRows[0];
    if (!order) return "missing";
    if (order.leadId !== candidate.leadId || !isExpiredCheckoutReleasable(order, input)) {
      return "preserved";
    }

    const updateResult = await tx
      .update(orders)
      .set({ status: "cancelled" })
      .where(
        and(
          eq(orders.id, input.orderId),
          eq(orders.userId, input.userId),
          eq(orders.checkoutIdempotencyKey, input.idempotencyKey),
          eq(orders.stripeCheckoutSessionId, input.checkoutSessionId),
          eq(orders.status, "pending"),
          eq(orders.paymentStatus, "pending"),
        ),
      );
    return (resultHeader(updateResult)?.affectedRows ?? 0) === 1 ? "released" : "preserved";
  });
}

/** Persist the exact Stripe objects without ever rebinding an order to another session/subscription. */
export async function linkOrderStripeReferences(
  orderId: number,
  refs: {
    checkoutSessionId?: string | null;
    customerId?: string | null;
    subscriptionId?: string | null;
    subscriptionStatus?: string | null;
  },
): Promise<Order> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.transaction(async tx => {
    const rows = await tx.select().from(orders).where(eq(orders.id, orderId)).limit(1).for("update");
    const order = rows[0];
    if (!order) throw new Error("Order not found while linking Stripe references.");
    if (
      refs.checkoutSessionId &&
      order.stripeCheckoutSessionId &&
      order.stripeCheckoutSessionId !== refs.checkoutSessionId
    ) {
      throw new CheckoutConflictError("Order is already linked to another Stripe Checkout Session.");
    }
    if (
      refs.subscriptionId &&
      order.stripeSubscriptionId &&
      order.stripeSubscriptionId !== refs.subscriptionId
    ) {
      throw new CheckoutConflictError("Order is already linked to another Stripe subscription.");
    }

    await tx
      .update(orders)
      .set({
        ...(refs.checkoutSessionId ? { stripeCheckoutSessionId: refs.checkoutSessionId } : {}),
        ...(refs.customerId ? { stripeCustomerId: refs.customerId } : {}),
        ...(refs.subscriptionId ? { stripeSubscriptionId: refs.subscriptionId } : {}),
        ...(refs.subscriptionStatus ? { stripeSubscriptionStatus: refs.subscriptionStatus } : {}),
      })
      .where(eq(orders.id, orderId));
    const updated = await tx.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    return updated[0];
  });
}

export type StripeEventClaim = "claimed" | "processed" | "in_progress";
const STRIPE_EVENT_LEASE_MS = 5 * 60 * 1000;

/** Claims an event id exactly once, while allowing failed/stale attempts to be retried. */
export async function claimStripeEvent(eventId: string, eventType: string): Promise<StripeEventClaim> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  try {
    await db.insert(stripeEvents).values({ eventId, eventType, status: "processing", attempts: 1 });
    return "claimed";
  } catch (error) {
    if (!isDuplicateEntryError(error)) throw error;
  }

  const cutoff = new Date(Date.now() - STRIPE_EVENT_LEASE_MS);
  const result = await db
    .update(stripeEvents)
    .set({
      status: "processing",
      eventType,
      attempts: sql`${stripeEvents.attempts} + 1`,
      lastError: null,
      processedAt: null,
    })
    .where(
      and(
        eq(stripeEvents.eventId, eventId),
        or(eq(stripeEvents.status, "failed"), and(eq(stripeEvents.status, "processing"), lt(stripeEvents.updatedAt, cutoff))),
      ),
    );
  if ((resultHeader(result)?.affectedRows ?? 0) > 0) return "claimed";

  const rows = await db.select().from(stripeEvents).where(eq(stripeEvents.eventId, eventId)).limit(1);
  return rows[0]?.status === "processed" ? "processed" : "in_progress";
}

export async function failStripeEvent(eventId: string, error: unknown): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(stripeEvents)
    .set({ status: "failed", lastError: String(error).slice(0, 10_000) })
    .where(and(eq(stripeEvents.eventId, eventId), eq(stripeEvents.status, "processing")));
}

export type StripeTransitionPlan = {
  order?: Partial<typeof orders.$inferInsert>;
  lead?: Partial<typeof leads.$inferInsert>;
};

export type StripeEventDomain = "checkout" | "invoice" | "subscription";

/**
 * Locks the event and order, applies the order+lead transition, then marks the
 * event processed in the same transaction. A retry can therefore never observe
 * a processed event with only half of the business transition committed.
 */
export async function completeStripeEvent(
  eventId: string,
  orderId: number | null,
  eventCreated: number,
  eventDomain: StripeEventDomain,
  buildTransition?: (order: Order) => StripeTransitionPlan | null,
): Promise<{ order: Order | null; changed: boolean; duplicate: boolean }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.transaction(async tx => {
    const eventRows = await tx
      .select()
      .from(stripeEvents)
      .where(eq(stripeEvents.eventId, eventId))
      .limit(1)
      .for("update");
    const journal = eventRows[0];
    if (!journal) throw new Error(`Stripe event ${eventId} was not claimed.`);
    if (journal.status === "processed") {
      return { order: null, changed: false, duplicate: true };
    }

    let order: Order | null = null;
    let plan: StripeTransitionPlan | null = null;
    if (orderId != null) {
      const orderRows = await tx
        .select()
        .from(orders)
        .where(eq(orders.id, orderId))
        .limit(1)
        .for("update");
      order = orderRows[0] ?? null;
      const lastEventCreated = order
        ? eventDomain === "checkout"
          ? order.stripeLastCheckoutEventCreated
          : eventDomain === "invoice"
            ? order.stripeLastInvoiceEventCreated
            : order.stripeLastSubscriptionEventCreated
        : null;
      const stale = lastEventCreated != null && eventCreated < lastEventCreated;
      if (order && !stale) {
        plan = buildTransition?.(order) ?? null;
        const cursorPatch =
          eventDomain === "checkout"
            ? { stripeLastCheckoutEventCreated: eventCreated }
            : eventDomain === "invoice"
              ? { stripeLastInvoiceEventCreated: eventCreated }
              : { stripeLastSubscriptionEventCreated: eventCreated };
        // Advance this object's monotonic cursor even for an otherwise no-op
        // event. Delayed events from the same family can no longer regress it,
        // while events from other Stripe objects remain independently valid.
        plan = {
          ...(plan ?? {}),
          order: {
            ...(plan?.order ?? {}),
            ...cursorPatch,
          },
        };
      }

      if (plan?.order && Object.keys(plan.order).length > 0) {
        await tx.update(orders).set(plan.order).where(eq(orders.id, order.id));
      }
      if (plan?.lead && Object.keys(plan.lead).length > 0) {
        await tx.update(leads).set(plan.lead).where(eq(leads.id, order.id ? order.leadId : 0));
      }
    }

    await tx
      .update(stripeEvents)
      .set({
        status: "processed",
        orderId,
        processedAt: new Date(),
        lastError: null,
      })
      .where(eq(stripeEvents.eventId, eventId));
    return { order, changed: plan != null, duplicate: false };
  });
}

export async function getOrdersByUser(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return db.select().from(orders).where(eq(orders.userId, userId)).orderBy(desc(orders.createdAt));
}

export async function getAllOrders() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.select().from(orders).orderBy(desc(orders.createdAt));
}

/**
 * Operational hygiene: cancels orders left pending/unpaid past `hours` (abandoned checkouts).
 * Paid orders move to "processing" via the Stripe webhook, so they are never matched here.
 */
export async function cancelStalePendingOrders(hours: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
  await db
    .update(orders)
    .set({ status: "cancelled" })
    .where(
      and(
        eq(orders.status, "pending"),
        eq(orders.paymentStatus, "pending"),
        lt(orders.createdAt, cutoff),
      ),
    );
}

export async function updateOrder(id: number, data: Partial<typeof orders.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(orders).set(data).where(eq(orders.id, id));
}

/**
 * Applies an operator-requested service status under a row lock. The lifecycle
 * guard keeps Stripe as the only authority able to unlock paid service states,
 * while the lock prevents a concurrent webhook/admin write from being lost.
 */
export async function transitionOrderStatus(
  id: number,
  status: Order["status"],
): Promise<Order | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.transaction(async tx => {
    const rows = await tx
      .select()
      .from(orders)
      .where(eq(orders.id, id))
      .limit(1)
      .for("update");
    const order = rows[0];
    if (!order) return null;

    assertManualOrderTransition(order, status);
    if (order.status !== status) {
      await tx.update(orders).set({ status }).where(eq(orders.id, id));
    }

    const updatedRows = await tx.select().from(orders).where(eq(orders.id, id)).limit(1);
    return updatedRows[0] ?? null;
  });
}

// Provisioning events queries
export async function createProvisioningEvent(data: typeof provisioningEvents.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return db.insert(provisioningEvents).values(data);
}

/**
 * Adds an operator timeline event and advances the order summary atomically.
 * This is intentionally separate from createProvisioningEvent, which seeds the
 * pre-payment timeline while checkout itself must remain pending.
 */
export async function createProvisioningEventAndAdvanceOrder(
  data: typeof provisioningEvents.$inferInsert,
): Promise<{ event: ProvisioningEvent; order: Order } | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.transaction(async tx => {
    const rows = await tx
      .select()
      .from(orders)
      .where(eq(orders.id, data.orderId))
      .limit(1)
      .for("update");
    const order = rows[0];
    if (!order) return null;

    const now = new Date();
    const status = data.status ?? "pending";
    const patch = deriveProvisioningOrderPatch(
      order,
      { eventType: data.eventType, status },
      now,
    );
    const createdAt = data.createdAt ?? now;
    const completedAt = data.completedAt ?? null;
    const description = data.description ?? null;
    const insertResult = await tx.insert(provisioningEvents).values({
      ...data,
      status,
      description,
      completedAt,
      createdAt,
    });
    const insertId = resultHeader(insertResult)?.insertId;
    if (!insertId) throw new Error("Database did not return the provisioning event id.");

    if (Object.keys(patch).length > 0) {
      await tx.update(orders).set(patch).where(eq(orders.id, order.id));
    }
    const updatedRows = await tx.select().from(orders).where(eq(orders.id, order.id)).limit(1);
    const updatedOrder = updatedRows[0];
    if (!updatedOrder) throw new Error("Updated order could not be reloaded.");

    return {
      event: {
        id: insertId,
        orderId: data.orderId,
        eventType: data.eventType,
        status,
        description,
        completedAt,
        createdAt,
      },
      order: updatedOrder,
    };
  });
}

export async function getProvisioningEventsByOrder(orderId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return db.select().from(provisioningEvents).where(eq(provisioningEvents.orderId, orderId));
}

// Infrastructure metrics queries
export async function createInfrastructureMetrics(data: typeof infrastructureMetrics.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return db.insert(infrastructureMetrics).values(data);
}

export async function getLatestMetricsForOrder(orderId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db
    .select()
    .from(infrastructureMetrics)
    .where(eq(infrastructureMetrics.orderId, orderId))
    .orderBy(desc(infrastructureMetrics.recordedAt))
    .limit(1);
  
  return result.length > 0 ? result[0] : null;
}
