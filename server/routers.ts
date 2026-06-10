import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, adminProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import type { User } from "../drizzle/schema";
import { matchOffers, type MatchCriteria } from "./matching";
import { notifyOwner } from "./_core/notification";
import { rateLimit, clientIp } from "./rateLimit";
import { createCheckoutSession, getStripe, getOrigin } from "./stripe";
import { z } from "zod";
import {
  createLead,
  getLead,
  updateLead,
  getAllLeads,
  deleteLead,
  getAllOffers,
  getOffer,
  createOrder,
  getOrder,
  getOrdersByUser,
  getAllOrders,
  updateOrder,
  getProvisioningEventsByOrder,
  createProvisioningEvent,
  getLatestMetricsForOrder,
} from "./db";

/**
 * Loads an order and authorizes access: only its owner or an admin may read it.
 * Throws NOT_FOUND for both missing and unauthorized so callers cannot probe which order IDs exist.
 */
async function requireOwnedOrder(orderId: number, user: User) {
  const order = await getOrder(orderId);
  if (!order || (order.userId !== user.id && user.role !== "admin")) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
  }
  return order;
}

/**
 * Sums money amounts (decimal strings) in integer cents to avoid floating-point drift,
 * returning a fixed 2-decimal string suitable for a DECIMAL column.
 */
function sumMoney(...amounts: (string | null | undefined)[]): string {
  const cents = amounts.reduce(
    (total, amount) => total + Math.round(Number(amount ?? 0) * 100),
    0,
  );
  return (cents / 100).toFixed(2);
}

const INITIAL_PROVISIONING_EVENTS = [
  { eventType: "order_received", status: "completed", description: "Your infrastructure request has been confirmed." },
  { eventType: "provider_matching", status: "in_progress", description: "Matching your workload to the best provider." },
  { eventType: "contract_generation", status: "pending", description: "Generating your service contract." },
  { eventType: "provisioning", status: "pending", description: "Setting up your infrastructure." },
  { eventType: "ready", status: "pending", description: "Your infrastructure is ready to use." },
] as const;

/**
 * Creates a pending order from a lead + offer: validates both, derives pricing server-side,
 * seeds the provisioning timeline, and marks the lead converted. Returns the order summary
 * (plus the resolved offer). Throws NOT_FOUND if the offer or lead is missing.
 */
