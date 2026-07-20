import type { Offer } from "../drizzle/schema";
import { isOfferSellable } from "./inventory";

/**
 * Offer-matching engine.
 *
 * The three result "views" (best value / fastest / cheapest) are NOT intrinsic
 * properties of an offer — they are computed per request by ranking the catalogue
 * against the lead's criteria. (The legacy `offers.category` column is no longer used
 * for matching and is a candidate for removal in a later schema cleanup.)
 */

export interface MatchCriteria {
  /** Form value: "h100" | "a100" | "rtx4090" | "l40s" | "any" | null. */
  gpuRequirement?: string | null;
  /** Monthly budget in EUR. */
  monthlyBudget?: number | null;
}

export interface MatchResult {
  bestValue: Offer;
  fastest: Offer;
  cheapest: Offer;
}

// Maps form GPU values to a substring expected in `offer.gpuType` (lowercased, despaced).
const GPU_KEYS: Record<string, string> = {
  h100: "h100",
  a100: "a100",
  rtx4090: "4090",
  l40s: "l40s",
};

function gpuMatches(gpuType: string, requirement?: string | null): boolean {
  if (!requirement || requirement === "any") return true;
  const key = GPU_KEYS[requirement] ?? requirement.toLowerCase();
  return gpuType.toLowerCase().replace(/\s+/g, "").includes(key);
}

/**
 * Parses a human deployment estimate into a comparable number of hours.
 * "48h" -> 48 ; "5-7 days" -> 120 (lower bound) ; unknown -> ranks last.
 */
export function deploymentHours(deploymentTime: string): number {
  const hours = deploymentTime.match(/(\d+)\s*h/i);
  if (hours) return Number(hours[1]);
  const days = deploymentTime.match(/(\d+)(?:\s*-\s*\d+)?\s*days?/i);
  if (days) return Number(days[1]) * 24;
  return Number.MAX_SAFE_INTEGER;
}

function price(offer: Offer): number {
  return Number(offer.monthlyPrice);
}

// Normalizes a value to 0..1 where the best (lowest) maps to 1. Returns 0.5 if all equal.
function inverseScore(value: number, min: number, max: number): number {
  if (max === min) return 0.5;
  return (max - value) / (max - min);
}

/**
 * Returns the best offer for each view, or null when the catalogue is empty or
 * no offer satisfies the requested hard constraints.
 * - cheapest: lowest monthly price
 * - fastest: soonest deployment
 * - best value: balanced composite of cheapness and speed
 */
export function matchOffers(
  catalogue: Offer[],
  criteria: MatchCriteria = {},
): MatchResult | null {
  if (catalogue.length === 0) return null;

  // GPU and budget are hard constraints. Returning an unrelated or over-budget
  // offer would make the recommendation misleading; callers can instead invite
  // the prospect to broaden the request or ask for a bespoke quote.
  // Defence in depth: DB catalogue reads already enforce this, but keeping the
  // pure engine inventory-aware prevents a future caller from ranking a raw
  // admin catalogue (or an offer whose freshness expired after it was loaded).
  let pool = catalogue.filter(
    offer => !("isActive" in offer) || isOfferSellable(offer),
  );
  pool = pool.filter(o => gpuMatches(o.gpuType, criteria.gpuRequirement));
  if (pool.length === 0) return null;

  if (criteria.monthlyBudget != null) {
    const budget = criteria.monthlyBudget;
    pool = pool.filter(o => price(o) <= budget);
    if (pool.length === 0) return null;
  }

  const cheapest = [...pool].sort((a, b) => price(a) - price(b))[0];
  const fastest = [...pool].sort(
    (a, b) => deploymentHours(a.deploymentTime) - deploymentHours(b.deploymentTime),
  )[0];

  // Composite best-value score: half cheapness, half speed, normalized across the pool.
  const prices = pool.map(price);
  const speeds = pool.map(o => deploymentHours(o.deploymentTime));
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const minSpeed = Math.min(...speeds);
  const maxSpeed = Math.max(...speeds);

  const bestValue = [...pool].sort((a, b) => {
    const scoreA =
      0.5 * inverseScore(price(a), minPrice, maxPrice) +
      0.5 * inverseScore(deploymentHours(a.deploymentTime), minSpeed, maxSpeed);
    const scoreB =
      0.5 * inverseScore(price(b), minPrice, maxPrice) +
      0.5 * inverseScore(deploymentHours(b.deploymentTime), minSpeed, maxSpeed);
    return scoreB - scoreA;
  })[0];

  return { bestValue, fastest, cheapest };
}
