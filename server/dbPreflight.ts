import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { createConnection, type RowDataPacket } from "mysql2/promise";

const DEFAULT_TIMEOUT_MS = 10_000;
const MIGRATIONS_TABLE = "__drizzle_migrations";

type PreflightErrorCode =
  | "database_url_missing"
  | "database_not_selected"
  | "migration_manifest_invalid"
  | "migration_history_missing"
  | "migration_history_invalid"
  | "migration_pending"
  | "migration_hash_mismatch"
  | "schema_drift"
  | "timeout_invalid";

interface MigrationJournalEntry {
  idx?: unknown;
  tag?: unknown;
  when?: unknown;
}

interface MigrationJournal {
  dialect?: unknown;
  entries?: unknown;
}

interface DatabaseRow extends RowDataPacket {
  databaseName: string | null;
}

interface PresenceRow extends RowDataPacket {
  present: number;
}

interface AppliedMigrationRow extends RowDataPacket {
  hash: string;
  createdAt: number | string | bigint;
}

interface SchemaColumnRow extends RowDataPacket {
  tableName: string;
  columnName: string;
}

const CRITICAL_SCHEMA_COLUMNS = [
  "leads.consentedAt",
  "leads.consentPolicyVersion",
  "orders.checkoutIdempotencyKey",
  "orders.providerId",
  "orders.stripeCheckoutSessionId",
  "orders.termsAcceptedAt",
  "offers.availabilityExpiresAt",
  "offers.availabilityStatus",
  "offers.availableCapacity",
  "offers.inventoryVersion",
  "offers.isActive",
  "offers.providerId",
  "providers.id",
  "stripeEvents.eventId",
  "stripeEvents.status",
] as const;

export interface ExpectedMigration {
  tag: string;
  createdAt: number;
  hash: string;
  /**
   * Hashes of the same migration with only its line endings converted between
   * LF and CRLF. This supports databases migrated from another operating
   * system without accepting any other byte-level change to the SQL.
   */
  lineEndingCompatibleHashes?: readonly string[];
}

export interface AppliedMigration {
  createdAt: number | string | bigint;
  hash: string;
}

export class DatabasePreflightError extends Error {
  constructor(
    public readonly code: PreflightErrorCode,
    message: string
  ) {
    super(message);
    this.name = "DatabasePreflightError";
  }
}

const SAFE_DRIVER_ERROR_CODES = new Set([
  "ER_ACCESS_DENIED_ERROR",
  "ER_BAD_DB_ERROR",
  "ETIMEDOUT",
  "ECONNREFUSED",
  "ECONNRESET",
  "ENOTFOUND",
  "EAI_AGAIN",
  "HANDSHAKE_SSL_ERROR",
  "PROTOCOL_CONNECTION_LOST",
  "CERT_HAS_EXPIRED",
  "SELF_SIGNED_CERT_IN_CHAIN",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
]);

/** Returns only an allow-listed driver code; never a URL or raw driver message. */
export function getSafeDatabaseDriverErrorCode(error: unknown): string | null {
  let current = error;
  for (let depth = 0; depth < 4 && current && typeof current === "object"; depth += 1) {
    const candidate = current as { code?: unknown; cause?: unknown };
    if (typeof candidate.code === "string" && SAFE_DRIVER_ERROR_CODES.has(candidate.code)) {
      return candidate.code;
    }
    if (!candidate.cause || candidate.cause === current) break;
    current = candidate.cause;
  }
  return null;
}

function parseTimeout(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === "") return DEFAULT_TIMEOUT_MS;
  const timeout = Number(raw);
  if (!Number.isSafeInteger(timeout) || timeout < 1_000 || timeout > 60_000) {
    throw new DatabasePreflightError(
      "timeout_invalid",
      "DB_PREFLIGHT_TIMEOUT_MS must be an integer between 1000 and 60000."
    );
  }
  return timeout;
}

function manifestError(message: string): DatabasePreflightError {
  return new DatabasePreflightError("migration_manifest_invalid", message);
}

