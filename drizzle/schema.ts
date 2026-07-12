import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, boolean, json, index } from "drizzle-orm/mysql-core";

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

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  // getLeadsByUser: WHERE userId
  index("leads_userId_idx").on(table.userId),
]);

export type Lead = typeof leads.$inferSelect;
export type InsertLead = typeof leads.$inferInsert;

/**
 * Offers table: predefined infrastructure offerings
 */
export const offers = mysqlTable("offers", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(), // "Best Value", "Fastest", "Cheapest"

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
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

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
  
  // Order details
  status: mysqlEnum("status", ["pending", "processing", "provisioning", "active", "cancelled", "completed"]).default("pending").notNull(),
  
  // Pricing
  totalAmount: decimal("totalAmount", { precision: 12, scale: 2 }).notNull(),
  setupFee: decimal("setupFee", { precision: 12, scale: 2 }).default("0"),
  monthlyRecurring: decimal("monthlyRecurring", { precision: 12, scale: 2 }).notNull(),
  
  // Payment
  stripePaymentIntentId: varchar("stripePaymentIntentId", { length: 255 }),
  paymentStatus: mysqlEnum("paymentStatus", ["pending", "succeeded", "failed", "cancelled"]).default("pending").notNull(),
  
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
]);

export type Order = typeof orders.$inferSelect;
export type InsertOrder = typeof orders.$inferInsert;

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
