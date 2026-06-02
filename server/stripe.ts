import Stripe from "stripe";
import express, { type Express } from "express";
import { TRPCError } from "@trpc/server";
import { ENV } from "./_core/env";
import { updateOrder, getOrder, updateLead } from "./db";
import type { TrpcContext } from "./_core/context";

let _stripe: Stripe | null = null;

/** Returns a lazily-constructed Stripe client, or null if STRIPE_SECRET_KEY is not set. */
export function getStripe(): Stripe | null {
  if (!ENV.stripeSecretKey) return null;
  if (!_stripe) _stripe = new Stripe(ENV.stripeSecretKey);
  return _stripe;
}

/** Best-effort absolute origin for building Stripe success/cancel URLs. */
export function getOrigin(req: TrpcContext["req"]): string {
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

/**
 * Applies a verified Stripe event. Handles checkout.session.completed by marking the referenced
 * order paid. Returns true if it acted on the event. Pure of HTTP/raw-body concerns so it can be
 * unit-tested with a constructed event.
 */
export async function applyStripeEvent(event: Stripe.Event): Promise<boolean> {
  if (event.type !== "checkout.session.completed") return false;

  const session = event.data.object as Stripe.Checkout.Session;
  const orderId = Number(session.metadata?.orderId ?? session.client_reference_id);
  if (!Number.isFinite(orderId) || orderId <= 0) return false;

  const reference =
    typeof session.subscription === "string"
      ? session.subscription
      : typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.id;

  await updateOrder(orderId, {
    paymentStatus: "succeeded",
    status: "processing",
    stripePaymentIntentId: reference,
  });

  // Payment succeeded — the lead is genuinely converted now (not at checkout start).
  const order = await getOrder(orderId);
  if (order) {
    await updateLead(order.leadId, { status: "converted", selectedOfferId: order.offerId });
  }
  return true;
}

/**
 * Registers the Stripe webhook. MUST be mounted before express.json() so the raw request body
 * is available for signature verification. The webhook is the source of truth for payment status.
 */
export function registerStripeWebhook(app: Express) {
  app.post("/api/stripe/webhook", express.raw({ type: "*/*" }), async (req, res) => {
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