function hashBytes(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * Produces the only two cross-platform representations Git can create for a
 * text migration: every line ending as LF or every line ending as CRLF.
 * Lone CR bytes are preserved, so this does not silently canonicalize other
 * content changes.
 */
function getLineEndingCompatibleHashes(migrationSql: Buffer): string[] {
  const lfBytes: number[] = [];
  for (let index = 0; index < migrationSql.length; index += 1) {
    const byte = migrationSql[index]!;
    if (
      byte === 0x0d &&
      index + 1 < migrationSql.length &&
      migrationSql[index + 1] === 0x0a
    ) {
      continue;
    }
    lfBytes.push(byte);
  }

  const crlfBytes: number[] = [];
  for (const byte of lfBytes) {
    if (byte === 0x0a) crlfBytes.push(0x0d);
    crlfBytes.push(byte);
  }

  return [...new Set([
    hashBytes(Uint8Array.from(lfBytes)),
    hashBytes(Uint8Array.from(crlfBytes)),
  ])];
}

function parseJournal(rawJournal: string): Array<{ tag: string; when: number }> {
  let journal: MigrationJournal;
  try {
    journal = JSON.parse(rawJournal) as MigrationJournal;
  } catch {
    throw manifestError("The Drizzle migration journal is not valid JSON.");
  }

  if (journal.dialect !== "mysql" || !Array.isArray(journal.entries)) {
    throw manifestError(
      "The Drizzle migration journal must contain a MySQL entries array."
    );
  }
  if (journal.entries.length === 0) {
    throw manifestError("The Drizzle migration journal contains no entries.");
  }

  const tags = new Set<string>();
  const timestamps = new Set<number>();
  let previousTimestamp = 0;

  return journal.entries.map((rawEntry, position) => {
    if (!rawEntry || typeof rawEntry !== "object") {
      throw manifestError(`Migration journal entry ${position} is invalid.`);
    }

    const entry = rawEntry as MigrationJournalEntry;
    if (
      typeof entry.tag !== "string" ||
      !/^\d{4}_[a-z0-9_]+$/i.test(entry.tag) ||
      !Number.isSafeInteger(entry.when) ||
      (entry.when as number) <= 0 ||
      entry.idx !== position
    ) {
      throw manifestError(`Migration journal entry ${position} is invalid.`);
    }

    const timestamp = entry.when as number;
    if (
      tags.has(entry.tag) ||
      timestamps.has(timestamp) ||
      timestamp <= previousTimestamp
    ) {
      throw manifestError(
        "Migration journal tags and timestamps must be unique and ordered."
      );
    }

    tags.add(entry.tag);
    timestamps.add(timestamp);
    previousTimestamp = timestamp;
    return { tag: entry.tag, when: timestamp };
  });
}

/**
 * Loads every committed Drizzle migration and computes the same SHA-256 hash
 * Drizzle records in __drizzle_migrations. The journal and SQL directory must
 * describe the exact same set of migrations. This never generates or applies SQL.
 */
export async function loadExpectedMigrations(
  migrationsDirectory = path.resolve(process.cwd(), "drizzle")
): Promise<ExpectedMigration[]> {
  try {
    const journalPath = path.join(
      migrationsDirectory,
      "meta",
      "_journal.json"
    );
    const entries = parseJournal(await readFile(journalPath, "utf8"));
    const directoryEntries = await readdir(migrationsDirectory, {
      withFileTypes: true,
    });
    const actualSqlFiles = directoryEntries
      .filter(entry => entry.isFile() && entry.name.endsWith(".sql"))
      .map(entry => entry.name)
      .sort();
    const expectedSqlFiles = entries
      .map(entry => `${entry.tag}.sql`)
      .sort();

    if (
      actualSqlFiles.length !== expectedSqlFiles.length ||
      actualSqlFiles.some((file, index) => file !== expectedSqlFiles[index])
    ) {
      throw manifestError(
        "The Drizzle journal and SQL migration files do not match exactly."
      );
    }

    return await Promise.all(
      entries.map(async entry => {
        const migrationSql = await readFile(
          path.join(migrationsDirectory, `${entry.tag}.sql`)
        );
        return {
          tag: entry.tag,
          createdAt: entry.when,
          hash: hashBytes(migrationSql),
          lineEndingCompatibleHashes:
            getLineEndingCompatibleHashes(migrationSql),
        };
      })
    );
  } catch (error) {
    if (error instanceof DatabasePreflightError) throw error;
    throw manifestError(
      "Unable to load every migration referenced by the Drizzle journal."
    );
  }
}

/** Kept for callers that only need the repository's latest migration. */
export async function loadExpectedMigration(
  migrationsDirectory?: string
): Promise<ExpectedMigration> {
  const migrations = await loadExpectedMigrations(migrationsDirectory);
  return migrations[migrations.length - 1]!;
}

function normalizeCreatedAt(value: AppliedMigration["createdAt"]): number {
  if (typeof value === "number") {
    if (Number.isSafeInteger(value) && value > 0) return value;
  } else if (typeof value === "bigint") {
    if (value > 0n && value <= BigInt(Number.MAX_SAFE_INTEGER)) {
      return Number(value);
    }
  } else if (/^[1-9]\d*$/.test(value)) {
    const parsed = Number(value);
    if (Number.isSafeInteger(parsed)) return parsed;
  }

  throw new DatabasePreflightError(
    "migration_history_invalid",
    "The target database contains an invalid migration timestamp."
  );
}

export function assertMigrationRegistrations(
  expectedMigrations: readonly ExpectedMigration[],
  appliedMigrations: readonly AppliedMigration[]
): void {
  const appliedByTimestamp = new Map<number, string>();
  for (const applied of appliedMigrations) {
    const createdAt = normalizeCreatedAt(applied.createdAt);
    if (appliedByTimestamp.has(createdAt) || typeof applied.hash !== "string") {
      throw new DatabasePreflightError(
        "migration_history_invalid",
        "The target database contains ambiguous migration history."
      );
    }
    appliedByTimestamp.set(createdAt, applied.hash);
  }

  for (const expected of expectedMigrations) {
    const appliedHash = appliedByTimestamp.get(expected.createdAt);
    if (appliedHash === undefined) {
      throw new DatabasePreflightError(
        "migration_pending",
        `Required migration ${expected.tag} is not registered in the target database.`
      );
    }
    const acceptedHashes = new Set([
      expected.hash,
      ...(expected.lineEndingCompatibleHashes ?? []),
    ]);
    if (!acceptedHashes.has(appliedHash)) {
      throw new DatabasePreflightError(
        "migration_hash_mismatch",
        `Migration ${expected.tag} is registered with a different hash.`
      );
    }
  }
}

export function assertCriticalSchemaColumns(
  rows: ReadonlyArray<{ tableName: string; columnName: string }>,
): void {
  const actual = new Set(rows.map(row => `${row.tableName}.${row.columnName}`));
  const missing = CRITICAL_SCHEMA_COLUMNS.filter(column => !actual.has(column));
  if (missing.length > 0) {
    throw new DatabasePreflightError(
      "schema_drift",
      `Critical schema columns are missing: ${missing.join(", ")}.`,
    );
  }
}

/** Kept for focused checks and backwards compatibility with existing tests. */
export function assertMigrationRegistration(
  expected: ExpectedMigration,
  appliedHash: string | null
): void {
  assertMigrationRegistrations(
    [expected],
    appliedHash === null
      ? []
      : [{ createdAt: expected.createdAt, hash: appliedHash }]
  );
}

/**
 * Verifies connectivity and every repository migration using SELECT statements
 * only. It never creates the migrations table and never mutates application data.
 */
export async function runDatabasePreflight(options?: {
  databaseUrl?: string;
  migrationsDirectory?: string;
  timeoutMs?: number;
}): Promise<ExpectedMigration[]> {
  const databaseUrl = options?.databaseUrl ?? process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new DatabasePreflightError(
      "database_url_missing",
      "DATABASE_URL is required for the database preflight."
    );
  }

  const timeoutMs =
    options?.timeoutMs ?? parseTimeout(process.env.DB_PREFLIGHT_TIMEOUT_MS);
  const expected = await loadExpectedMigrations(options?.migrationsDirectory);
  const connection = await createConnection({
    uri: databaseUrl,
    connectTimeout: timeoutMs,
  });

  try {
    const [databaseRows] = await connection.query<DatabaseRow[]>({
      sql: "SELECT DATABASE() AS databaseName",
      timeout: timeoutMs,
    });
    if (!databaseRows[0]?.databaseName) {
      throw new DatabasePreflightError(
        "database_not_selected",
        "DATABASE_URL must select an application database."
      );
    }

    const [presenceRows] = await connection.query<PresenceRow[]>({
      sql: `SELECT 1 AS present
              FROM information_schema.tables
             WHERE table_schema = DATABASE()
               AND table_name = '${MIGRATIONS_TABLE}'
             LIMIT 1`,
      timeout: timeoutMs,
    });
    if (!presenceRows[0]) {
      throw new DatabasePreflightError(
        "migration_history_missing",
        "The target database has no Drizzle migration history."
      );
    }

    const [migrationRows] = await connection.query<AppliedMigrationRow[]>({
      sql: `SELECT hash, created_at AS createdAt
              FROM \`${MIGRATIONS_TABLE}\``,
      timeout: timeoutMs,
    });
    assertMigrationRegistrations(expected, migrationRows);

    const [schemaRows] = await connection.query<SchemaColumnRow[]>({
      sql: `SELECT table_name AS tableName, column_name AS columnName
              FROM information_schema.columns
             WHERE table_schema = DATABASE()
               AND table_name IN ('leads', 'offers', 'orders', 'providers', 'stripeEvents')`,
      timeout: timeoutMs,
    });
    assertCriticalSchemaColumns(schemaRows);
    return expected;
  } finally {
    await connection.end().catch(() => undefined);
  }
}
