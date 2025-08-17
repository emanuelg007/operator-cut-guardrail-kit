// src/nesting/maxRects.ts
export interface Rect { x: number; y: number; w: number; h: number; }

export class MaxRectsBin {
  width: number;
  height: number;
  kerf: number;
  free: Rect[];
  used: Rect[] = [];
  constructor(w: number, h: number, kerf: number) {
    this.width = w;
    this.height = h;
    this.kerf = kerf;
    this.free = [{ x: 0, y: 0, w, h }];
  }
}

// Very small, Best Area Fit insert
export function insertBestAreaFit(bin: MaxRectsBin, w: number, h: number): Rect | null {
  let best: { idx: number; waste: number; rect: Rect } | null = null;

  // include kerf around the placed rect when carving free space
  const needW = w + bin.kerf;
  const needH = h + bin.kerf;

  for (let i = 0; i < bin.free.length; i++) {
    const fr = bin.free[i];
    if (needW <= fr.w && needH <= fr.h) {
      const waste = fr.w * fr.h - needW * needH;
      if (!best || waste < best.waste) {
        best = { idx: i, waste, rect: { x: fr.x, y: fr.y, w, h } };
      }
    }
  }
  if (!best) return null;

  const fr = bin.free.splice(best.idx, 1)[0];
  // split into right and down areas
  const right: Rect = { x: fr.x + needW, y: fr.y, w: fr.w - needW, h: needH };
  const down: Rect  = { x: fr.x, y: fr.y + needH, w: fr.w, h: fr.h - needH };
  if (right.w > 0 && right.h > 0) bin.free.push(right);
  if (down.w > 0 && down.h > 0)  bin.free.push(down);

  bin.used.push(best.rect);
  return best.rect;
}
