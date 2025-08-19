// src/nesting src/nesting/rect.ts//
export interface Rect { x: number; y: number; w: number; h: number; }

export function intersects(a: Rect, b: Rect): boolean {
  return !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
}

export function splitFreeRect(free: Rect, used: Rect): Rect[] {
  if (!intersects(free, used)) return [free];
  const out: Rect[] = [];
  const fy2 = free.y + free.h;
  const ux2 = used.x + used.w;
  const uy2 = used.y + used.h;

  // top
  if (used.y > free.y) out.push({ x: free.x, y: free.y, w: free.w, h: used.y - free.y });
  // bottom
  if (uy2 < fy2) out.push({ x: free.x, y: uy2, w: free.w, h: fy2 - uy2 });
  // left
  if (used.x > free.x) {
    const y = Math.max(free.y, used.y);
    const h = Math.min(fy2, uy2) - y;
    if (h > 0) out.push({ x: free.x, y, w: used.x - free.x, h });
  }
  // right
  const fx2 = free.x + free.w;
  if (ux2 < fx2) {
    const y = Math.max(free.y, used.y);
    const h = Math.min(fy2, uy2) - y;
    if (h > 0) out.push({ x: ux2, y, w: fx2 - ux2, h });
  }
  return out;
}

export function mergeFreeRects(rects: Rect[]): Rect[] {
  const out = rects.slice();
  let merged = true;
  while (merged) {
    merged = false;
    outer: for (let i = 0; i < out.length; i++) {
      for (let j = i + 1; j < out.length; j++) {
        const a = out[i], b = out[j];
        // horizontal merge
        if (a.y === b.y && a.h === b.h && (a.x + a.w === b.x || b.x + b.w === a.x)) {
          out[i] = { x: Math.min(a.x, b.x), y: a.y, w: a.w + b.w, h: a.h };
          out.splice(j, 1); merged = true; break outer;
        }
        // vertical merge
        if (a.x === b.x && a.w === b.w && (a.y + a.h === b.y || b.y + b.h === a.y)) {
          out[i] = { x: a.x, y: Math.min(a.y, b.y), w: a.w, h: a.h + b.h };
          out.splice(j, 1); merged = true; break outer;
        }
      }
    }
  }
  return out;
}

