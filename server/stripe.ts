import Stripe from "stripe";
import express, { type Express } from "express";
import { TRPCError } from "@trpc/server";
import { ENV } from "./_core/env";
import { updateOrder, getOrder, updateLead, getLead } from "./db";
import { enforceRateLimit, clientIp } from "./rateLimit";
import { sendOrderConfirmed } from "./clientNotifications";
import type { TrpcContext } from "./_core/context";

let _stripe: Stripe | null = null;

/** Returns a lazily-constructed Stripe client, or null if STRIPE_SECRET_KEY is not set. */
export function getStripe(): Stripe | null {
  if (!ENV.stripeSecretKey) return null;
  if (!_stripe) _stripe = new Stripe(ENV.stripeSecretKey);
  return _stripe;
}

/**
 * Absolute origin used to build Stripe success/cancel URLs and to validate the
 * OAuth state. When PUBLIC_BASE_URL is configured it is the single source of
 * truth — request headers (Origin / Host / X-Forwarded-Proto) are attacker-
 * influenceable and must not drive these URLs in production.
 */
export function getOrigin(req: TrpcContext["req"]): string {
  if (ENV.publicBaseUrl) return ENV.publicBaseUrl.replace(/\/+$/, "");
  // In production, refuse to fall back to request headers: a missing
  // PUBLIC_BASE_URL is a misconfiguration, not a reason to trust the Host header.
  if (ENV.isProduction) {
    throw new Error("PUBLIC_BASE_URL must be set in production to derive a trusted origin.");
  }
  const origin = req.headers.origin;
  if (typeof origin === "string" && origin.length > 0) return origin;
  const forwardedProto = req.headers["x-forwarded-proto"];
  const proto =
    (typeof forwardedProto === "string" ? forwardedProto : undefined) ?? req.protocol ?? "https";
  const host = req.headers.host;
  return host ? `${proto}://${host}` : "";
}

export interface CheckoutParams {
  orderId: number;
  leadId: number;
  offerId: number;
  offerName: string;
  monthlyPrice: string;
  setupFee: string;
  origin: string;
}

/**
 * Builds the Stripe Checkout Session parameters from server-side values (pure, no network).
 * Monthly fee is a recurring line item; the setup fee (if any) is a one-time line item billed
 * on the first invoice.
 */
export function buildCheckoutSessionParams(
  params: CheckoutParams,
): Stripe.Checkout.SessionCreateParams {
  const monthlyCents = Math.round(Number(params.monthlyPrice) * 100);
  const setupCents = Math.round(Number(params.setupFee) * 100);

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    {
      quantity: 1,
      price_data: {
        currency: "eur",
        unit_amount: monthlyCents,
        recurring: { interval: "month" },
        product_data: { name: `${params.offerName} — monthly` },
      },
    },
  ];

  if (setupCents > 0) {
    lineItems.push({
      quantity: 1,
      price_data: {
        currency: "eur",
        unit_amount: setupCents,
        product_data: { name: `${params.offerName} — one-time setup fee` },
      },
    });
  }

  return {
    mode: "subscription",
    line_items: lineItems,
    success_url: `${params.origin}/confirmation?orderId=${params.orderId}`,
    cancel_url: `${params.origin}/checkout?offerId=${params.offerId}&leadId=${params.leadId}`,
    client_reference_id: String(params.orderId),
    metadata: { orderId: String(params.orderId) },
  };
}

/** Creates a Stripe-hosted Checkout Session for an order and returns its URL. */
export async function createCheckoutSession(params: CheckoutParams): Promise<string | null> {
  const stripe = getStripe();
  if (!stripe) {
    throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Payments are not configured." });
  }
  const session = await stripe.checkout.sessions.create(buildCheckoutSessionParams(params));
  return session.url;
}

/** Resolves the order id a session refers to, or null if it carries none/invalid. */
function sessionOrderId(session: Stripe.Checkout.Session): number | null {
  const orderId = Number(session.metadata?.orderId ?? session.client_reference_id);
  return Number.isFinite(orderId) && orderId > 0 ? orderId : null;
}

/** A payment reference to persist (subscription > payment_intent > session id). */
function sessionReference(session: Stripe.Checkout.Session): string {
  return typeof session.subscription === "string"
    ? session.subscription
    : typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.id;
}

