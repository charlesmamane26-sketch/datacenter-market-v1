import { COOKIE_NAME, CONSENT_POLICY_VERSION, PURCHASE_TERMS_VERSION } from "@shared/const";
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
import type { Lead, User } from "../drizzle/schema";
import { matchOffers, type MatchCriteria } from "./matching";
import { notifyOwner } from "./_core/notification";
import { enforceRateLimit, clientIp } from "./rateLimit";
import {
  createCheckoutSession,
  getCheckoutSessionReferences,
  getCheckoutSessionRedirectUrl,
  getStripe,
  getOrigin,
  retrieveCheckoutSession,
  cancelStripeResourcesForOrder,
} from "./stripe";
import { z } from "zod";
import {
  createLead,
  getLead,
  updateLead,
  getAllLeads,
  deleteLead,
  getAllOffers,
  getOffer,
  getAllProviders,
  getProvider,
  createProvider as createProviderRecord,
  updateProvider as updateProviderRecord,
  getInventoryOffers,
  updateOfferInventory,
  createOrder,
  getOrder,
  getOrdersByUser,
  getAllOrders,
  transitionOrderStatus,
  getProvisioningEventsByOrder,
  createProvisioningEvent,
  createProvisioningEventAndAdvanceOrder,
  getLatestMetricsForOrder,
  CheckoutConflictError,
  InventoryConflictError,
  compensateFailedCheckout,
  createCheckoutOrderAtomic,
  getOrderByCheckoutIdempotencyKey,
  linkOrderStripeReferences,
  releaseExpiredCheckout,
  ensureCheckoutOrderReservation,
  updateOrderPaymentStatusAtomic,
} from "./db";
import { OrderLifecycleError } from "./orderLifecycle";
import { isAvailabilityStale, isOfferSellable } from "./inventory";

export const CHECKOUT_CONFLICT_CODES = {
  capacityUnavailable: "CHECKOUT_CAPACITY_UNAVAILABLE",
  offerExpired: "CHECKOUT_OFFER_EXPIRED",
  offerUnavailable: "CHECKOUT_OFFER_UNAVAILABLE",
  idempotencyConflict: "CHECKOUT_IDEMPOTENCY_CONFLICT",
  sessionUnavailable: "CHECKOUT_SESSION_UNAVAILABLE",
  leadConflict: "CHECKOUT_LEAD_CONFLICT",
} as const;

function checkoutConflictMessage(error: CheckoutConflictError): string {
  const code =
    error.reason === "capacity_unavailable"
      ? CHECKOUT_CONFLICT_CODES.capacityUnavailable
      : error.reason === "offer_expired"
        ? CHECKOUT_CONFLICT_CODES.offerExpired
        : error.reason === "offer_unavailable"
          ? CHECKOUT_CONFLICT_CODES.offerUnavailable
          : error.reason === "idempotency_conflict"
            ? CHECKOUT_CONFLICT_CODES.idempotencyConflict
            : error.reason === "lead_conflict"
              ? CHECKOUT_CONFLICT_CODES.leadConflict
              : CHECKOUT_CONFLICT_CODES.sessionUnavailable;
  return `${code}: ${error.message}`;
}

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

const MAX_INVENTORY_TTL_MS = 30 * 24 * 60 * 60 * 1_000;
const inventoryExpirySchema = z.union([
  z.coerce
    .date()
    .refine(date => date.getTime() > Date.now(), "Inventory expiry must be in the future.")
    .refine(
      date => date.getTime() <= Date.now() + MAX_INVENTORY_TTL_MS,
      "Inventory expiry cannot exceed 30 days.",
    ),
  z.null(),
]);

/**
 * Creates a pending order from a lead + offer: validates both, derives pricing server-side,
 * seeds the provisioning timeline, and marks the lead offered. Returns the order summary
 * (plus the resolved offer). Throws NOT_FOUND if the offer or lead is missing.
 */
