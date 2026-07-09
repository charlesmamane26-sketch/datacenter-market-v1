/**
 * French market formatting (design handoff): narrow no-break space (U+202F)
 * as thousands separator and before units — "18 400 €", "99,9 %", "72 h".
 */

const NNBSP = " ";

/** 18400 -> "18 400 €" (integer euros, French grouping). */
export function fmtEUR(amount: number): string {
  const rounded = Math.round(amount);
  const sign = rounded < 0 ? "−" : "";
  const digits = Math.abs(rounded).toString();
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, NNBSP);
  return `${sign}${grouped}${NNBSP}€`;
}

/** 18400 -> "18 400 €/mois HT" (per the offer-card price block). */
export function fmtEURMonthly(amount: number): string {
  return `${fmtEUR(amount)}/mois`;
}

/** Order reference: 4471 -> "ORD-004471". */
export function orderRef(id: number): string {
  return `ORD-${String(id).padStart(6, "0")}`;
}

/** Lead reference: 2214 -> "LEAD #2214". */
export function leadRef(id: number): string {
  return `LEAD #${id}`;
}
