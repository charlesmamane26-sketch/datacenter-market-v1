/**
 * Opt-in Stripe test-mode smoke check.
 *
 * This makes real Stripe test-API calls. It proves the exact subscription +
 * one-time setup-fee contract, expires the Checkout Session, then archives the
 * inline Prices and Products created by Stripe. It never accepts a live key and
 * never attempts a payment.
 *
 * Run only against the intended Stripe test account:
 *   STRIPE_SMOKE_TEST_ENABLED=true pnpm stripe:smoke
 */
import "dotenv/config";
import Stripe from "stripe";
import { buildCheckoutSessionParams, getStripeSecretKeyMode } from "./stripe";
import { createInlineResourceRegistry, rememberInlineResources } from "./stripeSmokeCleanup";

const enabled = process.env.STRIPE_SMOKE_TEST_ENABLED === "true";
const secretKey = process.env.STRIPE_SECRET_KEY?.trim() ?? "";
const publicBaseUrl = process.env.PUBLIC_BASE_URL?.trim().replace(/\/+$/, "") ?? "";

if (!enabled) {
  console.error(
    "Stripe smoke check is opt-in. Set STRIPE_SMOKE_TEST_ENABLED=true for this command only.",
  );
  process.exit(2);
}

if (getStripeSecretKeyMode(secretKey) !== "test") {
  console.error(
    "Stripe smoke check requires a test-mode secret or restricted key (sk_test_…/rk_test_…). Live and unknown keys are refused.",
  );
  process.exit(2);
}

