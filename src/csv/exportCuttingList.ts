// src/csv/exportCuttingList.ts
import { HEADERS_IN_ORDER } from "./aliases";

/**
 * rows: array of plain objects where keys are EXACT header strings
 * (e.g., "Name", "Material", "Length", "Width", "Quantity", ...).
 * Any missing key will be exported as an empty cell.
 *
 * Delimiter: semicolon (;)
 */
export function buildCuttingListCsv(
  rows: Array<Record<string, string | number | boolean | null | undefined>>
): string {
  const escapeCell = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    // Quote if contains semicolon, quote, or newline
    if (/[;"\r\n]/.test(s)) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const headerLine = HEADERS_IN_ORDER.join(";");
  const lines = rows.map((row) =>
    HEADERS_IN_ORDER.map(h => escapeCell(row[h])).join(";")
  );

  return [headerLine, ...lines].join("\r\n");
}

/** Optional helper to trigger a download in the browser */
export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