async function createPendingOrder(
  input: { leadId: number; offerId: number },
  userId: number,
) {
  const offer = await getOffer(input.offerId);
  if (!offer) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Offer not found" });
  }
  const lead = await getLead(input.leadId);
  // A lead may be created anonymously (before login), then claimed at checkout.
  // Only its owner — or the user claiming an anonymous lead — may order against it.
  // NOT_FOUND for both missing and unauthorized so callers cannot probe lead IDs.
  if (!lead || (lead.userId != null && lead.userId !== userId)) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Lead not found" });
  }

  // Pricing is derived server-side — never trust client-supplied amounts.
  const monthlyRecurring = offer.monthlyPrice;
  const setupFee = offer.setupFee ?? "0";
  const totalAmount = sumMoney(monthlyRecurring, setupFee);

  const result = await createOrder({
    userId,
    leadId: input.leadId,
    offerId: input.offerId,
    totalAmount,
    setupFee,
    monthlyRecurring,
    status: "pending",
    paymentStatus: "pending",
  });

  const insertId = Array.isArray(result)
    ? (result[0] as { insertId?: number } | undefined)?.insertId
    : undefined;

  // Seed the initial provisioning timeline so the confirmation page shows real events.
  if (insertId != null) {
    for (const event of INITIAL_PROVISIONING_EVENTS) {
      await createProvisioningEvent({
        orderId: insertId,
        eventType: event.eventType,
        status: event.status,
        description: event.description,
      });
    }
  }

  // An offer was selected and checkout started — mark the lead "offered", record the choice,
  // and claim the lead for the ordering user if it was created anonymously.
  // It becomes "converted" only once payment succeeds (see applyStripeEvent in stripe.ts).
  await updateLead(input.leadId, {
    status: "offered",
    selectedOfferId: input.offerId,
    userId: lead.userId ?? userId,
  });

  return {
    id: insertId,
    leadId: lead.id,
    offerId: offer.id,
    totalAmount,
    setupFee,
    monthlyRecurring,
    status: "pending" as const,
    paymentStatus: "pending" as const,
    offer,
  };
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // Leads router
  leads: router({
    create: publicProcedure
      .input(
        z.object({
          // Max lengths mirror the column sizes in drizzle/schema.ts.
          email: z.string().email().max(320),
          company: z.string().max(255).optional(),
          contactName: z.string().max(255).optional(),
          contactRole: z.string().max(255).optional(),
          workloadType: z.string().max(100).optional(),
          gpuRequirement: z.string().max(100).optional(),
          monthlyBudget: z.number().positive().max(9_999_999_999).optional(),
          deploymentDuration: z.string().max(100).optional(),
          infrastructureConstraints: z.string().max(10_000).optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        // Anti-abuse: throttle the public lead endpoint per client IP (5 / minute).
        const limit = rateLimit(`lead:${clientIp(ctx.req)}`, 5, 60_000);
        if (!limit.allowed) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: "Too many requests. Please wait a moment and try again.",
          });
        }

        const result = await createLead({
          userId: ctx.user?.id,
          email: input.email,
          company: input.company,
          contactName: input.contactName,
          contactRole: input.contactRole,
          workloadType: input.workloadType,
          gpuRequirement: input.gpuRequirement,
          monthlyBudget: input.monthlyBudget ? String(input.monthlyBudget) : undefined,
          deploymentDuration: input.deploymentDuration,
          infrastructureConstraints: input.infrastructureConstraints,
        });
        const insertId = Array.isArray(result)
          ? (result[0] as { insertId?: number } | undefined)?.insertId
          : undefined;

        // Best-effort: notify the sales owner of the new lead. Never block lead capture.
        try {
          await notifyOwner({
            title: `New lead: ${input.contactName ?? input.email}`,
            content:
              `${input.company ?? "—"} · workload: ${input.workloadType ?? "—"} · ` +
              `GPU: ${input.gpuRequirement ?? "—"} · budget: ${input.monthlyBudget ?? "—"} €/mo · ${input.email}`,
          });
        } catch (err) {
          console.warn("[Lead] Owner notification failed:", err);
        }

        return { id: insertId };
      }),

    get: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ input, ctx }) => {
        const lead = await getLead(input.id);
        // Leads hold PII (email, budget). Only the owning user or an admin may read one;
        // anonymous leads (userId null) are admin-only. NOT_FOUND hides which IDs exist.
        if (!lead || (ctx.user.role !== "admin" && lead.userId !== ctx.user.id)) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Lead not found" });
        }
        return lead;
      }),

    list: adminProcedure.query(async () => {
      return getAllLeads();
    }),

    // Admin-only: lead lifecycle transitions are otherwise server-driven
    // (createPendingOrder marks "offered", the Stripe webhook marks "converted").
    update: adminProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          status: z.enum(["new", "qualified", "offered", "converted", "rejected"]).optional(),
          selectedOfferId: z.number().int().positive().optional(),
        })
      )
      .mutation(async ({ input }) => {
        await updateLead(input.id, {
          status: input.status,
          selectedOfferId: input.selectedOfferId,
        });
        return getLead(input.id);
      }),

    // RGPD erasure: lets an admin delete a lead on request.
    delete: adminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        await deleteLead(input.id);
        return { success: true } as const;
      }),
  }),

  // Offers router
  offers: router({
    list: publicProcedure.query(async () => {
      return getAllOffers();
    }),

    // Ranks the catalogue against the lead's criteria and returns one offer per view
    // (best_value / fastest / cheapest). Public: the funnel runs before login.
    // Returns offers only — never lead PII.
    match: publicProcedure
      .input(z.object({ leadId: z.number().int().positive().optional() }))
      .query(async ({ input }) => {
        const catalogue = await getAllOffers();
        let criteria: MatchCriteria = {};
        if (input.leadId != null) {
          const lead = await getLead(input.leadId);
          if (lead) {
            criteria = {
              gpuRequirement: lead.gpuRequirement,
              monthlyBudget:
                lead.monthlyBudget != null ? Number(lead.monthlyBudget) : null,
            };
          }
        }
        const result = matchOffers(catalogue, criteria);
        if (!result) return [];
        return [
          { ...result.bestValue, category: "best_value" as const },
          { ...result.fastest, category: "fastest" as const },
          { ...result.cheapest, category: "cheapest" as const },
        ];
      }),

    get: publicProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ input }) => {
        return getOffer(input.id);
      }),
  }),

  // Orders router
  orders: router({
    create: protectedProcedure
      .input(z.object({ leadId: z.number().int().positive(), offerId: z.number().int().positive() }))
      .mutation(async ({ input, ctx }) => {
        return createPendingOrder(input, ctx.user.id);
      }),

    // Creates the pending order and a Stripe-hosted Checkout session; returns the payment URL.
    // The webhook (POST /api/stripe/webhook) is the source of truth for payment status.
    checkout: protectedProcedure
      .input(z.object({ leadId: z.number().int().positive(), offerId: z.number().int().positive() }))
      .mutation(async ({ input, ctx }) => {
        // Fail fast (before creating an order) if payments aren't configured.
        if (!getStripe()) {
          throw new TRPCError({
            code: "SERVICE_UNAVAILABLE",
            message: "Payments are not configured.",
          });
        }
        // Stripe requires absolute success/cancel URLs — resolve the origin before doing anything.
        const origin = getOrigin(ctx.req);
        if (!origin) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Could not determine the request origin for checkout URLs.",
          });
        }
        const order = await createPendingOrder(input, ctx.user.id);
        const url = await createCheckoutSession({
          orderId: order.id ?? 0,
          leadId: order.leadId,
          offerId: order.offerId,
          offerName: order.offer.name,
          monthlyPrice: order.monthlyRecurring,
          setupFee: order.setupFee,
          origin,
        });
        return { orderId: order.id, url };
      }),

    get: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ input, ctx }) => {
        return requireOwnedOrder(input.id, ctx.user);
      }),

    list: protectedProcedure.query(async ({ ctx }) => {
      return getOrdersByUser(ctx.user.id);
    }),

    updatePaymentStatus: adminProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          paymentStatus: z.enum(["pending", "succeeded", "failed", "cancelled"]),
          stripePaymentIntentId: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        await updateOrder(input.id, {
          paymentStatus: input.paymentStatus,
          stripePaymentIntentId: input.stripePaymentIntentId,
          status: input.paymentStatus === "succeeded" ? "processing" : "pending",
        });
        return getOrder(input.id);
      }),

    updateStatus: adminProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          status: z.enum(["pending", "processing", "provisioning", "active", "cancelled", "completed"]),
        })
      )
      .mutation(async ({ input }) => {
        await updateOrder(input.id, { status: input.status });
        return getOrder(input.id);
      }),
  }),

  // Provisioning events router
  provisioning: router({
    getEvents: protectedProcedure
      .input(z.object({ orderId: z.number().int().positive() }))
      .query(async ({ input, ctx }) => {
        await requireOwnedOrder(input.orderId, ctx.user);
        return getProvisioningEventsByOrder(input.orderId);
      }),

    createEvent: adminProcedure
      .input(
        z.object({
          orderId: z.number().int().positive(),
          eventType: z.enum(["order_received", "provider_matching", "contract_generation", "provisioning", "ready"]),
          status: z.enum(["pending", "in_progress", "completed", "failed"]).optional(),
          description: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        return createProvisioningEvent({
          orderId: input.orderId,
          eventType: input.eventType,
          status: input.status || "pending",
          description: input.description,
        });
      }),
  }),

  // Infrastructure metrics router
  metrics: router({
    getLatest: protectedProcedure
      .input(z.object({ orderId: z.number().int().positive() }))
      .query(async ({ input, ctx }) => {
        await requireOwnedOrder(input.orderId, ctx.user);
        return getLatestMetricsForOrder(input.orderId);
      }),
  }),

  // Admin analytics router
  admin: router({
    stats: adminProcedure.query(async () => {
      const [allLeads, allOrders] = await Promise.all([getAllLeads(), getAllOrders()]);
      const totalLeads = allLeads.length;
      const convertedLeads = allLeads.filter(l => l.status === "converted").length;
      const conversionRate =
        totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0;
      const billableOrders = allOrders.filter(o => o.status !== "cancelled");
      const monthlyRevenue = billableOrders.reduce(
        (sum, o) => sum + Number(o.monthlyRecurring),
        0,
      );
      const avgDealSize =
        billableOrders.length > 0 ? Math.round(monthlyRevenue / billableOrders.length) : 0;
      return {
        totalLeads,
        convertedLeads,
        conversionRate,
        totalOrders: allOrders.length,
        monthlyRevenue: Math.round(monthlyRevenue),
        avgDealSize,
      };
    }),
  }),
});

export type AppRouter = typeof appRouter;
