//src/nesting/maxRects.ts ///
import { Rect, splitFreeRect, mergeFreeRects } from "./rect";

export interface MRPlacement { rect: Rect; rotated: boolean; }

export function maxRectsPack(sheet: Rect, items: { w: number; h: number; id?: string }[]): MRPlacement[] {
  let freeRects: Rect[] = [{ ...sheet }];
  const result: MRPlacement[] = new Array(items.length) as any;

  for (let i = 0; i < items.length; i++) {
    const w = items[i].w, h = items[i].h;
    let best: { score: number; placement: MRPlacement; frIdx: number } | null = null;

    for (let idx = 0; idx < freeRects.length; idx++) {
      const fr = freeRects[idx];
      const s1 = scoreBSSF(fr, w, h);
      if (s1 !== Infinity) consider({ x: fr.x, y: fr.y, w, h }, false, idx, s1);
      const s2 = scoreBSSF(fr, h, w);
      if (s2 !== Infinity) consider({ x: fr.x, y: fr.y, w: h, h: w }, true, idx, s2);
    }

    if (!best) { result[i] = { rect: { x: 0, y: 0, w: 0, h: 0 }, rotated: false }; continue; }

    result[i] = best.placement;
    const used = best.placement.rect;

    // split chosen free rect by used area
    const chosen = freeRects[best.frIdx];
    const pieces = splitFreeRect(chosen, used);
    freeRects.splice(best.frIdx, 1, ...pieces);
    freeRects = pruneContained(mergeFreeRects(freeRects));

    function consider(rect: Rect, rotated: boolean, frIdx: number, score: number) {
      if (!best || score < best.score) best = { score, placement: { rect, rotated }, frIdx };
    }
  }

  return result;
}

function scoreBSSF(free: Rect, w: number, h: number): number {
  if (w > free.w || h > free.h) return Infinity;
  const leftoverH = free.h - h;
  const leftoverW = free.w - w;
  return Math.min(leftoverH, leftoverW); // best short side first
}

function pruneContained(rects: Rect[]): Rect[] {
  const out: Rect[] = [];
  for (let i = 0; i < rects.length; i++) {
    const a = rects[i];
    let contained = false;
    for (let j = 0; j < rects.length; j++) {
      if (i === j) continue;
      const b = rects[j];
      if (a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h) {
        contained = true; break;
      }
    }
    if (!contained) out.push(a);
  }
  return out;
}

