// Commercial-grade packer: MaxRects primary, Skyline fallback; kerf, margins,
// grain/rotation constraints, autosplit over copies.
import { getKerfMM, getMarginMM } from "../state/settings";
import { maxRectsPack } from "./maxRects";
import { skylinePack } from "./skyline";
import { Rect } from "./rect";
import {
  BoardSpec,
  NestablePart,
  PackResult,
  PlacedPart,
  SheetLayout,
} from "./types";

interface ExpandedItem {
  // dimensions after kerf expansion
  w: number; h: number; allowRotate: boolean;
  // original identity
  srcIdx: number;
  rotationConstraint: 0 | 90 | null; // null => free to choose
}

function honorsGrain(part: NestablePart, rotated: boolean): boolean {
  if (part.grain === "none") return true;
  // alongX: long grain along X => a rotated placement (90°) flips axes
  // We interpret 'grain alongX' as the grain must align with sheet X axis.
  // If part's long edge is along X before rotation, rotation flips it.
  const longAlongX = part.w >= part.h;
  if (part.grain === "alongX") {
    return rotated ? !longAlongX : longAlongX;
  }
  // alongY
  const longAlongY = part.h >= part.w;
  if (part.grain === "alongY") {
    return rotated ? !longAlongY : longAlongY;
  }
  return true;
}

