// src/materials/toBoards.ts
import type { BoardSpec, Grain } from "../nesting/types";

// ---------- helpers ----------
function num(v: any, d = 0): number {
  if (v === null || v === undefined || v === "") return d;
  const s = String(v).trim().replace(/,/g, ".");
  const m = s.match(/^(-?\d+(?:\.\d+)?)/);
  const n = m ? Number(m[1]) : Number(s);
  return Number.isFinite(n) ? n : d;
}
function str(v: any, d = ""): string {
  if (v === null || v === undefined) return d;
  const s = String(v).trim();
  return s.length ? s : d;
}
function pick(row: Record<string, any>, keys: string[], d?: any) {
  for (const k of keys) if (k in row && row[k] !== "" && row[k] !== undefined) return row[k];
  return d;
}
function grainFrom(v: any): Grain {
  const s = String(v ?? "").toLowerCase().trim();
  if (s === "alongx" || s === "width") return "alongX";
  if (s === "alongy" || s === "length") return "alongY";
  return "none";
}

// ---------- main ----------
/**
 * Convert parsed materials CSV rows into BoardSpec[].
 * Expects millimetres; supports strict keys and common aliases.
 *
 * Canonical fields:
 *  - MaterialTag (string)
 *  - BoardLength (number, mm)
 *  - BoardWidth  (number, mm)
 *  - Thickness   (number, mm)
 * Optional:
 *  - Copies, Grain, BoardID
 */
export function materialsRowsToBoards(rows: Array<Record<string, any>>): BoardSpec[] {
  const out: BoardSpec[] = [];
  let auto = 0;

  for (const row of rows) {
    // Required
    const lengthMm = num(
      pick(row, ["BoardLength", "Sheet Length (mm)", "Sheet Length", "Board Length", "board length", "sheetLength"]),
      NaN
    );
    const widthMm = num(
      pick(row, ["BoardWidth", "Sheet Width (mm)", "Sheet Width", "Board Width", "board width", "sheetWidth"]),
      NaN
    );
    if (Number.isNaN(lengthMm) || Number.isNaN(widthMm)) continue; // skip bad rows

    const materialTag = str(pick(row, ["MaterialTag", "Material Tag", "Material", "materialTag"], ""));

    // Optional
    const boardId = str(pick(row, ["BoardID", "Board Id", "Board ID", "boardId"], "")) || `board-${auto++}`;
    const copies = Math.max(1, num(pick(row, ["Copies", "Quantity", "Stock", "copies"], 1)));
    const grain = grainFrom(pick(row, ["Grain", "grain"], "none"));

    // IMPORTANT: engine expects Rect { w, h } => map Width→w (X), Length→h (Y)
    out.push({
      id: boardId,
      width: widthMm,
      height: lengthMm,
      copies,
      materialTag: materialTag || undefined,
      grain, // retained if your types include it; otherwise harmless extra prop
    } as BoardSpec);
  }

  return out;
}

