import type { Offer, Provider } from "../drizzle/schema";

export const SELLABLE_AVAILABILITY_STATUSES = ["available", "limited"] as const;

type OperationalOfferSnapshot = Partial<
  Pick<
    Offer,
    | "isActive"
    | "availabilityStatus"
    | "availableCapacity"
    | "availabilityExpiresAt"
  >
> & {
  provider?: Pick<Provider, "isActive"> | null;
};

/**
 * Pure counterpart of the SQL catalogue filter. Supplier attribution fails
 * closed: migration 0006 backfills legacy rows before public reads are enabled.
 */
export function isOfferSellable(
  offer: OperationalOfferSnapshot,
  now: Date = new Date(),
): boolean {
  if (offer.isActive !== true || offer.provider?.isActive !== true) return false;
  if (!SELLABLE_AVAILABILITY_STATUSES.includes(
    offer.availabilityStatus as (typeof SELLABLE_AVAILABILITY_STATUSES)[number],
  )) {
    return false;
  }
  if (typeof offer.availableCapacity !== "number" || offer.availableCapacity <= 0) return false;
  return !isAvailabilityStale(offer, now);
}

export function isAvailabilityStale(
  offer: Pick<OperationalOfferSnapshot, "availabilityExpiresAt">,
  now: Date = new Date(),
): boolean {
  // Missing freshness evidence is unsafe: inventory must be reconfirmed with an
  // explicit future expiry before it can be sold.
  if (offer.availabilityExpiresAt == null) return true;
  const expiresAt = new Date(offer.availabilityExpiresAt);
  return !Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() <= now.getTime();
}