export function packPartsToSheets(
  boards: BoardSpec[],
  parts: NestablePart[],
): PackResult {
  const kerf = getKerfMM();
  const margin = getMarginMM();
if (!Array.isArray(boards) || !Array.isArray(parts)) {
  throw new Error(`packPartsToSheets expects (boards[], parts[], options).`);
}
  // Build a flat demand list
  const demand: NestablePart[] = [];
  for (const p of parts) {
    for (let i = 0; i < p.qty; i++) demand.push({ ...p, qty: 1 });
  }

  // Group by board id (or by materialTag if you prefer). Here: by board id order.
  const outSheets: SheetLayout[] = [];
  const unplacedMap = new Map<string, number>();

  for (const board of boards) {
    // Filter parts compatible by materialTag (if provided)
    const todo = demand.filter(p => !p.materialTag || !board.materialTag || p.materialTag === board.materialTag);
    if (todo.length === 0) continue;

    const copies = board.copies === "infinite" ? Number.MAX_SAFE_INTEGER : Math.max(0, board.copies);
    let copyIdx = 0;

    // Try to place as many of the still-unplaced 'todo' as possible across copies
    while (copyIdx < copies && todo.some(p => p.qty > 0)) {
      const sheetRect: Rect = {
        x: 0,
        y: 0,
        w: Math.max(0, board.width - 2 * margin),
        h: Math.max(0, board.height - 2 * margin),
      };
      if (sheetRect.w <= 0 || sheetRect.h <= 0) break;

      // Build expanded items list for parts not yet placed (for this board)
      const expanded: ExpandedItem[] = [];
      const srcRefs: NestablePart[] = [];
      for (let i = 0; i < todo.length; i++) {
        const p = todo[i];
        if (p.qty <= 0) continue;

        // Expand dims by kerf (reserve spacing). We expand width/height by kerf.
        const ew = p.w + kerf;
        const eh = p.h + kerf;

        // If kerf makes it impossible (smaller than kerf), skip with unplaced later
        if (ew <= 0 || eh <= 0) continue;

        // Rotation constraint from grain
        let rotationConstraint: 0 | 90 | null = null;
        if (p.grain === "alongX") {
          rotationConstraint = (p.w >= p.h) ? 0 : 90;
        } else if (p.grain === "alongY") {
          rotationConstraint = (p.h >= p.w) ? 0 : 90;
        }

        expanded.push({
          w: ew, h: eh, allowRotate: p.canRotate && rotationConstraint === null,
          srcIdx: srcRefs.length,
          rotationConstraint,
        });
        srcRefs.push(p);
      }

      if (expanded.length === 0) break;

      // Primary: MaxRects
      const mr = maxRectsPack(sheetRect, expanded.map(e => ({
        w: e.w, h: e.h, allowRotate: e.allowRotate || e.rotationConstraint === 90,
      })));

      // Build placements that honored grain; anything that failed (null or grain fail) will try skyline
      const needFallback: number[] = [];
      const taken: (PlacedPart | null)[] = new Array(expanded.length).fill(null);

      for (let i = 0; i < expanded.length; i++) {
        const plc = mr[i];
        if (!plc) { needFallback.push(i); continue; }

        const src = srcRefs[expanded[i].srcIdx];
        const rotate = (plc.rotated ? 90 : 0) as 0 | 90;
        // If rotation constrained, enforce it
        if (expanded[i].rotationConstraint !== null && rotate !== expanded[i].rotationConstraint) {
          needFallback.push(i); continue;
        }
        if (!honorsGrain(src, plc.rotated)) { needFallback.push(i); continue; }

        // Convert expanded rect -> drawable coords (center kerf gap)
        const dx = plc.rect.x + margin + (kerf / 2);
        const dy = plc.rect.y + margin + (kerf / 2);
        const dw = (expanded[i].w - kerf);
        const dh = (expanded[i].h - kerf);

        taken[i] = {
          id: src.id, name: src.name, x: dx, y: dy, w: dw, h: dh,
          rotation: rotate, boardIdx: copyIdx,
        };
      }

      if (needFallback.length) {
        // Fallback Skyline for the remaining
        const remaining = needFallback.map(i => expanded[i]);
        const sky = skylinePack(sheetRect, remaining.map(e => ({
          w: e.w, h: e.h, allowRotate: e.allowRotate || e.rotationConstraint === 90,
        })));

        for (let k = 0; k < remaining.length; k++) {
          const rIdx = needFallback[k];
          const plc = sky[k];
          if (!plc) continue;

          const src = srcRefs[expanded[rIdx].srcIdx];
          const rotate = (plc.rotated ? 90 : 0) as 0 | 90;
          if (expanded[rIdx].rotationConstraint !== null && rotate !== expanded[rIdx].rotationConstraint) continue;
          if (!honorsGrain(src, plc.rotated)) continue;

          const dx = plc.rect.x + margin + (kerf / 2);
          const dy = plc.rect.y + margin + (kerf / 2);
          const dw = (expanded[rIdx].w - kerf);
          const dh = (expanded[rIdx].h - kerf);

          taken[rIdx] = {
            id: src.id, name: src.name, x: dx, y: dy, w: dw, h: dh,
            rotation: rotate, boardIdx: copyIdx,
          };
        }
      }

      // Assemble sheet result + decrement placed demand
      const placed = taken.filter(Boolean) as PlacedPart[];
      for (const plc of placed) {
        const src = srcRefs.find(p => p.id === plc.id)!;
        // decrement one (this sheet placed only 1 per expanded item)
        const inTodo = todo.find(p => p.id === src.id);
        if (inTodo && inTodo.qty > 0) inTodo.qty -= 1;
      }

      if (placed.length > 0) {
        outSheets.push({
          boardId: board.id,
          boardIdx: copyIdx,
          width: board.width,
          height: board.height,
          placed,
          waste: [], // can be computed later from free rectangles if desired
        });
      }

      copyIdx += 1;
    }
  }

  // Any leftover demand becomes unplaced
  for (const p of demand) {
    const left = Math.max(0, p.qty);
    if (left > 0) unplacedMap.set(p.id, (unplacedMap.get(p.id) || 0) + left);
  }

  return {
    sheets: outSheets,
    unplaced: [...unplacedMap.entries()].map(([id, count]) => {
      const proto = parts.find(p => p.id === id)!;
      return { part: proto, count };
    }),
  };
}
export type { PackResult } from "./types";
