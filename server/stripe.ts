import Stripe from "stripe";
import express, { type Express } from "express";
import { TRPCError } from "@trpc/server";
import { ENV } from "./_core/env";
import {
  claimStripeEvent,
  completeStripeEvent,
  failStripeEvent,
  getLead,
  getOrder,
  getOrderByStripeCheckoutSessionId,
  getOrderByStripeSubscriptionId,
  type StripeTransitionPlan,
} from "./db";
import { enforceRateLimit, clientIp } from "./rateLimit";
import { sendOrderConfirmed, sendPaymentFailed } from "./clientNotifications";
import type { TrpcContext } from "./_core/context";

let _stripe: Stripe | null = null;
let configurationWarningLogged = false;

export type StripeSecretKeyMode = "missing" | "test" | "live" | "invalid";

export type StripeConfigurationIssue =
  | "secret_key_missing"
  | "secret_key_invalid"
  | "webhook_secret_missing"
  | "webhook_secret_invalid"
  | "live_payments_disabled"
  | "public_base_url_missing"
  | "public_base_url_invalid";

export interface StripeConfigurationInput {
  secretKey: string;
  webhookSecret: string;
  livePaymentsEnabled: boolean;
  publicBaseUrl: string;
  isProduction: boolean;
}

export interface StripeConfigurationStatus {
  mode: StripeSecretKeyMode;
  ready: boolean;
  secretKeyConfigured: boolean;
  webhookSecretConfigured: boolean;
  publicBaseUrlConfigured: boolean;
  issues: StripeConfigurationIssue[];
}

/** Classify both standard and restricted Stripe API keys without exposing them. */
export function getStripeSecretKeyMode(secretKey: string): StripeSecretKeyMode {
  const key = secretKey.trim();
  if (!key) return "missing";
  if (/^(?:sk|rk)_test_.+/.test(key)) return "test";
  if (/^(?:sk|rk)_live_.+/.test(key)) return "live";
  return "invalid";
}

