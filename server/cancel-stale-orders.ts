import "dotenv/config";
import { cancelStalePendingOrders } from "./db";

/**
 * Cancels abandoned checkouts: orders left pending/unpaid past the window.
 * Schedule it (e.g. hourly) in production. Override the window with STALE_ORDER_HOURS.
 *
 * Run with: pnpm db:cancel-stale   (requires DATABASE_URL)
 */
const STALE_ORDER_HOURS = Number(process.env.STALE_ORDER_HOURS ?? 24);

cancelStalePendingOrders(STALE_ORDER_HOURS)
  .then(() => {
    console.log(`[Orders] Cancelled pending/unpaid orders older than ${STALE_ORDER_HOURS}h.`);
    process.exit(0);
  })
  .catch(error => {
    console.error("[Orders] Failed:", error);
    process.exit(1);
  });
