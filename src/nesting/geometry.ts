// src/nesting/geometry.ts
export type Rect = { x: number; y: number; w: number; h: number };

export function area(r: Rect) { return r.w * r.h; }
export function contains(a: Rect, b: Rect) {
  return b.x >= a.x && b.y >= a.y && b.x + b.w <= a.x + a.w && b.y + b.h <= a.y + a.h;
}
export function intersects(a: Rect, b: Rect) {
  return !(b.x >= a.x + a.w || b.x + b.w <= a.x || b.y >= a.y + a.h || b.y + b.h <= a.y);
}

// Split a free-rect f by a placed rect p (with kerf as gap). Returns 0..4 new rects.
export function splitFree(f: Rect, p: Rect, kerf: number): Rect[] {
  // Inflate placed rect by kerf “fence” so future placements respect the cut width
  const fence: Rect = {
    x: p.x - kerf, y: p.y - kerf,
    w: p.w + kerf, h: p.h + kerf
  };
  if (!intersects(f, fence)) return [f];

  const out: Rect[] = [];
  const fRight = f.x + f.w, fBottom = f.y + f.h;
  const fenceRight = fence.x + fence.w, fenceBottom = fence.y + fence.h;

  // Top slice
  if (f.y < fence.y && fence.y < fBottom) {
    out.push({ x: f.x, y: f.y, w: f.w, h: fence.y - f.y });
  }
  // Bottom slice
  if (f.y < fenceBottom && fenceBottom < fBottom) {
    out.push({ x: f.x, y: fenceBottom, w: f.w, h: fBottom - fenceBottom });
  }
  // Left slice
  if (f.x < fence.x && fence.x < fRight) {
    const top = Math.max(f.y, fence.y);
    const bottom = Math.min(fBottom, fenceBottom);
    out.push({ x: f.x, y: top, w: fence.x - f.x, h: bottom - top });
  }
  // Right slice
  if (f.x < fenceRight && fenceRight < fRight) {
    const top = Math.max(f.y, fence.y);
    const bottom = Math.min(fBottom, fenceBottom);
    out.push({ x: fenceRight, y: top, w: fRight - fenceRight, h: bottom - top });
  }

  // Filter invalid
  return out.filter(r => r.w > 0 && r.h > 0);
}

export function pruneContained(free: Rect[]) {
  for (let i = 0; i < free.length; i++) {
    const a = free[i];
    for (let j = free.length - 1; j >= 0; j--) {
      if (i === j) continue;
      const b = free[j];
      if (contains(a, b)) { free.splice(j, 1); if (j < i) i--; }
    }
  }
}
