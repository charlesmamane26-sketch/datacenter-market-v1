import { COOKIE_NAME, CONSENT_POLICY_VERSION } from "@shared/const";
import { parse as parseCookieHeader } from "cookie";
import { signLeadClaim, verifyLeadClaim } from "./leadClaim";
import { getSessionCookieOptions } from "./_core/cookies";
import { sdk } from "./_core/sdk";
import { revokeJti } from "./_core/sessionRevocation";
import { publishProvisioningEvent } from "./provisioningStream";
import { sendInfrastructureReady } from "./clientNotifications";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, adminProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import type { User } from "../drizzle/schema";
import { matchOffers, type MatchCriteria } from "./matching";
import { notifyOwner } from "./_core/notification";
import { enforceRateLimit, clientIp } from "./rateLimit";
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
  input: { leadId: number; offerId: number; claimToken?: string },
  userId: number,
) {
  const offer = await getOffer(input.offerId);
  if (!offer) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Offer not found" });
  }
  const lead = await getLead(input.leadId);
  // A lead may be created anonymously (before login), then claimed at checkout.
  //  - Owned lead: only its owner may order against it.
  //  - Anonymous lead: the caller must present the signed claim token issued to
  //    the lead's creator (leads.create). A lead ID alone is NOT sufficient —
  //    otherwise any authenticated user could claim an arbitrary anonymous lead
  //    by enumerating IDs and then read its PII via leads.get once it is theirs.
  // NOT_FOUND for every failure so callers cannot probe which lead IDs exist.
  if (!lead) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Lead not found" });
  }
  if (lead.userId != null) {
    if (lead.userId !== userId) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Lead not found" });
    }
  } else if (!verifyLeadClaim(lead.id, input.claimToken)) {
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
    logout: publicProcedure.mutation(async ({ ctx }) => {
      // Server-side revocation: denylist this token's jti for its remaining
      // lifetime so a copy stolen before logout can't be replayed. No-op without
      // Redis (revocation disabled); clearing the cookie always happens.
      const token = parseCookieHeader(ctx.req.headers.cookie ?? "")[COOKIE_NAME];
      if (token) {
        const session = await sdk.verifySession(token);
        if (session?.jti && session.exp) {
          const ttlMs = session.exp * 1000 - Date.now();
          await revokeJti(session.jti, ttlMs);
        }
      }
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
          // RGPD: explicit consent is mandatory to capture the lead's PII and is
          // recorded server-side (consentedAt + policy version) as proof of
          // consent. z.literal(true) rejects a missing or false value.
          consent: z.literal(true),
        })
      )
      .mutation(async ({ input, ctx }) => {
        // Anti-abuse: throttle the public lead endpoint per client IP (5 / minute).
        const limit = await enforceRateLimit(`lead:${clientIp(ctx.req)}`, 5, 60_000);
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
          consentedAt: new Date(),
          consentPolicyVersion: CONSENT_POLICY_VERSION,
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

        // Issue the claim token so this browser can later order against — or match
        // on — the anonymous lead it just created (see createPendingOrder / offers.match).
        return {
          id: insertId,
          claimToken: insertId != null ? signLeadClaim(insertId) : undefined,
        };
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
      .input(
        z.object({
          leadId: z.number().int().positive().optional(),
          claimToken: z.string().optional(),
        })
      )
      .query(async ({ input, ctx }) => {
        const catalogue = await getAllOffers();
        let criteria: MatchCriteria = {};
        if (input.leadId != null) {
          const lead = await getLead(input.leadId);
          // A lead's GPU/budget criteria are as sensitive as the PII behind
          // leads.get: only fold them into the ranking if the caller proves they
          // may see them — owner/admin, or holder of the lead's claim token.
          // Otherwise ignore leadId (rank the full catalogue) so enumerating IDs
          // can't infer a prospect's requirements.
          const authorized =
            lead != null &&
            ((ctx.user != null &&
              (ctx.user.role === "admin" || lead.userId === ctx.user.id)) ||
              verifyLeadClaim(lead.id, input.claimToken));
          if (lead && authorized) {
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
      .input(
        z.object({
          leadId: z.number().int().positive(),
          offerId: z.number().int().positive(),
          // Proof the caller may claim an anonymous lead (see createPendingOrder).
          claimToken: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        // Anti-abuse: throttle per user (10 / minute). Each call fans out to ~8 DB
        // writes (order + 5 provisioning events + lead update), so keep it bounded
        // even though the client funnel goes through orders.checkout.
        const limit = await enforceRateLimit(`order-create:${ctx.user.id}`, 10, 60_000);
        if (!limit.allowed) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: "Too many requests. Please wait a moment and try again.",
          });
        }
        return createPendingOrder(input, ctx.user.id);
      }),

    // Creates the pending order and a Stripe-hosted Checkout session; returns the payment URL.
    // The webhook (POST /api/stripe/webhook) is the source of truth for payment status.
    checkout: protectedProcedure
      .input(
        z.object({
          leadId: z.number().int().positive(),
          offerId: z.number().int().positive(),
          // Proof the caller may claim an anonymous lead (see createPendingOrder).
          claimToken: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        // Anti-abuse: throttle checkout per authenticated user (10 / minute).
        // Keying on the user id (not IP) is precise and unspoofable here.
        const limit = await enforceRateLimit(`checkout:${ctx.user.id}`, 10, 60_000);
        if (!limit.allowed) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: "Too many checkout attempts. Please wait a moment and try again.",
          });
        }
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
        const order = await getOrder(input.id);
        if (!order) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
        }
        // Only advance a still-pending order to processing on success. Never derive
        // status from paymentStatus unconditionally: doing so would drag an already
        // advanced order (provisioning/active/completed) back to "pending" when a
        // later paymentStatus (e.g. a chargeback marked "failed") is recorded.
        const advanceToProcessing =
          input.paymentStatus === "succeeded" && order.status === "pending";
        await updateOrder(input.id, {
          paymentStatus: input.paymentStatus,
          stripePaymentIntentId: input.stripePaymentIntentId,
          ...(advanceToProcessing ? { status: "processing" as const } : {}),
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
        const status = input.status || "pending";
        const completedAt = status === "completed" ? new Date() : null;
        const result = await createProvisioningEvent({
          orderId: input.orderId,
          eventType: input.eventType,
          status,
          description: input.description,
          completedAt,
        });
        // Broadcast to any open SSE stream for this order so the client timeline
        // updates live. createProvisioningEvent returns the insert result, not the
        // row, so reconstruct the payload from the input + insertId.
        const insertId = Array.isArray(result)
          ? (result[0] as { insertId?: number } | undefined)?.insertId
          : undefined;
        publishProvisioningEvent(input.orderId, {
          id: insertId,
          orderId: input.orderId,
          eventType: input.eventType,
          status,
          description: input.description ?? null,
          completedAt,
        });
        // Best-effort: when provisioning completes, email the customer. Never let
        // an email failure break the admin mutation.
        if (input.eventType === "ready" && status === "completed") {
          try {
            const order = await getOrder(input.orderId);
            const lead = order ? await getLead(order.leadId) : null;
            if (lead?.email) await sendInfrastructureReady(lead.email, input.orderId);
          } catch (error) {
            console.warn("[Provisioning] infra-ready email failed:", String(error));
          }
        }
        return result;
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

    // Full order list for the admin CSV export (leads are already available via
    // leads.list). Admin-only; returns raw rows, the client builds the CSV.
    exportOrders: adminProcedure.query(async () => {
      return getAllOrders();
    }),
  }),
});

export type AppRouter = typeof appRouter;
