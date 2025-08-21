// src/csv/validateRows.ts
export function validateRequiredColumns(headers: string[]) {
  const H = new Set(headers.map(h => h.toLowerCase().trim()));
  const required = ["name","material","length","width","qty"];
  const missing = required.filter(r => !H.has(r));
  return { ok: missing.length === 0, missing };
}
