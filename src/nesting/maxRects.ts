// src/nesting/maxRects.ts
import { Rect, splitFreeRect, mergeFreeRects } from "./rect";

export type MRHeuristic = "BSSF" | "BLSF" | "BAF" | "CONTACT";
export interface MRPlacement { rect: Rect; rotated: boolean; }
type Best = { score: number; placement: MRPlacement; frIdx: number };

export function maxRectsPack(
  sheet: Rect,
  items: { w: number; h: number }[],
  heuristic: MRHeuristic = "BSSF"
): MRPlacement[] {
  let freeRects: Rect[] = [{ ...sheet }];
  const result: MRPlacement[] = new Array(items.length) as any;

  for (let i = 0; i < items.length; i++) {
    const w = items[i].w, h = items[i].h;
    let best: Best | null = null;

    const consider = (rect: Rect, rotated: boolean, frIdx: number) => {
      const score =
        heuristic === "BSSF"   ? scoreBSSF(rect, w, h) :
        heuristic === "BLSF"   ? scoreBLSF(rect, w, h) :
        heuristic === "BAF"    ? scoreBAF(rect, w, h)  :
                                 scoreCONTACT(rect, w, h);
      if (score === Infinity) return;
      const cand: Best = { score, placement: { rect, rotated }, frIdx };
      if (best === null || score < best.score) best = cand;
    };

    for (let idx = 0; idx < freeRects.length; idx++) {
      const fr = freeRects[idx];
      if (w <= fr.w && h <= fr.h) consider({ x: fr.x, y: fr.y, w, h }, false, idx);
      if (h <= fr.w && w <= fr.h) consider({ x: fr.x, y: fr.y, w: h, h: w }, true, idx);
    }

    if (best === null) { result[i] = { rect: { x:0,y:0,w:0,h:0 }, rotated:false }; continue; }

    const b = best as Best;
    result[i] = b.placement;
    const used = b.placement.rect;

    const chosen = freeRects[b.frIdx];
    const pieces = splitFreeRect(chosen, used);
    freeRects.splice(b.frIdx, 1, ...pieces);
    freeRects = pruneContained(mergeFreeRects(freeRects));
  }

  return result;
}

function scoreBSSF(free: Rect, w: number, h: number): number {
  if (w > free.w || h > free.h) return Infinity;
  const a = free.w - w, b = free.h - h;
  return Math.min(a,b) * 1_000_000 + Math.max(a,b);
}
function scoreBLSF(free: Rect, w: number, h: number): number {
  if (w > free.w || h > free.h) return Infinity;
  const a = free.w - w, b = free.h - h;
  return Math.max(a,b) * 1_000_000 + Math.min(a,b);
}
function scoreBAF(free: Rect, w: number, h: number): number {
  if (w > free.w || h > free.h) return Infinity;
  const freeArea = free.w * free.h, itemArea = w * h;
  return (freeArea - itemArea) * 1_000_000 + Math.min(free.w - w, free.h - h);
}
function scoreCONTACT(free: Rect, w: number, h: number): number {
  if (w > free.w || h > free.h) return Infinity;
  const shortSide = Math.min(free.w - w, free.h - h);
  return (free.x + free.y) * 1_000_000 + shortSide;
}
function pruneContained(rects: Rect[]): Rect[] {
  const out: Rect[] = [];
  for (let i = 0; i < rects.length; i++) {
    const a = rects[i]; let contained = false;
    for (let j = 0; j < rects.length; j++) {
      if (i === j) continue; const b = rects[j];
      if (a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h) {
        contained = true; break;
      }
    }
    if (!contained) out.push(a);
  }
  return out;
}
