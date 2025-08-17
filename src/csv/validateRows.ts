// src/csv/validateRows.ts
import { EXACT_HEADER_MAP, normalizeHeader } from "./aliases";

export function indexHeaders(headers: string[]): Record<string, number> {
  const idx: Record<string, number> = {};
  headers.forEach((h, i) => (idx[normalizeHeader(h)] = i));
  return idx;
}

export function validateRequiredColumns(
  headers: string[]
): { ok: boolean; missing: string[] } {
  // Your chosen “required” fields (aligned to your real CSV)
  const required = ["Name", "Material", "Length", "Width", "Quantity"];

  const idx = indexHeaders(headers);
  const missing: string[] = [];

  for (const key of required) {
    const exact = EXACT_HEADER_MAP[key as keyof typeof EXACT_HEADER_MAP] ?? key;
    if (!(normalizeHeader(exact) in idx)) {
      missing.push(key);
    }
  }

  return { ok: missing.length === 0, missing };
}

