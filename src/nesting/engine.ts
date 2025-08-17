// src/nesting/engine.ts
import type { NormalizedPart } from "../csv/normalize";
import { MaxRectsBin, type Heuristic } from "./maxRects";
import { orientationsFor, canRotatePart, type GrainMode } from "./constraints";

export type PackedPart = {
  name: string;
  x: number; y: number; w: number; h: number;
  rotated: boolean;
};

export type PackedSheet = {
  width: number; height: number; kerf: number;
  parts: PackedPart[];
};

export type PackResult = {
  boardW: number; boardH: number; kerf: number; margin: number;
  byMaterial: Record<string, PackedSheet[]>;
  unplaced: { name: string; w: number; h: number; material: string }[];
};

export type PackOptions = {
  boardW?: number;       // default 1830
  boardH?: number;       // default 2750
  kerf?: number;         // mm between parts
  margin?: number;       // clean margin (perimeter)
  heuristic?: Heuristic; // default "BSSF"
  grain?: GrainMode;     // "lengthwise" | "none"
  materialRotate?: boolean; // default true
};

// Core packing (global best bin preview per part)
export function packPartsToSheets(parts: NormalizedPart[], opt: PackOptions = {}): PackResult {
  const boardW = opt.boardW ?? 1830;
  const boardH = opt.boardH ?? 2750;
  const kerf   = opt.kerf   ?? 3;
  const margin = opt.margin ?? 10;
  const heuristic: Heuristic = opt.heuristic ?? "BSSF";
  const grain: GrainMode = opt.grain ?? "lengthwise";
  const materialRotate = opt.materialRotate ?? true;

  // Expand qty to instances
  const instances = parts.flatMap(p => {
    const qty = Math.max(1, Number(p.Qty ?? 1));
    const L = Number(p.Length) || 0;
    const W = Number(p.Width)  || 0;
    return Array.from({ length: qty }, () => ({
      name: p.Name, material: p.Material,
      L, W, allowRotate: canRotatePart(p.AllowRotate, materialRotate),
    }));
  });

  // Group by material
  const groups = new Map<string, typeof instances>();
  for (const it of instances) {
    const arr = groups.get(it.material) ?? [];
    arr.push(it);
    groups.set(it.material, arr);
  }

  const byMaterial: Record<string, PackedSheet[]> = {};
  const unplaced: PackResult["unplaced"] = [];

  for (const [material, items] of groups.entries()) {
    // Sort largest-first by area (stable)
    items.sort((a, b) => (b.L * b.W) - (a.L * a.W));

    const bins: MaxRectsBin[] = [];
    const sheets: PackedSheet[] = [];

    const newBin = () => {
      const bin = new MaxRectsBin(boardW, boardH, kerf, margin);
      bins.push(bin);
      sheets.push({ width: boardW, height: boardH, kerf, parts: [] });
      return bin;
    };

    if (bins.length === 0) newBin();

    for (const it of items) {
      // Find the globally best candidate across all existing bins
      let bestBinIdx = -1;
      let bestPose: ReturnType<MaxRectsBin["preview"]> | null = null;

      for (let i = 0; i < bins.length; i++) {
        const bin = bins[i];
        // Try all allowed orientations under grain/rotation constraints
        for (const o of orientationsFor(it.L, it.W, grain, it.allowRotate)) {
          const pose = bin.preview(o.w, o.h, false, heuristic); // already chose orientation
          if (!pose) continue;
          if (!bestPose || pose.score < bestPose.score) {
            bestPose = pose;
            bestBinIdx = i;
          }
        }
      }

      if (!bestPose) {
        // Open a new bin and try again
        newBin();
        const i = bins.length - 1;
        const bin = bins[i];
        for (const o of orientationsFor(it.L, it.W, grain, it.allowRotate)) {
          const pose = bin.preview(o.w, o.h, false, heuristic);
          if (!pose) continue;
          if (!bestPose || pose.score < bestPose.score) {
            bestPose = pose; bestBinIdx = i;
          }
        }
      }

      if (!bestPose || bestBinIdx === -1) {
        unplaced.push({ name: it.name, w: it.W, h: it.L, material });
        continue;
      }

      const bin = bins[bestBinIdx];
      bin.place({ x: bestPose.x, y: bestPose.y, w: bestPose.w, h: bestPose.h, rotated: bestPose.rotated });

      const sheet = sheets[bestBinIdx];
      sheet.parts.push({
        name: it.name,
        x: bestPose.x, y: bestPose.y, w: bestPose.w, h: bestPose.h,
        rotated: bestPose.rotated,
      });
    }

    byMaterial[material] = sheets;
  }

  return { boardW, boardH, kerf, margin, byMaterial, unplaced };
}
