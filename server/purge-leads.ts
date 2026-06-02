import "dotenv/config";
import { purgeLeadsOlderThan } from "./db";

/**
 * RGPD data-retention job. Deletes unconverted leads older than the retention window.
 * Schedule it (e.g. a daily cron) in production. Override the window with LEAD_RETENTION_DAYS.
 *
 * Run with: pnpm db:purge   (requires DATABASE_URL)
 */
const RETENTION_DAYS = Number(process.env.LEAD_RETENTION_DAYS ?? 730); // ~24 months

purgeLeadsOlderThan(RETENTION_DAYS)
  .then(() => {
    console.log(`[Purge] Removed unconverted leads older than ${RETENTION_DAYS} days.`);
    process.exit(0);
  })
  .catch(error => {
    console.error("[Purge] Failed:", error);
    process.exit(1);
  });
