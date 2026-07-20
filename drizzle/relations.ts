import { relations } from "drizzle-orm";
import { offers, orders, providers } from "./schema";

export const providersRelations = relations(providers, ({ many }) => ({
  offers: many(offers),
  orders: many(orders),
}));

export const offersRelations = relations(offers, ({ one, many }) => ({
  provider: one(providers, {
    fields: [offers.providerId],
    references: [providers.id],
  }),
  orders: many(orders),
}));

export const ordersRelations = relations(orders, ({ one }) => ({
  provider: one(providers, {
    fields: [orders.providerId],
    references: [providers.id],
  }),
  offer: one(offers, {
    fields: [orders.offerId],
    references: [offers.id],
  }),
}));