function isValidPublicBaseUrl(value: string, requireHttps: boolean): boolean {
  try {
    const url = new URL(value);
    const validProtocol = requireHttps
      ? url.protocol === "https:"
      : url.protocol === "https:" || url.protocol === "http:";
    return (
      validProtocol &&
      Boolean(url.hostname) &&
      !url.username &&
      !url.password &&
      (url.pathname === "" || url.pathname === "/") &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}

/**
 * Pure operational readiness evaluation. Checkout is ready only when its API
 * key and webhook signing secret are configured as a pair; production also
 * requires the trusted HTTPS origin used for Stripe return URLs.
 */
export function evaluateStripeConfiguration(
  input: StripeConfigurationInput,
): StripeConfigurationStatus {
  const secretKey = input.secretKey.trim();
  const webhookSecret = input.webhookSecret.trim();
  const publicBaseUrl = input.publicBaseUrl.trim();
  const mode = getStripeSecretKeyMode(secretKey);
  const issues: StripeConfigurationIssue[] = [];

  if (mode === "missing") issues.push("secret_key_missing");
  if (mode === "invalid") issues.push("secret_key_invalid");

  if (!webhookSecret) issues.push("webhook_secret_missing");
  else if (!/^whsec_.+/.test(webhookSecret)) issues.push("webhook_secret_invalid");

  if (mode === "live" && !input.livePaymentsEnabled) {
    issues.push("live_payments_disabled");
  }

  if (input.isProduction && !publicBaseUrl) {
    issues.push("public_base_url_missing");
  } else if (
    publicBaseUrl &&
    !isValidPublicBaseUrl(publicBaseUrl, input.isProduction)
  ) {
    issues.push("public_base_url_invalid");
  }

  return {
    mode,
    ready: issues.length === 0,
    secretKeyConfigured: Boolean(secretKey),
    webhookSecretConfigured: Boolean(webhookSecret),
    publicBaseUrlConfigured: Boolean(publicBaseUrl),
    issues,
  };
}

/** Sanitized Stripe readiness status suitable for health/admin diagnostics. */
export function getStripeConfigurationStatus(): StripeConfigurationStatus {
  return evaluateStripeConfiguration({
    secretKey: ENV.stripeSecretKey,
    webhookSecret: ENV.stripeWebhookSecret,
    livePaymentsEnabled: ENV.stripeLivePaymentsEnabled,
    publicBaseUrl: ENV.publicBaseUrl,
    isProduction: ENV.isProduction,
  });
}

/** Returns a lazily-constructed Stripe client only for a fully safe configuration. */
export function getStripe(): Stripe | null {
  const status = getStripeConfigurationStatus();
  if (!status.ready) {
    if (!configurationWarningLogged) {
      configurationWarningLogged = true;
      console.error(`[Stripe] Payments disabled: ${status.issues.join(", ")}.`);
    }
    return null;
  }
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
  const configuredPublicBaseUrl = ENV.publicBaseUrl.trim();
  if (configuredPublicBaseUrl) {
    if (!isValidPublicBaseUrl(configuredPublicBaseUrl, ENV.isProduction)) {
      throw new Error(
        `PUBLIC_BASE_URL must be an absolute ${ENV.isProduction ? "https:// " : "http(s):// "}origin without a path, query, or fragment.`,
      );
    }
    return configuredPublicBaseUrl.replace(/\/+$/, "");
  }
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
    // Invoice/subscription events do not reliably copy Checkout Session metadata.
    // Put the immutable order reference on the subscription itself as well.
    subscription_data: { metadata: { orderId: String(params.orderId) } },
  };
}

/** Creates one Stripe-hosted Checkout Session per application idempotency key. */
export async function createCheckoutSession(
  params: CheckoutParams,
  idempotencyKey: string,
): Promise<Stripe.Checkout.Session> {
  const stripe = getStripe();
  if (!stripe) {
    throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Payments are not configured." });
  }
  return stripe.checkout.sessions.create(buildCheckoutSessionParams(params), { idempotencyKey });
}

export async function retrieveCheckoutSession(sessionId: string): Promise<Stripe.Checkout.Session> {
  const stripe = getStripe();
  if (!stripe) {
    throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Payments are not configured." });
  }
  return stripe.checkout.sessions.retrieve(sessionId);
}

/**
 * Chooses a safe destination when an application-level checkout request is retried.
 * An open Stripe session can still be paid; a completed session belongs on our
 * confirmation page (including deferred payments that are still pending). An
 * expired session must never be presented as payable again.
 */
export function getCheckoutSessionRedirectUrl(
  session: Stripe.Checkout.Session,
  orderId: number,
  origin: string,
): string {
  const confirmationUrl = `${origin.replace(/\/+$/, "")}/confirmation?orderId=${orderId}`;
  const paid = session.payment_status === "paid" || session.payment_status === "no_payment_required";
  if (paid || session.status === "complete") return confirmationUrl;
  if (session.status === "open" && session.url) return session.url;

  throw new TRPCError({
    code: "CONFLICT",
    message: "This Checkout Session is no longer payable. Start a new checkout attempt.",
  });
}

function objectId(value: unknown): string | null {
  if (typeof value === "string" && value.length > 0) return value;
  if (value && typeof value === "object" && typeof (value as { id?: unknown }).id === "string") {
    return (value as { id: string }).id;
  }
  return null;
}

function metadataOrderId(value: unknown): number | null {
  if (!value || typeof value !== "object") return null;
  const metadata = (value as { metadata?: unknown }).metadata;
  if (!metadata || typeof metadata !== "object") return null;
  const parsed = Number((metadata as { orderId?: unknown }).orderId);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function subscriptionStatus(value: unknown): string | null {
  return value && typeof value === "object" && typeof (value as { status?: unknown }).status === "string"
    ? (value as { status: string }).status
    : null;
}

export function getCheckoutSessionReferences(session: Stripe.Checkout.Session) {
  return {
    sessionId: session.id,
    customerId: objectId(session.customer),
    subscriptionId: objectId(session.subscription),
    subscriptionStatus: subscriptionStatus(session.subscription),
    paymentReference:
      objectId(session.payment_intent) ?? objectId(session.subscription) ?? session.id,
  };
}

function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const raw = invoice as unknown as {
    subscription?: unknown;
    parent?: { subscription_details?: { subscription?: unknown } };
  };
  return objectId(raw.subscription) ?? objectId(raw.parent?.subscription_details?.subscription);
}

function invoiceOrderId(invoice: Stripe.Invoice): number | null {
  const raw = invoice as unknown as {
    parent?: { subscription_details?: { metadata?: unknown } };
  };
  return metadataOrderId(invoice) ?? metadataOrderId(raw.parent?.subscription_details);
}

function invoicePaymentReference(invoice: Stripe.Invoice): string | null {
  const raw = invoice as unknown as { payment_intent?: unknown; charge?: unknown };
  return objectId(raw.payment_intent) ?? objectId(raw.charge);
}

async function resolveSubscriptionOrder(subscriptionId: string | null, fallbackOrderId: number | null) {
  if (subscriptionId) {
    const bySubscription = await getOrderByStripeSubscriptionId(subscriptionId);
    if (bySubscription) return bySubscription;
  }
  return fallbackOrderId != null ? getOrder(fallbackOrderId) : null;
}

function stripeReferencePatch(refs: {
  customerId?: string | null;
  subscriptionId?: string | null;
  subscriptionStatus?: string | null;
  paymentReference?: string | null;
}): NonNullable<StripeTransitionPlan["order"]> {
  return {
    ...(refs.customerId ? { stripeCustomerId: refs.customerId } : {}),
    ...(refs.subscriptionId ? { stripeSubscriptionId: refs.subscriptionId } : {}),
    ...(refs.subscriptionStatus ? { stripeSubscriptionStatus: refs.subscriptionStatus } : {}),
    ...(refs.paymentReference ? { stripePaymentIntentId: refs.paymentReference } : {}),
  };
}

async function notifyCustomer(
  kind: "confirmed" | "failed",
  order: { id: number; leadId: number } | null,
): Promise<void> {
  if (!order) return;
  try {
    const lead = await getLead(order.leadId);
    if (!lead?.email) return;
    if (kind === "confirmed") await sendOrderConfirmed(lead.email, order.id);
    else await sendPaymentFailed(lead.email, order.id);
  } catch (error) {
    console.warn(`[Stripe] ${kind} email failed:`, String(error));
  }
}

async function applyCheckoutEvent(event: Stripe.Event, session: Stripe.Checkout.Session): Promise<boolean> {
  if (!session.id) {
    await completeStripeEvent(event.id, null, event.created, "checkout");
    return false;
  }
  const order = await getOrderByStripeCheckoutSessionId(session.id);
  if (!order) {
    // Never trust metadata alone for Checkout events: the session id persisted at
    // creation is the binding between this Stripe object and the local order.
    await completeStripeEvent(event.id, null, event.created, "checkout");
    return false;
  }

  const refs = getCheckoutSessionReferences(session);
  const isPaid = session.payment_status === "paid" || session.payment_status === "no_payment_required";
  const isFailed = event.type === "checkout.session.async_payment_failed";
  let notify: "confirmed" | "failed" | null = null;
  const result = await completeStripeEvent(event.id, order.id, event.created, "checkout", current => {
    if (current.stripeCheckoutSessionId !== session.id) {
      throw new Error("Stripe Checkout Session does not match the persisted order binding.");
    }
    const referencePatch = stripeReferencePatch(refs);
    if (isPaid) {
      if (current.stripeTerminalAt) {
        // A deleted/cancelled/unpaid subscription is terminal for this order.
        // Even a later paid Checkout event must not resurrect it.
        return Object.keys(referencePatch).length > 0 ? { order: referencePatch } : null;
      }
      if (current.paymentStatus !== "succeeded") notify = "confirmed";
      return {
        order: {
          ...referencePatch,
          paymentStatus: "succeeded",
          ...(current.status === "pending" || current.status === "cancelled"
            ? { status: "processing" as const }
            : {}),
        },
        // Always repair the lead invariant, even if an older/manual path already
        // marked the order paid before this journaled event arrived.
        lead: { status: "converted", selectedOfferId: current.offerId },
      };
    }
    if (isFailed && current.paymentStatus !== "succeeded") {
      if (current.paymentStatus !== "failed" && current.status !== "cancelled") notify = "failed";
      return { order: { ...referencePatch, paymentStatus: "failed", status: "cancelled" } };
    }
    return Object.keys(referencePatch).length > 0 ? { order: referencePatch } : null;
  });
  if (notify && result.changed) await notifyCustomer(notify, result.order);
  return true;
}

async function applyInvoiceEvent(event: Stripe.Event, invoice: Stripe.Invoice): Promise<boolean> {
  const subscriptionId = invoiceSubscriptionId(invoice);
  const order = await resolveSubscriptionOrder(subscriptionId, invoiceOrderId(invoice));
  if (!order) {
    await completeStripeEvent(event.id, null, event.created, "invoice");
    return false;
  }
  const customerId = objectId(invoice.customer);
  const paymentReference = invoicePaymentReference(invoice);
  const paid = event.type === "invoice.paid";
  const actionRequired = event.type === "invoice.payment_action_required";
  let notify: "confirmed" | "failed" | null = null;
  const result = await completeStripeEvent(event.id, order.id, event.created, "invoice", current => {
    if (subscriptionId && current.stripeSubscriptionId && current.stripeSubscriptionId !== subscriptionId) {
      throw new Error("Stripe invoice subscription does not match the persisted order binding.");
    }
    const referencePatch = stripeReferencePatch({ customerId, subscriptionId, paymentReference });
    if (paid) {
      if (current.stripeTerminalAt) {
        return Object.keys(referencePatch).length > 0 ? { order: referencePatch } : null;
      }
      if (current.paymentStatus !== "succeeded") notify = "confirmed";
      return {
        order: {
          ...referencePatch,
          paymentStatus: "succeeded",
          ...(current.status === "pending" || current.status === "cancelled"
            ? { status: "processing" as const }
            : {}),
        },
        lead: { status: "converted", selectedOfferId: current.offerId },
      };
    }

    // Stripe timestamps have one-second precision. If success and failure-like
    // events share a timestamp, keep the confirmed payment: delivery order is
    // undefined and downgrading a paid order would be the unsafe outcome.
    const conflictsWithConfirmedPaymentAtSameTimestamp =
      current.paymentStatus === "succeeded" &&
      current.stripeLastInvoiceEventCreated != null &&
      event.created <= current.stripeLastInvoiceEventCreated;
    if (conflictsWithConfirmedPaymentAtSameTimestamp) {
      return Object.keys(referencePatch).length > 0 ? { order: referencePatch } : null;
    }

    if (actionRequired) {
      // Customer authentication is still possible; this is not a terminal
      // payment failure and must not cancel provisioning or send a failure email.
      return { order: { ...referencePatch, paymentStatus: "pending" } };
    }

    if (current.paymentStatus !== "failed") notify = "failed";
    // A recurring failure makes the order non-billable immediately. Preserve an
    // already provisioned/active status until a terminal subscription event tells
    // us to cancel service; pending/processing orders are safe to cancel now.
    const cancelBeforeProvisioning = current.status === "pending" || current.status === "processing";
    return {
      order: {
        ...referencePatch,
        paymentStatus: "failed",
        ...(cancelBeforeProvisioning ? { status: "cancelled" as const } : {}),
      },
    };
  });
  if (notify && result.changed) await notifyCustomer(notify, result.order);
  return true;
}

async function applySubscriptionEvent(event: Stripe.Event, subscription: Stripe.Subscription): Promise<boolean> {
  const subscriptionId = subscription.id;
  const order = await resolveSubscriptionOrder(subscriptionId, metadataOrderId(subscription));
  if (!order) {
    await completeStripeEvent(event.id, null, event.created, "subscription");
    return false;
  }
  const status = subscription.status;
  const deleted = event.type === "customer.subscription.deleted";
  const terminal = deleted || ["canceled", "unpaid", "incomplete_expired"].includes(status);
  await completeStripeEvent(event.id, order.id, event.created, "subscription", current => {
    if (current.stripeSubscriptionId && current.stripeSubscriptionId !== subscriptionId) {
      throw new Error("Stripe subscription does not match the persisted order binding.");
    }
    const referencePatch = stripeReferencePatch({
      customerId: objectId(subscription.customer),
      subscriptionId,
      subscriptionStatus: status,
    });
    if (terminal) {
      return {
        order: {
          ...referencePatch,
          paymentStatus: status === "unpaid" ? "failed" : "cancelled",
          status: "cancelled",
          stripeTerminalAt: new Date(event.created * 1000),
        },
      };
    }
    if (status === "past_due" || status === "incomplete") {
      return { order: { ...referencePatch, paymentStatus: status === "past_due" ? "failed" : "pending" } };
    }
    if (status === "paused") {
      // Stripe subscriptions can resume from paused. Mark the order non-billable
      // for now, but do not set the irreversible terminal guard.
      return { order: { ...referencePatch, paymentStatus: "pending" } };
    }
    return { order: referencePatch };
  });
  return true;
}

const SUPPORTED_EVENT_TYPES = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "invoice.paid",
  "invoice.payment_failed",
  "invoice.payment_action_required",
  "customer.subscription.updated",
  "customer.subscription.deleted",
]);

