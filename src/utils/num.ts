// src/utils/num.ts

/**
 * Robust numeric parser for CSV cells.
 * - Handles thousands: "1,850" or "1 850" -> 1850
 * - Handles decimal comma: "18,5" -> 18.5
 * - Ignores units and stray text: "1830 mm" -> 1830
 * - Returns 0 for empty/invalid.
 */
export function parseNumberLike(input: unknown): number {
  if (input == null) return 0;
  let s = String(input).trim();

  // Normalize NBSP to space
  s = s.replace(/\u00A0/g, " ");

  // Remove spaces used as thousand separators: "1 850" -> "1850"
  // (only spaces *between digits*)
  s = s.replace(/(\d)\s+(?=\d)/g, "$1");

  if (s.includes(",")) {
    // If it's clearly 1,234 or 12,345,678 pattern -> commas are thousands
    if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) {
      s = s.replace(/,/g, "");
    }
    // If it's like 12,5 (decimal comma) -> convert to dot
    else if (/^\d+,\d+$/.test(s)) {
      s = s.replace(",", ".");
    } else {
      // Fallback: strip commas (safer for mixed inputs)
      s = s.replace(/,/g, "");
    }
  }

  // Keep only digits and at most one dot
  s = s.replace(/[^0-9.]+/g, "");

  if (!s) return 0;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}
