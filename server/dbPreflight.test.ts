import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertMigrationRegistration,
  assertMigrationRegistrations,
  assertCriticalSchemaColumns,
  DatabasePreflightError,
  getSafeDatabaseDriverErrorCode,
  loadExpectedMigrations,
  type ExpectedMigration,
} from "./dbPreflight";

const expected: ExpectedMigration = {
  tag: "0005_example",
  createdAt: 1_784_127_654_748,
  hash: "a".repeat(64),
};

async function withMigrationDirectory<T>(
  entries: Array<{ idx: number; tag: string; when: number }>,
  files: Record<string, string>,
  test: (directory: string) => Promise<T>
): Promise<T> {
  const directory = await mkdtemp(path.join(tmpdir(), "db-preflight-"));
  try {
    await mkdir(path.join(directory, "meta"));
    await writeFile(
      path.join(directory, "meta", "_journal.json"),
      JSON.stringify({ version: "7", dialect: "mysql", entries }),
      "utf8"
    );
    await Promise.all(
      Object.entries(files).map(([name, sql]) =>
        writeFile(path.join(directory, name), sql, "utf8")
      )
    );
    return await test(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

describe("database preflight", () => {
  it("reports only allow-listed driver codes without exposing driver messages", () => {
    expect(
      getSafeDatabaseDriverErrorCode({
        message: "mysql://user:secret@example.invalid/db",
        cause: { code: "ER_ACCESS_DENIED_ERROR" },
      }),
    ).toBe("ER_ACCESS_DENIED_ERROR");
    expect(getSafeDatabaseDriverErrorCode({ code: "SENSITIVE_VENDOR_CODE" })).toBeNull();
  });

  it("detects critical schema drift after migrations were registered", () => {
    const columns = [
      ["leads", "consentedAt"],
      ["leads", "consentPolicyVersion"],
      ["orders", "checkoutIdempotencyKey"],
      ["orders", "providerId"],
      ["orders", "stripeCheckoutSessionId"],
      ["orders", "termsAcceptedAt"],
      ["offers", "availabilityExpiresAt"],
      ["offers", "availabilityStatus"],
      ["offers", "availableCapacity"],
      ["offers", "inventoryVersion"],
      ["offers", "isActive"],
      ["offers", "providerId"],
      ["providers", "id"],
      ["stripeEvents", "eventId"],
      ["stripeEvents", "status"],
    ].map(([tableName, columnName]) => ({ tableName, columnName }));

    expect(() => assertCriticalSchemaColumns(columns)).not.toThrow();
    expect(() => assertCriticalSchemaColumns(columns.slice(1))).toThrowError(
      expect.objectContaining<Partial<DatabasePreflightError>>({ code: "schema_drift" }),
    );
  });

  it("loads and hashes every repository migration in journal order", async () => {
    const migrations = await loadExpectedMigrations();
    const sqlTags = (await readdir(path.resolve(process.cwd(), "drizzle")))
      .filter(file => file.endsWith(".sql"))
      .map(file => file.slice(0, -4))
      .sort();

    expect(migrations.map(migration => migration.tag).sort()).toEqual(sqlTags);
    expect(migrations.every(migration => migration.createdAt > 0)).toBe(true);
    expect(
      migrations.every(migration => /^[a-f0-9]{64}$/.test(migration.hash))
    ).toBe(true);
  });

  it("computes exact hashes for all journaled SQL files", async () => {
    const firstSql = "SELECT 1;\n";
    const secondSql = "SELECT 2;\r\n";
    await withMigrationDirectory(
      [
        { idx: 0, tag: "0000_first", when: 1_000 },
        { idx: 1, tag: "0001_second", when: 2_000 },
      ],
      {
        "0000_first.sql": firstSql,
        "0001_second.sql": secondSql,
      },
      async directory => {
        const migrations = await loadExpectedMigrations(directory);
        expect(migrations).toEqual([
          {
            tag: "0000_first",
            createdAt: 1_000,
            hash: createHash("sha256").update(firstSql).digest("hex"),
            lineEndingCompatibleHashes: [
              createHash("sha256").update(firstSql).digest("hex"),
              createHash("sha256").update("SELECT 1;\r\n").digest("hex"),
            ],
          },
          {
            tag: "0001_second",
            createdAt: 2_000,
            hash: createHash("sha256").update(secondSql).digest("hex"),
            lineEndingCompatibleHashes: [
              createHash("sha256").update("SELECT 2;\n").digest("hex"),
              createHash("sha256").update(secondSql).digest("hex"),
            ],
          },
        ]);
      }
    );
  });

  it("accepts a migration registered with the equivalent CRLF hash", async () => {
    const sql = "CREATE TABLE example (\n  id int NOT NULL\n);\n";
    await withMigrationDirectory(
      [{ idx: 0, tag: "0000_first", when: 1_000 }],
      { "0000_first.sql": sql },
      async directory => {
        const [migration] = await loadExpectedMigrations(directory);
        const crlfHash = createHash("sha256")
          .update(sql.replaceAll("\n", "\r\n"))
          .digest("hex");

        expect(() =>
          assertMigrationRegistrations(
            [migration!],
            [{ createdAt: 1_000, hash: crlfHash }]
          )
        ).not.toThrow();
      }
    );
  });

  it("still rejects semantic SQL changes with compatible line endings", async () => {
    const sql = "CREATE TABLE example (\n  id int NOT NULL\n);\n";
    await withMigrationDirectory(
      [{ idx: 0, tag: "0000_first", when: 1_000 }],
      { "0000_first.sql": sql },
      async directory => {
        const [migration] = await loadExpectedMigrations(directory);
        const changedSqlHash = createHash("sha256")
          .update(sql.replace("id int", "id bigint").replaceAll("\n", "\r\n"))
          .digest("hex");

        expect(() =>
          assertMigrationRegistrations(
            [migration!],
            [{ createdAt: 1_000, hash: changedSqlHash }]
          )
        ).toThrowError(
          expect.objectContaining<Partial<DatabasePreflightError>>({
            code: "migration_hash_mismatch",
          })
        );
      }
    );
  });

  it("rejects a journal with a missing SQL file", async () => {
    await expect(
      withMigrationDirectory(
        [
          { idx: 0, tag: "0000_first", when: 1_000 },
          { idx: 1, tag: "0001_missing", when: 2_000 },
        ],
        { "0000_first.sql": "SELECT 1;\n" },
        directory => loadExpectedMigrations(directory)
      )
    ).rejects.toMatchObject({ code: "migration_manifest_invalid" });
  });

  it("rejects an unjournaled SQL migration", async () => {
    await expect(
      withMigrationDirectory(
        [{ idx: 0, tag: "0000_first", when: 1_000 }],
        {
          "0000_first.sql": "SELECT 1;\n",
          "0001_orphan.sql": "SELECT 2;\n",
        },
        directory => loadExpectedMigrations(directory)
      )
    ).rejects.toMatchObject({ code: "migration_manifest_invalid" });
  });

  it("rejects duplicate or unordered journal timestamps", async () => {
    await expect(
      withMigrationDirectory(
        [
          { idx: 0, tag: "0000_first", when: 2_000 },
          { idx: 1, tag: "0001_second", when: 2_000 },
        ],
        {
          "0000_first.sql": "SELECT 1;\n",
          "0001_second.sql": "SELECT 2;\n",
        },
        directory => loadExpectedMigrations(directory)
      )
    ).rejects.toMatchObject({ code: "migration_manifest_invalid" });
  });

  it("accepts exact hashes for every migration and string DB timestamps", () => {
    const first = { ...expected, tag: "0004_first", createdAt: 1_000 };
    const second = { ...expected, tag: "0005_second", createdAt: 2_000 };

    expect(() =>
      assertMigrationRegistrations(
        [first, second],
        [
          { createdAt: "1000", hash: first.hash },
          { createdAt: 2_000, hash: second.hash },
        ]
      )
    ).not.toThrow();
  });

  it("rejects a missing earlier migration even when the latest is present", () => {
    const first = { ...expected, tag: "0004_first", createdAt: 1_000 };
    const second = { ...expected, tag: "0005_second", createdAt: 2_000 };

    expect(() =>
      assertMigrationRegistrations([first, second], [
        { createdAt: second.createdAt, hash: second.hash },
      ])
    ).toThrowError(
      expect.objectContaining<Partial<DatabasePreflightError>>({
        code: "migration_pending",
        message: expect.stringContaining(first.tag),
      })
    );
  });

  it("rejects hash drift in any migration, not only the latest", () => {
    const first = { ...expected, tag: "0004_first", createdAt: 1_000 };
    const second = { ...expected, tag: "0005_second", createdAt: 2_000 };

    expect(() =>
      assertMigrationRegistrations(
        [first, second],
        [
          { createdAt: first.createdAt, hash: "b".repeat(64) },
          { createdAt: second.createdAt, hash: second.hash },
        ]
      )
    ).toThrowError(
      expect.objectContaining<Partial<DatabasePreflightError>>({
        code: "migration_hash_mismatch",
        message: expect.stringContaining(first.tag),
      })
    );
  });

  it("rejects duplicate migration timestamps in database history", () => {
    expect(() =>
      assertMigrationRegistrations(
        [expected],
        [
          { createdAt: expected.createdAt, hash: expected.hash },
          { createdAt: expected.createdAt, hash: expected.hash },
        ]
      )
    ).toThrowError(
      expect.objectContaining<Partial<DatabasePreflightError>>({
        code: "migration_history_invalid",
      })
    );
  });

  it("retains the focused single-migration helper", () => {
    expect(() =>
      assertMigrationRegistration(expected, expected.hash)
    ).not.toThrow();
    expect(() => assertMigrationRegistration(expected, null)).toThrowError(
      expect.objectContaining<Partial<DatabasePreflightError>>({
        code: "migration_pending",
      })
    );
  });
});
