// src/csv/normalize.ts
import type { NestablePart } from "../nesting/types";
import { parseNumberLike } from "../utils/num";

export type Mapping = {
  // minimally required for nesting:
  Name: string;
  Material: string;
  Length: string;
  Width: string;
  Qty: string;
  // optional but respected when present:
  MaterialTag?: string;
  CanRotateRaw?: string; // your "Can Rotate (0 = No / 1 = Yes / 2 = Same As Material)"
  LongExpansion?: string;  // "Long Expansion"
  ShortExpansion?: string; // "Short Expansion"
};

/** Auto-map using your exact headers (semicolon list you pasted) */
export function autoMap(headers: string[]): Mapping {
  const idx = (want: string) => {
    const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
    const H = headers.map(norm);
    const find = (...cands: string[]) => {
      for (const c of cands) {
        const i = H.indexOf(norm(c));
        if (i !== -1) return headers[i];
      }
      return "";
    };
    return find(want);
  };

  return {
    Name:         idx("Name") || headers[1] || "",
    Material:     idx("Material"),
    Length:       idx("Length"),
    Width:        idx("Width"),
    Qty:          idx("Quantity") || idx("Qty"),
    MaterialTag:  idx("Material Tag") || idx("MaterialTag"),
    CanRotateRaw: idx("Can Rotate (0 = No / 1 = Yes / 2 = Same As Material)") || idx("CanRotate"),
    LongExpansion:  idx("Long Expansion"),
    ShortExpansion: idx("Short Expansion"),
  };
}

/**
 * Turn CSV rows into NestablePart[] while preserving ALL columns:
 * - Uses Mapping to find key columns (no guessing of units; everything in mm)
 * - Applies Long/Short Expansion to Length/Width if present
 * - Parses rotation rule (0/1/2)
 * - Packs the rest of the columns under `extra` for Details/Reporting
 */
export function normalizeRows(
  headers: string[],
  rows: string[][],
  mapping: Mapping
): NestablePart[] {
  const H = headers;
  const get = (row: string[], key?: string) =>
    key ? (row[H.indexOf(key)] ?? "") : "";

  const parts: NestablePart[] = [];

  for (const row of rows) {
    // Base fields (in mm)
    const name = (get(row, mapping.Name) || "").toString().trim();
    const material = (get(row, mapping.Material) || "").toString().trim();
    const materialTag = (mapping.MaterialTag ? get(row, mapping.MaterialTag) : "").toString().trim() || undefined;

    const Lraw = get(row, mapping.Length);
    const Wraw = get(row, mapping.Width);
    const qtyRaw = get(row, mapping.Qty);

    let L = parseNumberLike(Lraw);
    let W = parseNumberLike(Wraw);
    const qty = Math.max(1, parseNumberLike(qtyRaw) || 1);

    // Expansions (mm)
    const longExp  = parseNumberLike(mapping.LongExpansion  ? get(row, mapping.LongExpansion)  : "");
    const shortExp = parseNumberLike(mapping.ShortExpansion ? get(row, mapping.ShortExpansion) : "");
    if (longExp)  L += longExp;
    if (shortExp) W += shortExp;

    // Rotation
    const rotRaw = (mapping.CanRotateRaw ? get(row, mapping.CanRotateRaw) : "").trim();
    let canRotate: boolean | undefined = undefined;
    if (rotRaw !== "") {
      const v = parseNumberLike(rotRaw);
      if (v === 0) canRotate = false;
      else if (v === 1) canRotate = true;
      else if (v === 2) canRotate = undefined; // "same as material" → defer to material/grain rules
    }

    if (!(L > 0 && W > 0)) continue; // skip invalid rows

    // Preserve ALL columns in extra
    const extra: Record<string, unknown> = {};
    for (let i = 0; i < headers.length; i++) {
      const key = headers[i];
      extra[key] = row[i] ?? "";
    }

    parts.push({
      id: `${name || material || "item"}#${parts.length + 1}`,
      name,
      material,
      materialTag,
      w: W,
      h: L,
      qty,
      canRotate,
      extra,
    });
  }

  return parts;
}
