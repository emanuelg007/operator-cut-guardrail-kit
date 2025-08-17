// src/nesting/packJob.ts
import { MaxRectsBin, insertBestAreaFit } from "./maxRects";

export interface PackRequestPart {
  id: string;
  w: number; // mm
  h: number; // mm
  allowRotate: boolean;
  material: string;
}

export interface BoardSpec {
  material: string;
  boardW: number;
  boardH: number;
  kerf: number;
  cleanMargin: number;
  grainLengthwise: boolean; // reserved for later
}

export interface Placed {
  id: string;
  binIndex: number;
  x: number; y: number;
  w: number; h: number;
  rotated: boolean;
}

export interface PackResult {
  bins: MaxRectsBin[];
  placed: Placed[];
  unplaced: PackRequestPart[];
}

export function packJob(parts: PackRequestPart[], board: BoardSpec): PackResult {
  const bins: MaxRectsBin[] = [];
  const placed: Placed[] = [];
  const unplaced: PackRequestPart[] = [];

  function newBin(): MaxRectsBin {
    // carve clean margins from the work area
    const workW = board.boardW - board.cleanMargin * 2;
    const workH = board.boardH - board.cleanMargin * 2;
    return new MaxRectsBin(workW, workH, board.kerf);
  }
  function currentBin(): MaxRectsBin {
    if (bins.length === 0) bins.push(newBin());
    return bins[bins.length - 1];
  }

  for (const p of parts) {
    let bin = currentBin();
    const tryPlace = (w: number, h: number) => insertBestAreaFit(bin, w, h);

    let pos = tryPlace(p.w, p.h);
    let rotated = false;

    if (!pos && p.allowRotate) {
      const posR = tryPlace(p.h, p.w);
      if (posR) { pos = posR; rotated = true; }
    }

    if (!pos) {
      bins.push(newBin());
      bin = currentBin();
      pos = tryPlace(p.w, p.h);
      rotated = false;
      if (!pos && p.allowRotate) {
        const posR = tryPlace(p.h, p.w);
        if (posR) { pos = posR; rotated = true; }
      }
    }

    if (pos) {
      placed.push({
        id: p.id,
        binIndex: bins.length - 1,
        x: pos.x + board.cleanMargin,
        y: pos.y + board.cleanMargin,
        w: rotated ? p.h : p.w,
        h: rotated ? p.w : p.h,
        rotated
      });
    } else {
      unplaced.push(p);
    }
  }

  return { bins, placed, unplaced };
}