async function createPendingOrder(
  input: { leadId: number; offerId: number; claimToken?: string },
  userId: number,
  checkout?: {
    idempotencyKey: string;
    termsAcceptedAt: Date;
    termsVersion: string;
  },
) {
  const offer = await getOffer(input.offerId);
  if (!offer) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Offer not found" });
  }
  const hasInventorySnapshot =
    typeof offer.isActive === "boolean" &&
    typeof offer.availableCapacity === "number" &&
    typeof offer.availabilityStatus === "string" &&
    "availabilityExpiresAt" in offer;
  if (hasInventorySnapshot && isAvailabilityStale(offer)) {
    throw new TRPCError({
      code: "CONFLICT",
      message: `${CHECKOUT_CONFLICT_CODES.offerExpired}: this offer's availability confirmation has expired.`,
    });
  }
  if (hasInventorySnapshot && offer.availableCapacity <= 0) {
    throw new TRPCError({
      code: "CONFLICT",
      message: `${CHECKOUT_CONFLICT_CODES.capacityUnavailable}: this offer has no capacity available.`,
    });
  }
  if (hasInventorySnapshot && !isOfferSellable(offer)) {
    throw new TRPCError({
      code: "CONFLICT",
      message: `${CHECKOUT_CONFLICT_CODES.offerUnavailable}: this offer is no longer available.`,
    });
  }
  if (offer.providerId == null) {
    throw new TRPCError({ code: "CONFLICT", message: "Offer supplier is not assigned." });
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
  if (lead.status === "converted" || lead.status === "rejected") {
    throw new TRPCError({
      code: "CONFLICT",
      message: `A lead in status ${lead.status} cannot start a new order.`,
    });
  }

  // Pricing is derived server-side — never trust client-supplied amounts.
  const monthlyRecurring = offer.monthlyPrice;
  const setupFee = offer.setupFee ?? "0";
  const totalAmount = sumMoney(monthlyRecurring, setupFee);

  const orderValues = {
    userId,
    leadId: input.leadId,
    offerId: input.offerId,
    providerId: offer.providerId,
    totalAmount,
    setupFee,
    monthlyRecurring,
    status: "pending",
    paymentStatus: "pending",
    ...(checkout
      ? {
          checkoutIdempotencyKey: checkout.idempotencyKey,
          termsAcceptedAt: checkout.termsAcceptedAt,
          termsVersion: checkout.termsVersion,
        }
      : {}),
  } as const;

  let insertId: number | undefined;
  let persistedOrder: Awaited<ReturnType<typeof getOrder>> = null;
  let created = true;
  let checkoutSnapshot: {
    previousLeadStatus: Lead["status"];
    previousSelectedOfferId: number | null;
  } | null = null;
  if (checkout) {
    try {
      const result = await createCheckoutOrderAtomic({
        order: {
          ...orderValues,
          checkoutIdempotencyKey: checkout.idempotencyKey,
          termsAcceptedAt: checkout.termsAcceptedAt,
          termsVersion: checkout.termsVersion,
        },
        events: INITIAL_PROVISIONING_EVENTS.map(event => ({ ...event })),
        expectedLeadUserId: lead.userId,
      });
      persistedOrder = result.order;
      insertId = result.order.id;
      created = result.created;
      if (result.created) {
        checkoutSnapshot = {
          previousLeadStatus: result.previousLeadStatus,
          previousSelectedOfferId: result.previousSelectedOfferId,
        };
      }
      if (result.order.leadId !== input.leadId || result.order.offerId !== input.offerId) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This checkout idempotency key is already bound to another order.",
        });
      }
    } catch (error) {
      if (error instanceof CheckoutConflictError) {
        throw new TRPCError({ code: "CONFLICT", message: checkoutConflictMessage(error) });
      }
      throw error;
    }
  } else {
    const result = await createOrder(orderValues);
    insertId = Array.isArray(result)
      ? (result[0] as { insertId?: number } | undefined)?.insertId
      : undefined;
  }

  // Legacy/internal orders.create keeps its established write path. Checkout uses
  // createCheckoutOrderAtomic, which seeds events and claims the lead transactionally.
  if (!checkout && insertId != null) {
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
  if (!checkout) {
    await updateLead(input.leadId, {
      status: "offered",
      selectedOfferId: input.offerId,
      userId: lead.userId ?? userId,
    });
  }

  return {
    id: insertId,
    leadId: lead.id,
    offerId: offer.id,
    totalAmount: persistedOrder?.totalAmount ?? totalAmount,
    setupFee: persistedOrder?.setupFee ?? setupFee,
    monthlyRecurring: persistedOrder?.monthlyRecurring ?? monthlyRecurring,
    status: persistedOrder?.status ?? ("pending" as const),
    paymentStatus: persistedOrder?.paymentStatus ?? ("pending" as const),
    offer,
    created,
    checkoutSnapshot,
    stripeCheckoutSessionId: persistedOrder?.stripeCheckoutSessionId ?? null,
  };
}

