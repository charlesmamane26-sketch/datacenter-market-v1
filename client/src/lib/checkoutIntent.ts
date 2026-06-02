// Carries the in-progress checkout across the OAuth login redirect.
// Manus OAuth returns the user to "/", so we stash the intent here before redirecting
// and let the landing page resume it once (see Home.tsx).

const KEY = "datacenter-market.checkout-intent";

export interface CheckoutIntent {
  offerId: number;
  leadId: number;
}

export function saveCheckoutIntent(intent: CheckoutIntent): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(intent));
  } catch {
    // Ignore storage errors (private mode, quota exceeded).
  }
}

export function loadCheckoutIntent(): CheckoutIntent | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CheckoutIntent>;
    if (typeof parsed.offerId === "number" && typeof parsed.leadId === "number") {
      return { offerId: parsed.offerId, leadId: parsed.leadId };
    }
    return null;
  } catch {
    return null;
  }
}

export function clearCheckoutIntent(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Ignore.
  }
}
