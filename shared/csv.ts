/**
 * Minimal, dependency-free CSV serialization (RFC 4180-ish). Shared so the admin
 * export can build CSV in the browser from data already loaded over tRPC.
 *
 * A field is quoted when it contains a comma, double quote, or newline; inner
 * double quotes are doubled. null/undefined become empty cells.
 *
 * Formula-injection defense: a cell whose text begins with `= + - @` or a
 * tab/CR is a formula trigger in Excel/Sheets/LibreOffice. Lead fields are
 * attacker-controlled (public leads.create) and land in the admin's export, so
 * such a cell is prefixed with an apostrophe (and force-quoted) to neutralize it
 * while displaying the original text.
 */
const FORMULA_TRIGGER = /^[=+\-@\t\r]/;

export function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = typeof value === "string" ? value : String(value);
  if (FORMULA_TRIGGER.test(s)) {
    return `"'${s.replace(/"/g, '""')}"`;
  }
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
