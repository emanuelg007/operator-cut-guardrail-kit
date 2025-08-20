import { getKerfMM, getMarginMM } from "../state/settings";
import { maxRectsPack } from "./maxRects";
import type {
  BoardSpec,
  NestablePart,
  SheetLayout,
  PackResultByMaterial,
  Grain,
} from "./types";
import type { Rect } from "./rect";

export interface PackOptions {
  kerf?: number;
  margin?: number;
  allowRotateDefault?: boolean;
  heuristic?: "BSSF";
  grain?: Grain;
  materialRotate?: boolean;
}

/** Group helper */
function lc(s: any): string { return String(s ?? "").trim().toLowerCase(); }
function materialOfPart(p: NestablePart): string { return lc(p.materialTag ?? p.material); }
function materialOfBoard(b: BoardSpec): string { return lc(b.materialTag); }

function rotationLockFor(p: NestablePart): "X" | "Y" | null {
  const g = (p.grain ?? "none");
  if (g === "alongX") return "X";
  if (g === "alongY") return "Y";
  return null;
}

export function packPartsToSheets(
  boards: BoardSpec[],
  parts: NestablePart[],
  opts: PackOptions = {}
): PackResultByMaterial {
  const kerf = opts.kerf ?? getKerfMM();
  const margin = opts.margin ?? getMarginMM();
  const allowRotateDefault = opts.allowRotateDefault ?? true;

  // Expand demand by qty
  const demand: NestablePart[] = [];
  for (const p of parts) {
    const qty = Math.max(0, Math.trunc(p.qty ?? 0));
    for (let i = 0; i < qty; i++) demand.push({ ...p, qty: 1 });
  }

  // Boards by material — respect copies (number | "infinite")
  const boardsByMat = new Map<string, BoardSpec[]>();
  for (const b of boards) {
    const m = materialOfBoard(b);
    const arr = boardsByMat.get(m) ?? [];
    const copies =
      b.copies === "infinite" ? Number.MAX_SAFE_INTEGER : Math.max(0, b.copies ?? 1);
    for (let i = 0; i < copies; i++) arr.push(b);
    boardsByMat.set(m, arr);
  }

  // Materials present
  const mats = new Set<string>();
  for (const p of demand) mats.add(materialOfPart(p));
  for (const [m] of boardsByMat) mats.add(m);

  const byMaterial: Record<string, SheetLayout[]> = {};
  const unplaced: NestablePart[] = [];

  for (const m of mats) {
    const matParts = demand.filter(p => materialOfPart(p) === m);
    if (matParts.length === 0) continue;

    const matBoards = boardsByMat.get(m) ?? [];
    if (matBoards.length === 0) { unplaced.push(...matParts); continue; }

    const layouts: SheetLayout[] = [];
    // Remaining counts per part-id/name tuple
    const remaining = new Map<string, { p: NestablePart; left: number }>();
    const keyOf = (p: NestablePart) => (p.id ?? `${p.name}:${p.w}x${p.h}`);

    for (const p of matParts) {
      const k = keyOf(p);
      const rec = remaining.get(k);
      if (rec) rec.left += 1;
      else remaining.set(k, { p, left: 1 });
    }

    for (let copyIdx = 0; copyIdx < matBoards.length; copyIdx++) {
      const board = matBoards[copyIdx];

      const W = Math.max(0, (board.width ?? 0) - 2 * margin);
      const H = Math.max(0, (board.height ?? 0) - 2 * margin);
      const sheet: Rect = { x: 0, y: 0, w: W, h: H };

      // Build pack items from still-needed parts
      type PackItem = { k: string; w: number; h: number; allowRotate: boolean; src: NestablePart };
      const items: PackItem[] = [];
      for (const { p, left } of remaining.values()) {
        if (left <= 0) continue;
        const lock = rotationLockFor(p);
        const allowRotate = (p.canRotate ?? allowRotateDefault) && lock === null;

        // inflate dims by kerf to approximate saw thickness
        const ew = p.w + kerf;
        const eh = p.h + kerf;

        // We'll let packer try both rotations; lock prevents rotation later on placement acceptance.
        items.push({ k: keyOf(p), w: ew, h: eh, allowRotate, src: p });
      }

      if (!items.length) break;

      const placements = maxRectsPack(sheet, items.map(it => ({ w: it.w, h: it.h })));

      const placed: SheetLayout["placed"] = [];
      for (let i = 0; i < placements.length; i++) {
        const plc = placements[i];
        if (!plc || plc.rect.w === 0 || plc.rect.h === 0) continue;

        const it = items[i];
        if (plc.rotated && !it.allowRotate) continue; // respect rotation lock

        const rec = remaining.get(it.k);
        if (!rec || rec.left <= 0) continue;
        rec.left -= 1;

        placed.push({
          id: it.src.id,
          name: it.src.name,
          x: plc.rect.x + margin,
          y: plc.rect.y + margin,
          w: it.src.w,
          h: it.src.h,
          rotated: plc.rotated,
          material: it.src.materialTag ?? it.src.material,
          rotation: plc.rotated ? 90 : 0,
          boardIdx: copyIdx,
        });
      }

      if (placed.length) {
        layouts.push({
          boardId: board.id,
          boardIdx: copyIdx,
          width: board.width,
          height: board.height,
          placed,
        });
      }

      // If everything is placed, stop consuming more copies
      let anyLeft = false;
      for (const rec of remaining.values()) { if (rec.left > 0) { anyLeft = true; break; } }
      if (!anyLeft) break;
    }

    // Whatever remains after all copies are used is unplaced
    for (const rec of remaining.values()) {
      for (let i = 0; i < rec.left; i++) unplaced.push(rec.p);
    }

    byMaterial[m || ""] = layouts;
  }

  return { byMaterial, unplaced };
}