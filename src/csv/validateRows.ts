// src/csv/validateRows.ts
import { EXACT_HEADER_MAP, normalizeHeader } from "./aliases";

// Build a lookup { CanonicalKey -> columnIndex } and assert required headers exist
export function buildHeaderIndex(headers: string[]) {
  // Map normalized incoming headers once
  const incoming = headers.map(h => normalizeHeader(h));

  // Build normalized targets from our exact labels
  const keys = Object.keys(EXACT_HEADER_MAP) as (keyof typeof EXACT_HEADER_MAP)[];
  const targets = Object.fromEntries(
    keys.map(k => [k, normalizeHeader(EXACT_HEADER_MAP[k])])
  ) as Record<keyof typeof EXACT_HEADER_MAP, string>;

  // Start everything as "not found"
  const idx = Object.fromEntries(keys.map(k => [k, -1])) as Record<
    keyof typeof EXACT_HEADER_MAP,
    number
  >;

  // One-pass match (first match wins)
  for (let i = 0; i < incoming.length; i++) {
    const h = incoming[i];
    for (const k of keys) {
      if (idx[k] !== -1) continue;
      if (h === targets[k]) {
        idx[k] = i;
      }
    }
  }

  // Required columns for a valid cutting list row
  const required: (keyof typeof EXACT_HEADER_MAP)[] = [
    "Name",
    "Material",
    "Length",
    "Width",
    "Quantity",
  ];

  const missing = required
    .filter(k => idx[k] === -1)
    .map(k => EXACT_HEADER_MAP[k]);

  if (missing.length) {
    console.warn("[validate] incoming:", incoming);
    console.warn("[validate] targets :", targets);
    throw new Error(`Cutting CSV: Missing required column(s): ${missing.join(", ")}`);
  }

  return idx;
}
