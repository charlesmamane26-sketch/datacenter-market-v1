import type Stripe from "stripe";

export type InlineResourceRegistry = {
  discoveredPriceIds: Set<string>;
  discoveredProductIds: Set<string>;
  activePriceIds: Set<string>;
  activeProductIds: Set<string>;
};

export function createInlineResourceRegistry(): InlineResourceRegistry {
  return {
    discoveredPriceIds: new Set(),
    discoveredProductIds: new Set(),
    activePriceIds: new Set(),
    activeProductIds: new Set(),
  };
}

export function rememberInlineResources(
  registry: InlineResourceRegistry,
  items: Stripe.LineItem[],
): void {
  for (const item of items) {
    const price = item.price;
    if (!price) continue;

    if (typeof price === "string") {
      registry.discoveredPriceIds.add(price);
      continue;
    }

    registry.discoveredPriceIds.add(price.id);
    if (price.active) registry.activePriceIds.add(price.id);
    else registry.activePriceIds.delete(price.id);

    const product = price.product;
    if (typeof product === "string") {
      registry.discoveredProductIds.add(product);
    } else if (product && !product.deleted) {
      registry.discoveredProductIds.add(product.id);
      if (product.active) registry.activeProductIds.add(product.id);
      else registry.activeProductIds.delete(product.id);
    }
  }
}
