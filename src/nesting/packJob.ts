// src/nesting/packJob.ts
import type { NormalizedPart } from "../csv/normalize";

export interface PlacedPart {
  name: string;
  material: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotated: boolean;
}

export interface Sheet {
  material: string;
  width: number;
  height: number;
  parts: PlacedPart[];
  index: number; // 1-based within material
}

export interface PackOptions {
  boardW: number;   // mm
  boardH: number;   // mm
  kerf: number;     // mm (gap between parts)
  margin: number;   // mm (clean margin on each edge)
  allowRotateDefault?: boolean;
}

/**
 * Simple shelf packer:
 * - Places parts left→right, wraps to next row when needed, creates new sheets as needed.
 * - Respects kerf and margins.
 * - If a part doesn't fit as-is but "rotation allowed", tries 90° rotation.
 */
export function packJob(parts: NormalizedPart[], opts: PackOptions): Sheet[] {
  const { boardW, boardH, kerf, margin, allowRotateDefault = true } = opts;

  // Expand by qty and group by material
  const byMat = new Map<string, NormalizedPart[]>();
  for (const p of parts) {
    const qty = Math.max(1, Number(p.Qty ?? 1));
    const arr = byMat.get(p.Material) ?? [];
    for (let i = 0; i < qty; i++) arr.push(p);
    byMat.set(p.Material, arr);
  }

  const sheets: Sheet[] = [];

  const usableW = boardW - margin * 2;
  const usableH = boardH - margin * 2;

  for (const [material, items] of byMat) {
    // sort big → small (by area) for a bit better packing
    items.sort((a, b) => (b.Length * b.Width) - (a.Length * a.Width));

    let current: Sheet = newSheet(material, sheets.filter(s => s.material === material).length + 1);
    let cursorX = margin;
    let cursorY = margin;
    let rowH = 0;

    function newSheet(mat: string, idx: number): Sheet {
      const s: Sheet = { material: mat, width: boardW, height: boardH, parts: [], index: idx };
      sheets.push(s);
      return s;
    }

    function startNewRow() {
      cursorX = margin;
      cursorY += rowH + kerf;
      rowH = 0;
    }

    function startNewSheet() {
      current = newSheet(material, sheets.filter(s => s.material === material).length + 1);
      cursorX = margin;
      cursorY = margin;
      rowH = 0;
    }

    for (const p of items) {
      let w = Math.max(1, Math.round(p.Length)); // our canonical uses Length/Width (mm)
      let h = Math.max(1, Math.round(p.Width));
      const canRotate = (p.AllowRotate ?? allowRotateDefault) ? true : false;

      // try place (maybe rotated) on current row/sheet
      let placed = tryPlace(w, h, false);
      if (!placed && canRotate) placed = tryPlace(h, w, true);

      if (!placed) {
        // try new row on same sheet
        startNewRow();
        placed = tryPlace(w, h, false);
        if (!placed && canRotate) placed = tryPlace(h, w, true);
      }

      if (!placed) {
        // need a fresh sheet
        startNewSheet();
        placed = tryPlace(w, h, false);
        if (!placed && canRotate) placed = tryPlace(h, w, true);
      }

      if (!placed) {
        // If still impossible, skip (too big for board)
        // You can collect these in a "unplaceable" list later
        continue;
      }

      current.parts.push({
        name: p.Name,
        material: p.Material,
        x: placed.x,
        y: placed.y,
        w: placed.w,
        h: placed.h,
        rotated: placed.rotated,
      });
    }

    function tryPlace(w: number, h: number, rotated: boolean) {
      // wrap to next row if width overflows
      if (cursorX + w > margin + usableW) {
        startNewRow();
      }
      // if height overflows even at start of row -> can't fit on this sheet
      if (cursorY + h > margin + usableH) return null;

      const pos = { x: cursorX, y: cursorY, w, h, rotated };
      cursorX += w + kerf;
      rowH = Math.max(rowH, h);
      return pos;
    }
  }

  return sheets;
}
