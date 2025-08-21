// src/nesting/types.ts — v1.0 FROZEN

export type Grain = "none" | "alongX" | "alongY";

export interface BoardSpec {
  id?: string;
  name?: string;
  width: number;
  height: number;
  copies?: number | "infinite";
  materialTag: string;
  grain?: Grain;
}

export interface NestablePart {
  id?: string;
  name?: string;
  w: number;
  h: number;
  qty?: number;
  canRotate?: boolean;
  material?: string;
  materialTag?: string;
  grain?: Grain;
}

export interface PlacedPart {
  id?: string;
  name?: string;
  x: number; y: number; w: number; h: number;
  rotated?: boolean;
  rotation?: 0 | 90 | 180 | 270 | number;
  material?: string;
  boardIdx?: number;
}

export interface SheetLayout {
  boardId?: string;
  boardIdx: number;
  width: number; height: number;
  placed: PlacedPart[];
}

export interface PackResultByMaterial {
  byMaterial: Record<string, SheetLayout[]>;
  unplaced: NestablePart[];
}

export interface PackResultFlat {
  sheets: SheetLayout[];
  unplaced: NestablePart[];
}

export type PackResult = PackResultByMaterial | PackResultFlat;

export function hasByMaterial(x: PackResult): x is PackResultByMaterial {
  return (x as PackResultByMaterial).byMaterial !== undefined;
}
export function hasSheets(x: PackResult): x is PackResultFlat {
  return (x as PackResultFlat).sheets !== undefined;
}
