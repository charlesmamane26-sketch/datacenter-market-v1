import "dotenv/config";
import { pathToFileURL } from "node:url";
import { purgeLeadsOlderThan } from "./db";

/**
 * RGPD data-retention job. Deletes unconverted leads older than the retention window.
 * Schedule it (e.g. a daily cron) in production. Override the window with LEAD_RETENTION_DAYS.
 *
 * Run with: pnpm db:purge   (requires DATABASE_URL)
 */
const DEFAULT_RETENTION_DAYS = 730; // ~24 months
const MAX_RETENTION_DAYS = 3_650; // hard safety bound: 10 years

export function parseRetentionDays(raw: string | undefined): number {
  const normalized = (raw ?? String(DEFAULT_RETENTION_DAYS)).trim();
  if (!/^[1-9]\d*$/.test(normalized)) {
    throw new Error("LEAD_RETENTION_DAYS must be a positive integer.");
  }
  const value = Number(normalized);
  if (!Number.isSafeInteger(value) || value > MAX_RETENTION_DAYS) {
    throw new Error(
      `LEAD_RETENTION_DAYS must be between 1 and ${MAX_RETENTION_DAYS}.`
    );
  }
  return value;
}

async function main(): Promise<void> {
  const retentionDays = parseRetentionDays(process.env.LEAD_RETENTION_DAYS);
  await purgeLeadsOlderThan(retentionDays);
  console.log(
    `[Purge] Removed unconverted leads older than ${retentionDays} days.`
  );
}

const entryPoint = process.argv[1];
if (entryPoint && import.meta.url === pathToFileURL(entryPoint).href) {
  void main()
    .then(() => {
      process.exit(0);
    })
    .catch(error => {
      console.error("[Purge] Failed:", error);
      process.exit(1);
    });
}