/**
 * Marks the referenced order paid, converts its lead, and emails the customer.
 * Idempotent: a re-delivery for an already-paid order is a no-op so later
 * transitions (provisioning, etc.) aren't clobbered.
 */
async function markSessionPaid(session: Stripe.Checkout.Session): Promise<boolean> {
  const orderId = sessionOrderId(session);
  if (orderId == null) return false;

  const order = await getOrder(orderId);
  if (!order) return false;
  if (order.paymentStatus === "succeeded") return true;

  await updateOrder(orderId, {
    paymentStatus: "succeeded",
    status: "processing",
    stripePaymentIntentId: sessionReference(session),
  });

  // Payment succeeded — the lead is genuinely converted now (not at checkout start).
  await updateLead(order.leadId, { status: "converted", selectedOfferId: order.offerId });

  // Best-effort: notify the customer their order is confirmed. Never let an email
  // failure break the webhook (Stripe would retry and double-process otherwise).
  try {
    const lead = await getLead(order.leadId);
    if (lead?.email) await sendOrderConfirmed(lead.email, orderId);
  } catch (error) {
    console.warn("[Stripe] order-confirmed email failed:", String(error));
  }
  return true;
}

/**
 * Applies a verified Stripe event. Returns true if it acted on the event. Pure of
 * HTTP/raw-body concerns so it can be unit-tested with a constructed event.
 *
 * Payment is confirmed by `session.payment_status`, NOT by the session merely
 * completing: for asynchronous methods (SEPA debit, etc.) `checkout.session.
 * completed` fires immediately with `payment_status: "unpaid"`, and the real
 * outcome arrives later as `checkout.session.async_payment_succeeded/failed`.
 * Treating "completed" as paid would provision infrastructure and book revenue
 * for a debit that may never clear.
 */
export async function applyStripeEvent(event: Stripe.Event): Promise<boolean> {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object as Stripe.Checkout.Session;
      // "paid" (card, immediate) or "no_payment_required" (100%-off) → fulfil.
      // "unpaid" here means an async method is still pending; wait for the
      // async_payment_succeeded/failed event and acknowledge this one as a no-op.
      if (session.payment_status === "paid" || session.payment_status === "no_payment_required") {
        return markSessionPaid(session);
      }
      // Async payment still pending: nothing to do yet. Acknowledge only if it
      // references a known order (mirrors the unknown-order/no-reference guards).
      const orderId = sessionOrderId(session);
      if (orderId == null) return false;
      const order = await getOrder(orderId);
      return order != null;
    }

    case "checkout.session.async_payment_failed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const orderId = sessionOrderId(session);
      if (orderId == null) return false;
      const order = await getOrder(orderId);
      if (!order || order.paymentStatus === "succeeded") return order != null;
      // The deferred payment did not clear: mark the order failed and cancel it so
      // no infrastructure is provisioned for it. The lead stays "offered".
      await updateOrder(orderId, { paymentStatus: "failed", status: "cancelled" });
      return true;
    }

    default:
      return false;
  }
}

/**
 * Registers the Stripe webhook. MUST be mounted before express.json() so the raw request body
 * is available for signature verification. The webhook is the source of truth for payment status.
 */
export function registerStripeWebhook(app: Express) {
  app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), async (req, res) => {
    // Generous per-IP throttle: signature verification already gates real abuse,
    // so this only blunts floods. Kept high enough not to drop Stripe's legitimate
    // burst retries after an outage.
    const limit = await enforceRateLimit(`stripe-webhook:${clientIp(req)}`, 100, 60_000);
    if (!limit.allowed) {
      res.status(429).send("Too many requests.");
      return;
    }

    const stripe = getStripe();
    if (!stripe || !ENV.stripeWebhookSecret) {
      res.status(503).send("Stripe is not configured.");
      return;
    }

    const signature = req.headers["stripe-signature"];
    if (typeof signature !== "string") {
      res.status(400).send("Missing stripe-signature header.");
      return;
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(req.body, signature, ENV.stripeWebhookSecret);
    } catch (err) {
      console.warn("[Stripe] Webhook signature verification failed:", err);
      res.status(400).send("Webhook signature verification failed.");
      return;
    }

    try {
      await applyStripeEvent(event);
    } catch (err) {
      console.error("[Stripe] Failed to process webhook event:", err);
      res.status(500).send("Webhook handler error.");
      return;
    }

    res.json({ received: true });
  });
}
