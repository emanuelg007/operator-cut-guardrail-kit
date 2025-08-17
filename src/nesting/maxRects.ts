// src/nesting/maxRects.ts
import { Rect, area, splitFree, pruneContained } from "./geometry";

export type Heuristic = "BSSF" | "BLSF" | "BAF" | "CP"; // short-side, long-side, area, contact point
export type Placement = Rect & { rotated: boolean; name?: string; id?: string };

function fits(f: Rect, w: number, h: number) { return w <= f.w && h <= f.h; }
function contactScore(f: Rect, p: Rect) {
  // prefer hugging edges for better compaction
  let score = 0;
  if (p.x === f.x) score += p.h;
  if (p.y === f.y) score += p.w;
  if (p.x + p.w === f.x + f.w) score += p.h;
  if (p.y + p.h === f.y + f.h) score += p.w;
  return -score; // lower is better (we minimize)
}

export class MaxRectsBin {
  readonly width: number;
  readonly height: number;
  readonly kerf: number;
  free: Rect[] = [];
  used: Placement[] = [];

  constructor(width: number, height: number, kerf = 0, margin = 0) {
    this.width = width; this.height = height; this.kerf = kerf;
    this.free = [{
      x: margin,
      y: margin,
      w: Math.max(0, width - margin * 2),
      h: Math.max(0, height - margin * 2),
    }];
  }

  private score(f: Rect, w: number, h: number, heuristic: Heuristic) {
    const wLeft = f.w - w, hLeft = f.h - h;
    switch (heuristic) {
      case "BSSF": return Math.min(wLeft, hLeft) + Math.max(wLeft, hLeft) / 1e6;
      case "BLSF": return Math.max(wLeft, hLeft) + Math.min(wLeft, hLeft) / 1e6;
      case "BAF":  return (f.w * f.h) - (w * h);
      case "CP":   return contactScore(f, { x: f.x, y: f.y, w, h });
    }
  }

  // Preview: best position for w×h (optionally rotated). Returns score + pose or null if no fit.
  preview(w: number, h: number, allowRotate: boolean, heuristic: Heuristic) {
    let best: { score: number; idx: number; rotated: boolean; x: number; y: number; w: number; h: number } | null = null;

    for (let i = 0; i < this.free.length; i++) {
      const f = this.free[i];
      if (fits(f, w, h)) {
        const s = this.score(f, w, h, heuristic)!;
        if (!best || s < best.score) best = { score: s, idx: i, rotated: false, x: f.x, y: f.y, w, h };
      }
      if (allowRotate && fits(f, h, w)) {
        const s = this.score(f, h, w, heuristic)!;
        if (!best || s < best.score) best = { score: s, idx: i, rotated: true, x: f.x, y: f.y, w: h, h: w };
      }
    }
    return best;
  }

  // Commit a chosen pose into the bin
  place(p: Omit<Placement,"rotated"> & { rotated: boolean }) {
    // Split all intersecting free rects
    const fresh: Rect[] = [];
    for (const f of this.free) {
      const parts = splitFree(f, p, this.kerf);
      for (const r of parts) fresh.push(r);
    }
    this.free = fresh;
    pruneContained(this.free);
    this.used.push({ ...p });
  }
}
