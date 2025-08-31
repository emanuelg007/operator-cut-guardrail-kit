export function rects() {/* stub */}


/* -------------------------------------------------------------------------- *
 * Minimal geometry helpers for rectangles
 * -------------------------------------------------------------------------- */
export type Rect = { x: number; y: number; w: number; h: number };

export function contains(a: Rect, b: Rect | { x: number; y: number }): boolean {
  if ("w" in (b as any) && "h" in (b as any)) {
    const r = b as Rect;
    return r.x >= a.x && r.y >= a.y && r.x + r.w <= a.x + a.w && r.y + r.h <= a.y + a.h;
  }
  const p = b as { x: number; y: number };
  return p.x >= a.x && p.y >= a.y && p.x <= a.x + a.w && p.y <= a.y + a.h;
}

export function intersects(a: Rect, b: Rect): boolean {
  return !(b.x >= a.x + a.w || b.x + b.w <= a.x || b.y >= a.y + a.h || b.y + b.h <= a.y);
}

export function inflate(r: Rect, dx: number, dy = dx): Rect {
  return { x: r.x - dx, y: r.y - dy, w: r.w + dx * 2, h: r.h + dy * 2 };
}

export function centerOf(r: Rect): { x: number; y: number } {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

/** Snap rect’s origin to a grid (size in same units as rect). */
export function snap(r: Rect, grid: number): Rect {
  if (grid <= 0) return { ...r };
  const rx = Math.round(r.x / grid) * grid;
  const ry = Math.round(r.y / grid) * grid;
  return { x: rx, y: ry, w: r.w, h: r.h };
}
