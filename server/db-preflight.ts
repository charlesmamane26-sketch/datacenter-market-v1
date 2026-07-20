import "dotenv/config";
import {
  DatabasePreflightError,
  getSafeDatabaseDriverErrorCode,
  runDatabasePreflight,
} from "./dbPreflight";

try {
  const migrations = await runDatabasePreflight();
  const latestMigration = migrations[migrations.length - 1]!;
  console.log(
    `[DB preflight] Ready: connectivity and ${migrations.length} migrations verified through ${latestMigration.tag} (read-only).`
  );
} catch (error) {
  if (error instanceof DatabasePreflightError) {
    console.error(`[DB preflight] Failed (${error.code}): ${error.message}`);
  } else {
    // Never print a raw driver error: it may contain connection metadata. An
    // allow-listed code still distinguishes auth, DNS, timeout and TLS failures.
    const driverCode = getSafeDatabaseDriverErrorCode(error);
    console.error(
      `[DB preflight] Failed${driverCode ? ` (${driverCode})` : ""}: unable to verify the target database. Check connectivity and credentials.`
    );
  }
  process.exitCode = 1;
}
