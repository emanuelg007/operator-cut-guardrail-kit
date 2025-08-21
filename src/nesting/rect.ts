// src/nesting/rect.ts
export interface Rect { x: number; y: number; w: number; h: number; }

export function splitFreeRect(free: Rect, used: Rect): Rect[] {
  const out: Rect[] = [];
  const fx2 = free.x + free.w, fy2 = free.y + free.h;
  const ux2 = used.x + used.w, uy2 = used.y + used.h;

  const xOverlap = !(ux2 <= free.x || used.x >= fx2);
  const yOverlap = !(uy2 <= free.y || used.y >= fy2);
  if (!xOverlap || !yOverlap) return [free];

  // Above
  if (used.y > free.y && used.y < fy2) {
    out.push({ x: free.x, y: free.y, w: free.w, h: used.y - free.y });
  }
  // Below
  if (uy2 < fy2 && uy2 > free.y) {
    out.push({ x: free.x, y: uy2, w: free.w, h: fy2 - uy2 });
  }
  // Left
  if (used.x > free.x && used.x < fx2) {
    const top = Math.max(free.y, used.y);
    const bottom = Math.min(fy2, uy2);
    out.push({ x: free.x, y: top, w: used.x - free.x, h: bottom - top });
  }
  // Right
  if (ux2 < fx2 && ux2 > free.x) {
    const top = Math.max(free.y, used.y);
    const bottom = Math.min(fy2, uy2);
    out.push({ x: ux2, y: top, w: fx2 - ux2, h: bottom - top });
  }

  // Filter invalid
  return out.filter(r => r.w > 0 && r.h > 0);
}

export function mergeFreeRects(rects: Rect[]): Rect[] {
  // naive merge: combine adjacent equal-height rows or equal-width columns if they touch
  rects = rects.slice().sort((a,b)=> a.y - b.y || a.x - b.x);
  let changed = true;
  while (changed) {
    changed = false;
    outer: for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i], b = rects[j];
        // horizontal merge
        if (a.y === b.y && a.h === b.h && a.x + a.w === b.x) {
          rects[i] = { x: a.x, y: a.y, w: a.w + b.w, h: a.h };
          rects.splice(j,1);
          changed = true; break outer;
        }
        // vertical merge
        if (a.x === b.x && a.w === b.w && a.y + a.h === b.y) {
          rects[i] = { x: a.x, y: a.y, w: a.w, h: a.h + b.h };
          rects.splice(j,1);
          changed = true; break outer;
        }
      }
    }
  }
  return rects;
}
