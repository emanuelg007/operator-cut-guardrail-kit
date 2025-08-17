// src/nesting/packJob.ts
import { MaxRectsBin } from "./maxRects";

export interface PackerSettings {
  boardWidth: number;
  boardHeight: number;
  kerf: number;
  allowRotateByDefault?: boolean;
}

export interface PieceReq {
  w: number;      // width (mm)
  h: number;      // height (mm)
  allowRotate: boolean;
  ref: number;    // unique reference to your part
}

export interface Placement {
  binIndex: number;
  x: number;
  y: number;
  w: number;
  h: number;
  rotated: boolean;
  ref: number;
}

export interface PackedSheet {
  placements: Placement[];
  usedArea: number;
  wastedArea: number;
  width: number;
  height: number;
}

export interface PackedJob {
  sheets: PackedSheet[];
  unplacedRefs: number[];
}

export function packJob(pieces: PieceReq[], settings: PackerSettings): PackedJob {
  const sheets: PackedSheet[] = [];
  const unplacedRefs: number[] = [];

  // Always declare bins first (prevents "used before declaration")
  const bins: MaxRectsBin[] = [
    new MaxRectsBin(settings.boardWidth, settings.boardHeight, settings.kerf),
  ];

  const ensureSheet = (idx: number) => {
    if (!sheets[idx]) {
      sheets[idx] = {
        placements: [],
        usedArea: 0,
        wastedArea: 0,
        width: settings.boardWidth,
        height: settings.boardHeight,
      };
    }
  };

  for (const piece of pieces) {
    let placed: Placement | null = null;

    // Try existing bins
    for (let i = 0; i < bins.length && !placed; i++) {
      const bin = bins[i];

      // try normal
      const r1 = bin.insert(piece.w, piece.h, true);
      if (r1) {
        placed = { binIndex: i, x: r1.x, y: r1.y, w: piece.w, h: piece.h, rotated: false, ref: piece.ref };
        break;
      }

      // try rotated
      if (piece.allowRotate) {
        const r2 = bin.insert(piece.h, piece.w, true);
        if (r2) {
          placed = { binIndex: i, x: r2.x, y: r2.y, w: piece.h, h: piece.w, rotated: true, ref: piece.ref };
          break;
        }
      }
    }

    // If still not placed, open a new bin and try there
    if (!placed) {
      const newBin = new MaxRectsBin(settings.boardWidth, settings.boardHeight, settings.kerf);
      let r = newBin.insert(piece.w, piece.h, true);
      let rotated = false;

      if (!r && piece.allowRotate) {
        r = newBin.insert(piece.h, piece.w, true);
        rotated = !!r;
      }

      if (!r) {
        // too big even for a fresh board
        unplacedRefs.push(piece.ref);
        continue;
      }

      const newIndex = bins.length;
      bins.push(newBin);
      placed = {
        binIndex: newIndex,
        x: r.x,
        y: r.y,
        w: rotated ? piece.h : piece.w,
        h: rotated ? piece.w : piece.h,
        rotated,
        ref: piece.ref,
      };
    }

    // Record placement
    ensureSheet(placed.binIndex);
    const s = sheets[placed.binIndex];
    s.placements.push(placed);
    s.usedArea += placed.w * placed.h;
  }

  // Compute waste
  for (const s of sheets) {
    const area = s.width * s.height;
    s.wastedArea = Math.max(0, area - s.usedArea);
  }

  return { sheets, unplacedRefs };
}
