import { bigint, int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, boolean, json, index, uniqueIndex } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Leads table: stores AI Workload qualification data from the form
 */
export const leads = mysqlTable("leads", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  email: varchar("email", { length: 320 }).notNull(),
  company: varchar("company", { length: 255 }),
  contactName: varchar("contactName", { length: 255 }),
  contactRole: varchar("contactRole", { length: 255 }),
  
  // Workload qualification data
  workloadType: varchar("workloadType", { length: 100 }), // e.g., "LLM Training", "Inference", "Data Processing"
  gpuRequirement: varchar("gpuRequirement", { length: 100 }), // e.g., "H100", "A100", "RTX 4090"
  monthlyBudget: decimal("monthlyBudget", { precision: 12, scale: 2 }),
  deploymentDuration: varchar("deploymentDuration", { length: 100 }), // e.g., "1 week", "1 month", "6 months"
  infrastructureConstraints: text("infrastructureConstraints"), // JSON or text
  
  // Lead status
  status: mysqlEnum("status", ["new", "qualified", "offered", "converted", "rejected"]).default("new").notNull(),
  
  // Selected offer reference
  selectedOfferId: int("selectedOfferId"),

  // RGPD proof-of-consent (Art. 7-1): set server-side by leads.create when the
  // capture carries explicit consent. Null only for rows created before consent
  // was recorded. consentPolicyVersion pins which policy text was accepted.
  consentedAt: timestamp("consentedAt"),
  consentPolicyVersion: varchar("consentPolicyVersion", { length: 32 }),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  // getLeadsByUser: WHERE userId
  index("leads_userId_idx").on(table.userId),
]);

export type Lead = typeof leads.$inferSelect;
export type InsertLead = typeof leads.$inferInsert;

/**
 * Infrastructure suppliers represented in the marketplace catalogue.
 * Deactivation is deliberately soft: historical offers and paid orders keep
 * their supplier attribution, while the public catalogue stops selling them.
 */
export const providers = mysqlTable("providers", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  // New suppliers are deliberately inert until an operator verifies them.
  isActive: boolean("isActive").default(false).notNull(),
  contactEmail: varchar("contactEmail", { length: 320 }),
  website: varchar("website", { length: 500 }),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Provider = typeof providers.$inferSelect;
export type InsertProvider = typeof providers.$inferInsert;

/**
 * Offers table: predefined infrastructure offerings
 */
export const offers = mysqlTable("offers", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(), // "Best Value", "Fastest", "Cheapest"
  // Nullable for catalogue rows created before supplier inventory was added.
  providerId: int("providerId").references(() => providers.id, {
    onDelete: "set null",
    onUpdate: "cascade",
  }),

  // Technical specs
  gpuType: varchar("gpuType", { length: 100 }).notNull(),
  gpuCount: int("gpuCount").notNull(),
  cpuCores: int("cpuCores").notNull(),
  ramGb: int("ramGb").notNull(),
  storageGb: int("storageGb").notNull(),
  location: varchar("location", { length: 100 }).notNull(),
  
  // Pricing
  monthlyPrice: decimal("monthlyPrice", { precision: 12, scale: 2 }).notNull(),
  setupFee: decimal("setupFee", { precision: 12, scale: 2 }).default("0"),
  
  // SLA & deployment
  sla: varchar("sla", { length: 50 }).notNull(), // e.g., "99.9%"
  deploymentTime: varchar("deploymentTime", { length: 100 }).notNull(), // e.g., "24-48 hours"
  
  // Additional details
  description: text("description"),
  features: json("features"), // JSON array of feature strings

  // Operational inventory. Public listing, matching, and first-time checkout
  // require an active offer, positive capacity, a sellable availability state,
  // and a freshness window which has not expired.
  isActive: boolean("isActive").default(false).notNull(),
  availabilityStatus: mysqlEnum("availabilityStatus", [
    "available",
    "limited",
    "unavailable",
    "maintenance",
  ]).default("unavailable").notNull(),
  // Operator-declared free units snapshot. Checkout gates on > 0 but does not
  // decrement it yet; a reservation ledger is required before auto-decrementing.
  availableCapacity: int("availableCapacity").default(0).notNull(),
  availabilityUpdatedAt: timestamp("availabilityUpdatedAt").defaultNow().notNull(),
  // Optimistic concurrency guard for simultaneous admin edits.
  inventoryVersion: int("inventoryVersion").default(1).notNull(),
  // Null is fail-closed: a sellable offer must carry an explicit future expiry.
  availabilityExpiresAt: timestamp("availabilityExpiresAt"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("offers_providerId_idx").on(table.providerId),
]);

export type Offer = typeof offers.$inferSelect;
export type InsertOffer = typeof offers.$inferInsert;

/**
 * Orders table: customer orders and transactions
 */
export const orders = mysqlTable("orders", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  leadId: int("leadId").notNull(),
  offerId: int("offerId").notNull(),
  // Immutable supplier snapshot. Offers may be reassigned later, but an order
  // must keep the supplier which was locked and validated at checkout time.
  providerId: int("providerId").notNull().references(() => providers.id, {
    onDelete: "restrict",
    onUpdate: "cascade",
  }),
  
  // Order details
  status: mysqlEnum("status", ["pending", "processing", "provisioning", "active", "cancelled", "completed"]).default("pending").notNull(),
  
  // Pricing
  totalAmount: decimal("totalAmount", { precision: 12, scale: 2 }).notNull(),
  setupFee: decimal("setupFee", { precision: 12, scale: 2 }).default("0"),
  monthlyRecurring: decimal("monthlyRecurring", { precision: 12, scale: 2 }).notNull(),
  
  // Payment
  stripePaymentIntentId: varchar("stripePaymentIntentId", { length: 255 }),
  stripeCheckoutSessionId: varchar("stripeCheckoutSessionId", { length: 255 }),
  stripeCustomerId: varchar("stripeCustomerId", { length: 255 }),
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 255 }),
  stripeSubscriptionStatus: varchar("stripeSubscriptionStatus", { length: 32 }),
  // Stripe event.created is a Unix timestamp. Keep one cursor per Stripe object
  // family: delivery order is not causal across Checkout, Invoice and
  // Subscription objects, so a single global cursor could suppress valid events.
  stripeLastCheckoutEventCreated: bigint("stripeLastCheckoutEventCreated", { mode: "number", unsigned: true }),
  stripeLastInvoiceEventCreated: bigint("stripeLastInvoiceEventCreated", { mode: "number", unsigned: true }),
  stripeLastSubscriptionEventCreated: bigint("stripeLastSubscriptionEventCreated", { mode: "number", unsigned: true }),
  stripeTerminalAt: timestamp("stripeTerminalAt"),
  paymentStatus: mysqlEnum("paymentStatus", ["pending", "succeeded", "failed", "cancelled"]).default("pending").notNull(),

  // Checkout evidence and application-level idempotency. Existing/legacy rows may
  // be null; orders.checkout always supplies all three values server-side.
  checkoutIdempotencyKey: varchar("checkoutIdempotencyKey", { length: 128 }),
  termsAcceptedAt: timestamp("termsAcceptedAt"),
  termsVersion: varchar("termsVersion", { length: 32 }),
  
  // Provisioning timeline
  provisioningStartedAt: timestamp("provisioningStartedAt"),
  provisioningCompletedAt: timestamp("provisioningCompletedAt"),
  
  // Contract
  contractUrl: varchar("contractUrl", { length: 500 }),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  // getOrdersByUser: WHERE userId ORDER BY createdAt DESC (composite covers both)
  index("orders_userId_createdAt_idx").on(table.userId, table.createdAt),
  // Relational lookups / integrity for joins on lead and offer.
  index("orders_leadId_idx").on(table.leadId),
  index("orders_offerId_idx").on(table.offerId),
  index("orders_providerId_idx").on(table.providerId),
  uniqueIndex("orders_userId_checkoutIdempotencyKey_uidx").on(table.userId, table.checkoutIdempotencyKey),
  uniqueIndex("orders_stripeCheckoutSessionId_uidx").on(table.stripeCheckoutSessionId),
  uniqueIndex("orders_stripeSubscriptionId_uidx").on(table.stripeSubscriptionId),
]);

