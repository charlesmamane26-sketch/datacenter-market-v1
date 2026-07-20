import "dotenv/config";
import { pathToFileURL } from "node:url";
import { cancelStalePendingOrders } from "./db";

/**
 * Cancels abandoned checkouts: orders left pending/unpaid past the window.
 * Schedule it (e.g. hourly) in production. Override the window with STALE_ORDER_HOURS.
 *
 * Run with: pnpm db:cancel-stale   (requires DATABASE_URL)
 */
const DEFAULT_STALE_ORDER_HOURS = 24;
const MAX_STALE_ORDER_HOURS = 720; // hard safety bound: 30 days

export function parseStaleOrderHours(raw: string | undefined): number {
  const normalized = (raw ?? String(DEFAULT_STALE_ORDER_HOURS)).trim();
  if (!/^[1-9]\d*$/.test(normalized)) {
    throw new Error("STALE_ORDER_HOURS must be a positive integer.");
  }
  const value = Number(normalized);
  if (!Number.isSafeInteger(value) || value > MAX_STALE_ORDER_HOURS) {
    throw new Error(
      `STALE_ORDER_HOURS must be between 1 and ${MAX_STALE_ORDER_HOURS}.`
    );
  }
  return value;
}

async function main(): Promise<void> {
  const staleOrderHours = parseStaleOrderHours(process.env.STALE_ORDER_HOURS);
  await cancelStalePendingOrders(staleOrderHours);
  console.log(
    `[Orders] Cancelled pending/unpaid orders older than ${staleOrderHours}h.`
  );
}

const entryPoint = process.argv[1];
if (entryPoint && import.meta.url === pathToFileURL(entryPoint).href) {
  void main()
    .then(() => {
      process.exit(0);
    })
    .catch(error => {
      console.error("[Orders] Failed:", error);
      process.exit(1);
    });
}
