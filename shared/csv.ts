/**
 * Minimal, dependency-free CSV serialization (RFC 4180-ish). Shared so the admin
 * export can build CSV in the browser from data already loaded over tRPC.
 *
 * A field is quoted when it contains a comma, double quote, or newline; inner
 * double quotes are doubled. null/undefined become empty cells.
 */
export function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = typeof value === "string" ? value : String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export interface CsvColumn<T> {
  header: string;
  /** Extract the cell value for a row. */
  value: (row: T) => unknown;
}

/** Serialize rows to a CSV string with a header line (CRLF line endings). */
export function toCsv<T>(rows: readonly T[], columns: readonly CsvColumn<T>[]): string {
  const head = columns.map(c => escapeCsvField(c.header)).join(",");
  const body = rows.map(row => columns.map(c => escapeCsvField(c.value(row))).join(","));
  return [head, ...body].join("\r\n");
}
