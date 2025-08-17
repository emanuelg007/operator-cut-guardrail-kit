

// src/csv/validateRows.ts
import { EXACT_HEADER_MAP, normalizeHeader } from "./aliases";

// The canonical fields we require in your CSV (using your real headings via EXACT_HEADER_MAP)
const REQUIRED_CANONICAL = ["Name", "Material", "Length", "Width", "Qty"] as const;

export function validateRequiredColumns(headers: string[]) {
  // Normalize the incoming header row once
  const have = new Set(headers.map((h) => normalizeHeader(h)));

  const missing: string[] = [];
  for (const key of REQUIRED_CANONICAL) {
    // Map canonical -> your exact header string (e.g. Qty -> "Quantity")
    const exactHeader = (EXACT_HEADER_MAP as any)[key] as string;
    const norm = normalizeHeader(exactHeader);
    if (!have.has(norm)) missing.push(exactHeader);
  }

  return { ok: missing.length === 0, missing };
}

// (Optional) local helper if you need a lookup inside this module.
// Not exported on purpose to avoid name collisions.
function buildHeaderIndex(headers: string[]) {
  const idx: Record<string, number> = {};
  headers.forEach((h, i) => {
    idx[normalizeHeader(h)] = i;
  });
  return idx;
}