/** Apply a verified Stripe event through the durable event-id journal. */
export async function applyStripeEvent(event: Stripe.Event): Promise<boolean> {
  if (!SUPPORTED_EVENT_TYPES.has(event.type)) return false;
  if (!event.id) throw new Error("Stripe event id is required for deduplication.");
  if (!Number.isInteger(event.created) || event.created < 0) {
    throw new Error("Stripe event created timestamp is required for monotonic processing.");
  }

  const claim = await claimStripeEvent(event.id, event.type);
  if (claim === "processed") return true;
  if (claim === "in_progress") {
    throw new Error(`Stripe event ${event.id} is already being processed.`);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
      case "checkout.session.async_payment_failed":
        return await applyCheckoutEvent(event, event.data.object as Stripe.Checkout.Session);
      case "invoice.paid":
      case "invoice.payment_failed":
      case "invoice.payment_action_required":
        return await applyInvoiceEvent(event, event.data.object as Stripe.Invoice);
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        return await applySubscriptionEvent(event, event.data.object as Stripe.Subscription);
      default:
        return false;
    }
  } catch (error) {
    try {
      await failStripeEvent(event.id, error);
    } catch (journalError) {
      console.error("[Stripe] Failed to mark event as failed:", String(journalError));
    }
    throw error;
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