function isHttpsOrigin(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
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

if (!isHttpsOrigin(publicBaseUrl)) {
  console.error(
    "PUBLIC_BASE_URL must be an absolute https:// origin without a path, query, or fragment for the Stripe smoke check.",
  );
  process.exit(2);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function sameMetadata(
  actual: Record<string, string | number | null> | null | undefined,
  expected: Record<string, string>,
): boolean {
  if (!actual) return false;
  const actualEntries = Object.entries(actual).sort(([a], [b]) => a.localeCompare(b));
  const expectedEntries = Object.entries(expected).sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify(actualEntries) === JSON.stringify(expectedEntries);
}

function expandedPrice(item: Stripe.LineItem): Stripe.Price {
  assert(item.price && typeof item.price !== "string", "A line item Price was not expanded.");
  return item.price;
}

function expandedProduct(price: Stripe.Price): Stripe.Product {
  assert(
    price.product && typeof price.product !== "string" && !price.product.deleted,
    `Product for Price ${price.id} was not expanded or was deleted.`,
  );
  return price.product;
}

const stripe = new Stripe(secretKey);
const runId = `${Date.now()}-${process.pid}`;
const smokeOrderId = 2_000_000_001;
const smokeLeadId = 2_000_000_002;
const smokeOfferId = 2_000_000_003;
const offerName = "DatacenterMarket Stripe smoke test";
const successUrl = `${publicBaseUrl}/confirmation?orderId=${smokeOrderId}`;
const cancelUrl = `${publicBaseUrl}/checkout?offerId=${smokeOfferId}&leadId=${smokeLeadId}`;
const smokeMetadata = {
  orderId: String(smokeOrderId),
  smokeTest: "true",
  smokeRunId: runId,
};

let sessionId: string | null = null;
let observedLineItems: Stripe.LineItem[] = [];
const inlineResources = createInlineResourceRegistry();

try {
  const params = buildCheckoutSessionParams({
    orderId: smokeOrderId,
    leadId: smokeLeadId,
    offerId: smokeOfferId,
    offerName,
    monthlyPrice: "10.00",
    setupFee: "1.00",
    origin: publicBaseUrl,
  });

  // Validate the exact application-side contract before making the network call.
  assert(params.mode === "subscription", "Expected subscription Checkout mode.");
  assert(params.success_url === successUrl, "Unexpected success URL in Checkout parameters.");
  assert(params.cancel_url === cancelUrl, "Unexpected cancel URL in Checkout parameters.");
  assert(params.client_reference_id === String(smokeOrderId), "Unexpected client reference id.");
  assert(
    sameMetadata(params.metadata ?? null, { orderId: String(smokeOrderId) }),
    "Unexpected base Checkout metadata.",
  );
  assert(
    sameMetadata(params.subscription_data?.metadata ?? null, { orderId: String(smokeOrderId) }),
    "Unexpected base subscription metadata.",
  );

  const session = await stripe.checkout.sessions.create(
    {
      ...params,
      metadata: smokeMetadata,
      subscription_data: {
        ...params.subscription_data,
        metadata: smokeMetadata,
      },
    },
    { idempotencyKey: `datacentermarket-smoke-${runId}` },
  );
  sessionId = session.id;

  const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
    limit: 10,
    expand: ["data.price.product"],
  });
  observedLineItems = lineItems.data;
  rememberInlineResources(inlineResources, observedLineItems);

  assert(session.mode === "subscription", "Stripe returned a non-subscription Checkout Session.");
  assert(session.status === "open", `Expected an open Session, got ${session.status}.`);
  assert(Boolean(session.url), "Stripe did not return a hosted Checkout URL.");
  assert(session.currency === "eur", `Expected Session currency eur, got ${session.currency}.`);
  assert(session.amount_subtotal === 1_100, `Expected subtotal 1100, got ${session.amount_subtotal}.`);
  assert(session.amount_total === 1_100, `Expected total 1100, got ${session.amount_total}.`);
  assert(session.success_url === successUrl, "Stripe persisted an unexpected success URL.");
  assert(session.cancel_url === cancelUrl, "Stripe persisted an unexpected cancel URL.");
  assert(
    session.client_reference_id === String(smokeOrderId),
    "Stripe persisted an unexpected client reference id.",
  );
  assert(sameMetadata(session.metadata, smokeMetadata), "Stripe persisted unexpected metadata.");
  assert(lineItems.has_more === false, "Stripe returned more than the expected smoke line items.");
  assert(observedLineItems.length === 2, `Expected exactly 2 line items, got ${observedLineItems.length}.`);

  const recurringItems = observedLineItems.filter(item => expandedPrice(item).type === "recurring");
  const oneTimeItems = observedLineItems.filter(item => expandedPrice(item).type === "one_time");
  assert(recurringItems.length === 1, `Expected 1 recurring item, got ${recurringItems.length}.`);
  assert(oneTimeItems.length === 1, `Expected 1 one-time item, got ${oneTimeItems.length}.`);

  const recurringItem = recurringItems[0];
  const recurringPrice = expandedPrice(recurringItem);
  const recurringProduct = expandedProduct(recurringPrice);
  assert(recurringItem.quantity === 1, "Recurring item quantity must be 1.");
  assert(recurringItem.currency === "eur", "Recurring line item currency must be eur.");
  assert(recurringItem.amount_subtotal === 1_000, "Recurring line item subtotal must be 1000.");
  assert(recurringItem.amount_total === 1_000, "Recurring line item total must be 1000.");
  assert(recurringPrice.currency === "eur", "Recurring Price currency must be eur.");
  assert(recurringPrice.unit_amount === 1_000, "Recurring Price amount must be 1000.");
  assert(recurringPrice.recurring?.interval === "month", "Recurring Price interval must be month.");
  assert(recurringPrice.recurring?.interval_count === 1, "Recurring Price interval count must be 1.");
  assert(recurringProduct.name === `${offerName} — monthly`, "Unexpected recurring Product name.");

  const oneTimeItem = oneTimeItems[0];
  const oneTimePrice = expandedPrice(oneTimeItem);
  const oneTimeProduct = expandedProduct(oneTimePrice);
  assert(oneTimeItem.quantity === 1, "One-time item quantity must be 1.");
  assert(oneTimeItem.currency === "eur", "One-time line item currency must be eur.");
  assert(oneTimeItem.amount_subtotal === 100, "One-time line item subtotal must be 100.");
  assert(oneTimeItem.amount_total === 100, "One-time line item total must be 100.");
  assert(oneTimePrice.currency === "eur", "One-time Price currency must be eur.");
  assert(oneTimePrice.unit_amount === 100, "One-time Price amount must be 100.");
  assert(oneTimePrice.recurring === null, "One-time Price must not have a recurring interval.");
  assert(oneTimeProduct.name === `${offerName} — one-time setup fee`, "Unexpected setup Product name.");

  console.log(
    JSON.stringify({
      ok: true,
      mode: session.mode,
      status: session.status,
      currency: session.currency,
      recurringAmount: recurringPrice.unit_amount,
      recurringInterval: recurringPrice.recurring.interval,
      setupAmount: oneTimePrice.unit_amount,
      metadataVerified: true,
      urlsVerified: true,
      sessionId: session.id,
    }),
  );
} catch (error) {
  const stripeError = error as { type?: string; code?: string; message?: string };
  console.error(
    JSON.stringify({
      ok: false,
      type: stripeError.type ?? "Error",
      code: stripeError.code ?? null,
      message: stripeError.message ?? String(error),
    }),
  );
  process.exitCode = 1;
} finally {
  let cleanupFailed = false;

  if (sessionId && observedLineItems.length === 0) {
    try {
      const lineItems = await stripe.checkout.sessions.listLineItems(sessionId, {
        limit: 10,
        expand: ["data.price.product"],
      });
      rememberInlineResources(inlineResources, lineItems.data);
    } catch (error) {
      cleanupFailed = true;
      console.error(
        JSON.stringify({
          cleanup: "resource_discovery_failed",
          message: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }

  if (sessionId) {
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (session.status === "open") await stripe.checkout.sessions.expire(sessionId);
      console.log(JSON.stringify({ cleanup: "expired", sessionId }));
    } catch (error) {
      cleanupFailed = true;
      console.error(
        JSON.stringify({
          cleanup: "session_expire_failed",
          sessionId,
          message: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }

  let archivedPrices = 0;
  let archivedProducts = 0;

  for (const priceId of inlineResources.activePriceIds) {
    try {
      await stripe.prices.update(priceId, { active: false });
      archivedPrices += 1;
    } catch (error) {
      cleanupFailed = true;
      console.error(
        JSON.stringify({
          cleanup: "price_archive_failed",
          priceId,
          message: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }

  for (const productId of inlineResources.activeProductIds) {
    try {
      await stripe.products.update(productId, { active: false });
      archivedProducts += 1;
    } catch (error) {
      cleanupFailed = true;
      console.error(
        JSON.stringify({
          cleanup: "product_archive_failed",
          productId,
          message: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }

  if (
    inlineResources.discoveredPriceIds.size > 0 ||
    inlineResources.discoveredProductIds.size > 0
  ) {
    console.log(
      JSON.stringify({
        cleanup: cleanupFailed ? "partial" : "resources_clean",
        prices: inlineResources.discoveredPriceIds.size,
        products: inlineResources.discoveredProductIds.size,
        archivedPrices,
        archivedProducts,
        inactiveOrUnexpandedPricesSkipped:
          inlineResources.discoveredPriceIds.size - inlineResources.activePriceIds.size,
        inactiveOrUnexpandedProductsSkipped:
          inlineResources.discoveredProductIds.size - inlineResources.activeProductIds.size,
      }),
    );
  }
  if (cleanupFailed) process.exitCode = 1;
}