export type Order = typeof orders.$inferSelect;
export type InsertOrder = typeof orders.$inferInsert;

/**
 * Durable Stripe webhook journal. The unique event id is the deduplication
 * boundary; order/lead transitions and the final "processed" marker are committed
 * in one database transaction.
 */
export const stripeEvents = mysqlTable("stripeEvents", {
  id: int("id").autoincrement().primaryKey(),
  eventId: varchar("eventId", { length: 255 }).notNull().unique(),
  eventType: varchar("eventType", { length: 100 }).notNull(),
  status: mysqlEnum("status", ["processing", "processed", "failed"]).default("processing").notNull(),
  orderId: int("orderId"),
  attempts: int("attempts").default(1).notNull(),
  lastError: text("lastError"),
  processedAt: timestamp("processedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("stripeEvents_orderId_idx").on(table.orderId),
  index("stripeEvents_status_updatedAt_idx").on(table.status, table.updatedAt),
]);

export type StripeEventRecord = typeof stripeEvents.$inferSelect;

/**
 * Provisioning timeline events
 */
export const provisioningEvents = mysqlTable("provisioningEvents", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull(),
  
  eventType: mysqlEnum("eventType", ["order_received", "provider_matching", "contract_generation", "provisioning", "ready"]).notNull(),
  status: mysqlEnum("status", ["pending", "in_progress", "completed", "failed"]).default("pending").notNull(),
  
  description: text("description"),
  completedAt: timestamp("completedAt"),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  // getProvisioningEventsByOrder: WHERE orderId
  index("provisioningEvents_orderId_idx").on(table.orderId),
]);

export type ProvisioningEvent = typeof provisioningEvents.$inferSelect;
export type InsertProvisioningEvent = typeof provisioningEvents.$inferInsert;

/**
 * Infrastructure monitoring data for client dashboard
 */
export const infrastructureMetrics = mysqlTable("infrastructureMetrics", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull(),
  
  // GPU metrics
  gpuUsagePercent: decimal("gpuUsagePercent", { precision: 5, scale: 2 }),
  gpuMemoryUsedGb: decimal("gpuMemoryUsedGb", { precision: 10, scale: 2 }),
  gpuMemoryTotalGb: int("gpuMemoryTotalGb"),
  
  // System metrics
  cpuUsagePercent: decimal("cpuUsagePercent", { precision: 5, scale: 2 }),
  ramUsedGb: decimal("ramUsedGb", { precision: 10, scale: 2 }),
  ramTotalGb: int("ramTotalGb"),
  
  // Billing
  costThisMonth: decimal("costThisMonth", { precision: 12, scale: 2 }),
  costProjected: decimal("costProjected", { precision: 12, scale: 2 }),

  recordedAt: timestamp("recordedAt").defaultNow().notNull(),
}, (table) => [
  // getLatestMetricsForOrder: WHERE orderId ORDER BY recordedAt DESC (composite)
  index("infrastructureMetrics_orderId_recordedAt_idx").on(table.orderId, table.recordedAt),
]);

export type InfrastructureMetrics = typeof infrastructureMetrics.$inferSelect;
export type InsertInfrastructureMetrics = typeof infrastructureMetrics.$inferInsert;
