import { toCsv, type CsvColumn } from "@shared/csv";

/**
 * Builds a CSV from rows + columns and triggers a browser download. A BOM is
 * prepended so Excel opens UTF-8 correctly (accented names, € signs).
 */
export function downloadCsv<T>(
  filename: string,
  rows: readonly T[],
  columns: readonly CsvColumn<T>[],
): void {
  const csv = toCsv(rows, columns);
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
