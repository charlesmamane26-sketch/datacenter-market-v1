import { describe, expect, it } from "vitest";
import type Stripe from "stripe";
import { createInlineResourceRegistry, rememberInlineResources } from "./stripeSmokeCleanup";

function lineItem(
  priceId: string,
  priceActive: boolean,
  productId: string,
  productActive: boolean,
): Stripe.LineItem {
  return {
    price: {
      id: priceId,
      active: priceActive,
      product: { id: productId, active: productActive },
    },
  } as Stripe.LineItem;
}

describe("Stripe smoke cleanup resource discovery", () => {
  it("archives only resources explicitly returned as active", () => {
    const registry = createInlineResourceRegistry();

    rememberInlineResources(registry, [
      lineItem("price_active", true, "prod_active", true),
      lineItem("price_adhoc", false, "prod_adhoc", false),
    ]);

    expect([...registry.discoveredPriceIds]).toEqual(["price_active", "price_adhoc"]);
    expect([...registry.discoveredProductIds]).toEqual(["prod_active", "prod_adhoc"]);
    expect([...registry.activePriceIds]).toEqual(["price_active"]);
    expect([...registry.activeProductIds]).toEqual(["prod_active"]);
  });

  it("does not treat unexpanded references as active", () => {
    const registry = createInlineResourceRegistry();

    rememberInlineResources(registry, [
      { price: "price_unexpanded" } as unknown as Stripe.LineItem,
    ]);
    rememberInlineResources(registry, [
      {
        price: {
          id: "price_expanded",
          active: true,
          product: "prod_unexpanded",
        },
      } as Stripe.LineItem,
    ]);

    expect([...registry.discoveredPriceIds]).toEqual(["price_unexpanded", "price_expanded"]);
    expect([...registry.discoveredProductIds]).toEqual(["prod_unexpanded"]);
    expect([...registry.activePriceIds]).toEqual(["price_expanded"]);
    expect(registry.activeProductIds.size).toBe(0);
  });
});