function rethrowOrderLifecycleError(error: unknown): never {
  if (error instanceof OrderLifecycleError) {
    throw new TRPCError({ code: "CONFLICT", message: error.message });
  }
  throw error;
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
          // Reject a stale browser tab instead of recording the current policy
          // version for text the user did not actually see.
          consentPolicyVersion: z.literal(CONSENT_POLICY_VERSION),
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
          consentPolicyVersion: input.consentPolicyVersion,
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
          // "converted" is reserved to journaled Stripe payment transitions.
          status: z.enum(["new", "qualified", "offered", "rejected"]).optional(),
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
        const ranked = [
          { ...result.bestValue, category: "best_value" as const },
          { ...result.fastest, category: "fastest" as const },
          { ...result.cheapest, category: "cheapest" as const },
        ];
        const unique = new Map<
          number,
          (typeof ranked)[number] & { categories: Array<(typeof ranked)[number]["category"]> }
        >();
        for (const candidate of ranked) {
          const existing = unique.get(candidate.id);
          if (existing) {
            existing.categories.push(candidate.category);
          } else {
            unique.set(candidate.id, { ...candidate, categories: [candidate.category] });
          }
        }
        return Array.from(unique.values());
      }),

    get: publicProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ input }) => {
        return getOffer(input.id, { sellableOnly: true });
      }),
  }),

  // Supplier and operational catalogue management. Pricing/specification edits
  // stay outside this surface; this router only controls whether existing,
  // server-priced offers are currently safe to sell.
  inventory: router({
    listProviders: adminProcedure.query(async () => {
      return getAllProviders();
    }),

    createProvider: adminProcedure
      .input(
        z.object({
          name: z.string().trim().min(2).max(255),
          slug: z
            .string()
            .trim()
            .min(2)
            .max(100)
            .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
          isActive: z.boolean().optional(),
          contactEmail: z.string().trim().email().max(320).nullable().optional(),
          website: z.string().trim().url().max(500).nullable().optional(),
          notes: z.string().trim().max(5_000).nullable().optional(),
        }),
      )
      .mutation(async ({ input }) => {
        const provider = await createProviderRecord(input);
        if (!provider) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Provider was created but could not be reloaded.",
          });
        }
        return provider;
      }),

    updateProvider: adminProcedure
      .input(
        z
          .object({
            id: z.number().int().positive(),
            name: z.string().trim().min(2).max(255).optional(),
            slug: z
              .string()
              .trim()
              .min(2)
              .max(100)
              .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
              .optional(),
            isActive: z.boolean().optional(),
            contactEmail: z.string().trim().email().max(320).nullable().optional(),
            website: z.string().trim().url().max(500).nullable().optional(),
            notes: z.string().trim().max(5_000).nullable().optional(),
          })
          .refine(({ id: _id, ...patch }) => Object.values(patch).some(value => value !== undefined), {
            message: "At least one provider field must be supplied.",
          }),
      )
      .mutation(async ({ input }) => {
        const { id, ...patch } = input;
        const provider = await updateProviderRecord(id, patch);
        if (!provider) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Provider not found" });
        }
        return provider;
      }),

    listOffers: adminProcedure.query(async () => {
      return getInventoryOffers();
    }),

    updateOffer: adminProcedure
      .input(
        z
          .object({
            id: z.number().int().positive(),
            expectedVersion: z.number().int().positive(),
            providerId: z.number().int().positive().nullable().optional(),
            isActive: z.boolean().optional(),
            availabilityStatus: z
              .enum(["available", "limited", "unavailable", "maintenance"])
              .optional(),
            availableCapacity: z.number().int().min(0).max(1_000_000).optional(),
            availabilityExpiresAt: inventoryExpirySchema.optional(),
          })
          .refine(
            ({ id: _id, expectedVersion: _expectedVersion, ...patch }) =>
              Object.values(patch).some(value => value !== undefined),
            { message: "At least one inventory field must be supplied." },
          ),
      )
      .mutation(async ({ input }) => {
        const { id, expectedVersion, ...patch } = input;
        if (patch.providerId != null && !(await getProvider(patch.providerId))) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Provider not found" });
        }
        let offer;
        try {
          offer = await updateOfferInventory(id, expectedVersion, patch);
        } catch (error) {
          if (error instanceof InventoryConflictError) {
            throw new TRPCError({ code: "CONFLICT", message: error.message });
          }
          throw error;
        }
        if (!offer) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Offer not found" });
        }
        return offer;
      }),
  }),

  // Orders router
  orders: router({
    // Creates the pending order and a Stripe-hosted Checkout session; returns the payment URL.
    // The webhook (POST /api/stripe/webhook) is the source of truth for payment status.
    checkout: protectedProcedure
      .input(
        z.object({
          leadId: z.number().int().positive(),
          offerId: z.number().int().positive(),
          // Proof the caller may claim an anonymous lead (see createPendingOrder).
          claimToken: z.string().optional(),
          termsAccepted: z.literal(true),
          // Bind the server-side evidence to the exact text rendered by this
          // client. Old tabs must reload after a terms-version deployment.
          termsVersion: z.literal(PURCHASE_TERMS_VERSION),
          idempotencyKey: z.string().trim().min(16).max(128),
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
        const existing = await getOrderByCheckoutIdempotencyKey(ctx.user.id, input.idempotencyKey);
        if (existing && (existing.leadId !== input.leadId || existing.offerId !== input.offerId)) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `${CHECKOUT_CONFLICT_CODES.idempotencyConflict}: this key is already bound to another order.`,
          });
        }

        const pendingOrder = existing
          ? null
          : await createPendingOrder(input, ctx.user.id, {
              idempotencyKey: input.idempotencyKey,
              termsAcceptedAt: new Date(),
              termsVersion: input.termsVersion,
            });
        const order = existing ?? pendingOrder;
        const compensation =
          pendingOrder?.created && pendingOrder.id && pendingOrder.checkoutSnapshot
            ? {
                orderId: pendingOrder.id,
                userId: ctx.user.id,
                idempotencyKey: input.idempotencyKey,
                previousLeadStatus: pendingOrder.checkoutSnapshot.previousLeadStatus,
                previousSelectedOfferId: pendingOrder.checkoutSnapshot.previousSelectedOfferId,
              }
            : null;

        try {
          if (!order?.id) {
            throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Checkout order is incomplete." });
          }
          let session;
          if (order.stripeCheckoutSessionId) {
            // Inventory may legitimately expire after a Checkout Session was
            // created. Idempotent retries must resume that immutable Stripe
            // session rather than re-evaluate today's catalogue availability.
            session = await retrieveCheckoutSession(order.stripeCheckoutSessionId);
            if (session.status === "expired") {
              // This is an explicit remote terminal state, not a transport
              // failure. Release only the local live-order gate so the client
              // can rotate its idempotency key and start a fresh checkout.
              await releaseExpiredCheckout({
                orderId: order.id,
                userId: ctx.user.id,
                idempotencyKey: input.idempotencyKey,
                checkoutSessionId: order.stripeCheckoutSessionId,
              });
              throw new TRPCError({
                code: "CONFLICT",
                message: `${CHECKOUT_CONFLICT_CODES.sessionUnavailable}: this Checkout Session is no longer payable. Start a new checkout attempt.`,
              });
            }
            await ensureCheckoutOrderReservation({
              orderId: order.id,
              userId: ctx.user.id,
              idempotencyKey: input.idempotencyKey,
            });
          } else {
            await ensureCheckoutOrderReservation({
              orderId: order.id,
              userId: ctx.user.id,
              idempotencyKey: input.idempotencyKey,
            });
            // Re-read immediately before creating remote state. The atomic path
            // already validated inventory; this second gate covers an admin
            // change between local persistence and Stripe Session creation.
            const sellableOffer = await getOffer(order.offerId);
            const hasCurrentInventorySnapshot =
              sellableOffer != null &&
              typeof sellableOffer.isActive === "boolean" &&
              typeof sellableOffer.availabilityStatus === "string" &&
              "availabilityExpiresAt" in sellableOffer;
            if (
              !sellableOffer ||
              (hasCurrentInventorySnapshot &&
                !isOfferSellable({ ...sellableOffer, availableCapacity: 1 }))
            ) {
              throw new TRPCError({
                code: "CONFLICT",
                message: `${CHECKOUT_CONFLICT_CODES.offerUnavailable}: this offer is no longer available.`,
              });
            }
            session = await createCheckoutSession(
              {
                orderId: order.id,
                leadId: order.leadId,
                offerId: order.offerId,
                offerName: sellableOffer.name,
                monthlyPrice: order.monthlyRecurring,
                setupFee: order.setupFee ?? "0",
                origin,
              },
              `checkout:${ctx.user.id}:${input.idempotencyKey}`,
            );
          }
          const refs = getCheckoutSessionReferences(session);
          await linkOrderStripeReferences(order.id, {
            checkoutSessionId: refs.sessionId,
            customerId: refs.customerId,
            subscriptionId: refs.subscriptionId,
            subscriptionStatus: refs.subscriptionStatus,
          });
          return {
            orderId: order.id,
            url: getCheckoutSessionRedirectUrl(session, order.id, origin),
          };
        } catch (error) {
          if (compensation) {
            try {
              await compensateFailedCheckout(compensation);
            } catch (compensationError) {
              // Preserve the checkout error seen by the caller. The stale-order
              // job remains a final safety net if this best-effort cleanup fails.
              console.error(
                `[Checkout] Could not compensate order ${compensation.orderId}:`,
                String(compensationError),
              );
            }
          }
          if (error instanceof CheckoutConflictError) {
            throw new TRPCError({ code: "CONFLICT", message: checkoutConflictMessage(error) });
          }
          throw error;
        }
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
          stripePaymentIntentId: z.string().trim().min(1).max(255).optional(),
        })
      )
      .mutation(async ({ input }) => {
        let order;
        try {
          order = await updateOrderPaymentStatusAtomic(
            input.id,
            input.paymentStatus,
            input.stripePaymentIntentId,
          );
        } catch (error) {
          if (error instanceof CheckoutConflictError) {
            throw new TRPCError({ code: "CONFLICT", message: checkoutConflictMessage(error) });
          }
          rethrowOrderLifecycleError(error);
        }
        if (!order) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
        }
        return order;
      }),

    updateStatus: adminProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          status: z.enum(["pending", "processing", "provisioning", "active", "cancelled", "completed"]),
        })
      )
      .mutation(async ({ input }) => {
        try {
          const current = await getOrder(input.id);
          if (!current) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
          }
          const terminal = input.status === "cancelled"
            ? await cancelStripeResourcesForOrder(current)
            : null;
          const order = await transitionOrderStatus(
            input.id,
            input.status,
            terminal
              ? {
                  stripeSubscriptionId: terminal.subscriptionId,
                  stripeTerminalAt: new Date(),
                }
              : undefined,
          );
          if (!order) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
          }
          return order;
        } catch (error) {
          rethrowOrderLifecycleError(error);
        }
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
          description: z.string().trim().max(2_000).optional(),
        })
      )
      .mutation(async ({ input }) => {
        const status = input.status || "pending";
        const completedAt = status === "completed" ? new Date() : null;
        let aggregate;
        try {
          aggregate = await createProvisioningEventAndAdvanceOrder({
            orderId: input.orderId,
            eventType: input.eventType,
            status,
            description: input.description,
            completedAt,
          });
        } catch (error) {
          rethrowOrderLifecycleError(error);
        }
        if (!aggregate) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
        }

        // Publish only after the transaction commits, so readers can immediately
        // reload a timeline and order summary which agree with the SSE payload.
        publishProvisioningEvent(input.orderId, aggregate.event);
        // Best-effort: when provisioning completes, email the customer. Never let
        // an email failure break the admin mutation.
        if (input.eventType === "ready" && status === "completed") {
          try {
            const lead = await getLead(aggregate.order.leadId);
            if (lead?.email) await sendInfrastructureReady(lead.email, input.orderId);
          } catch (error) {
            console.warn("[Provisioning] infra-ready email failed:", String(error));
          }
        }
        return aggregate;
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
      const billableOrders = allOrders.filter(
        o =>
          o.paymentStatus === "succeeded" &&
          (o.status === "processing" || o.status === "provisioning" || o.status === "active"),
      );
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
