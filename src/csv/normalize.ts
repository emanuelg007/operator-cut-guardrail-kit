// src/csv/normalize.ts

// Shape we’ll use across the app once a row is normalized
export interface NormalizedPart {
  Name: string;
  Material: string;
  Length: number;   // in project units for now (we can convert to mm later)
  Width: number;    // "
  Qty: number;

  // optional extras
  Notes?: string;
  Note1?: string;
  Note2?: string;
  AllowRotate?: boolean; // true if CSV says 1/yes; absent otherwise
  EdgeL1?: string;
  EdgeL2?: string;
  EdgeW1?: string;
  EdgeW2?: string;
}

// Canonical keys we support mapping for (must match the modal)
type CanonicalKey =
  | "Name"
  | "Material"
  | "Length"
  | "Width"
  | "Qty"
  | "Notes"
  | "Note1"
  | "Note2"
  | "AllowRotate"
  | "EdgeL1"
  | "EdgeL2"
  | "EdgeW1"
  | "EdgeW2";

const CANONICAL: CanonicalKey[] = [
  "Name","Material","Length","Width","Qty",
  "Notes","Note1","Note2",
  "AllowRotate","EdgeL1","EdgeL2","EdgeW1","EdgeW2"
];

// Small helpers
const trim = (s: unknown) => (typeof s === "string" ? s.trim() : "");
function toNumber(raw: string | undefined): number {
  if (!raw) return NaN;
  const s = raw.replace(",", ".").trim();
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : NaN;
}
function truthyRotate(raw: string | undefined): boolean | undefined {
  if (!raw) return undefined;
  const s = raw.trim().toLowerCase();
  if (s === "1" || s === "yes" || s === "y" || s === "true") return true;
  if (s === "0" || s === "no" || s === "n" || s === "false") return false;
  // “2 = same as material” → leave undefined for now (material rules layer can decide)
  return undefined;
}

/**
 * Normalize raw CSV rows into typed parts using a header mapping.
 * @param headers The CSV header row (exact strings from the file)
 * @param rows    All CSV data rows (arrays of cell strings)
 * @param mapping Record of CanonicalKey -> chosen CSV header (or null)
 */
export function normalizeRows(
  headers: string[],
  rows: string[][],
  mapping: Record<string, string | null>
): NormalizedPart[] {
  // Build index lookup: for each canonical key, where is the chosen header in the CSV?
  const idx: Partial<Record<CanonicalKey, number>> = {};
  for (const key of CANONICAL) {
    const chosen = mapping[key];
    idx[key] = chosen ? headers.indexOf(chosen) : -1;
  }

  const out: NormalizedPart[] = [];

  for (const row of rows) {
    const get = (key: CanonicalKey): string | undefined => {
      const j = idx[key] ?? -1;
      return j >= 0 ? row[j] ?? "" : "";
    };

    const name = trim(get("Name"));
    const material = trim(get("Material"));
    const length = toNumber(get("Length"));
    const width  = toNumber(get("Width"));
    const qtyRaw = get("Qty");
    const qty    = Number.isFinite(parseFloat(qtyRaw ?? "")) ? Math.max(1, Math.round(parseFloat(qtyRaw!))) : 1;

    // Hard validation: must have these
    if (!name || !material || !Number.isFinite(length) || !Number.isFinite(width)) {
      continue; // skip invalid row
    }

    const part: NormalizedPart = {
      Name: name,
      Material: material,
      Length: length,
      Width: width,
      Qty: qty,
    };

    // Optional fields
    const notes = trim(get("Notes"));
    if (notes) part.Notes = notes;

    const n1 = trim(get("Note1"));
    if (n1) part.Note1 = n1;

    const n2 = trim(get("Note2"));
    if (n2) part.Note2 = n2;

    const ar = truthyRotate(get("AllowRotate"));
    if (typeof ar === "boolean") part.AllowRotate = ar;

    const eL1 = trim(get("EdgeL1")); if (eL1) part.EdgeL1 = eL1;
    const eL2 = trim(get("EdgeL2")); if (eL2) part.EdgeL2 = eL2;
    const eW1 = trim(get("EdgeW1")); if (eW1) part.EdgeW1 = eW1;
    const eW2 = trim(get("EdgeW2")); if (eW2) part.EdgeW2 = eW2;

    out.push(part);
  }

  return out;
}
