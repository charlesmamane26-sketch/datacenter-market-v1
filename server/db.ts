import { eq, desc, lt, and, inArray, notInArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, leads, offers, orders, provisioningEvents, infrastructureMetrics } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

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
 * RGPD retention: deletes unconverted leads (status new/rejected) older than `days`,
 * never touching leads that resulted in an order. Run via `pnpm db:purge`.
 */
export async function purgeLeadsOlderThan(days: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // Never delete leads tied to an order (referential integrity + business record).
  const orderRows = await db.select({ leadId: orders.leadId }).from(orders);
  const referencedLeadIds = orderRows.map(row => row.leadId);

  const conditions = [
    lt(leads.createdAt, cutoff),
    inArray(leads.status, ["new", "rejected"]),
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

export async function getAllOffers() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const rows = await db.select().from(offers);
  return rows.map(normalizeOffer);
}

export async function getOffer(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.select().from(offers).where(eq(offers.id, id)).limit(1);
  return result.length > 0 ? normalizeOffer(result[0]) : null;
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

// Provisioning events queries
export async function createProvisioningEvent(data: typeof provisioningEvents.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return db.insert(provisioningEvents).values(data);
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
