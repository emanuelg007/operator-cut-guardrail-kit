// src/nesting/types.ts

/** Which way grain runs.
 *  Engine uses: "none" | "alongX" | "alongY"
 */
export type Grain = "none" | "alongX" | "alongY";

/** One available board/sheet to cut on. */
export interface BoardSpec {
  id?: string;
  name?: string;
  /** Board width (X) in same unit system as parts (typically mm). */
  width: number;
  /** Board height (Y). */
  height: number;
  /** Optional thickness metadata. */
  thickness?: number;
  /** Material tag used to match parts (case-insensitive compare in code). */
  materialTag?: string;
  /** Preferred grain direction, if relevant. */
  grain?: Grain;
  /** Number of copies, or the string "infinite". */
  copies?: number | "infinite";
  /** Optional per-board kerf/margin overrides. */
  kerf?: number;
  margin?: number;
  /** Units for display/reference. */
  units?: "mm" | "cm" | "in";
}

/** A part that can be nested. */
export interface NestablePart {
  id: string;
  name?: string;
  /** width/height; engine may rotate by 90° based on rules. */
  w: number;
  h: number;
  /** material tag to match a board (same semantics as BoardSpec.materialTag). */
  material?: string;
  /** some code uses materialTag on parts; keep both to be safe */
  materialTag?: string;
  /** can the part be rotated 90° */
  canRotate: boolean;
  /** grain constraint for the part */
  grain?: Grain;
  /** quantity (engine code assumes a number) */
  qty: number;
  /** arbitrary notes/metadata */
  note1?: string;
  note2?: string;
}

/** A placed part on a sheet layout result. */
export interface PlacedPart {
  id?: string;
  name?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotated?: boolean;
  material?: string;
  /** some engines annotate rotation degrees */
  rotation?: number;
  /** some engines annotate which board copy index was used */
  boardIdx?: number;
}

/** One rendered layout for a single board instance. */
export interface SheetLayout {
  boardId?: string;
  boardIdx?: number;
  width: number;
  height: number;
  placed: PlacedPart[];
  /** Optional waste polygons/rects if the engine provides them. */
  waste?: any[];
}

/** Two common packer result shapes we support. */
export interface PackResultByMaterial {
  byMaterial: Record<string, SheetLayout[]>;
  unplaced?: any[];
}
export interface PackResultFlat {
  sheets: SheetLayout[];
  unplaced?: any[];
}

export type PackResult = PackResultByMaterial | PackResultFlat;

/** Type guards */
export function hasByMaterial(x: any): x is PackResultByMaterial {
  return x && typeof x === "object" && x.byMaterial && typeof x.byMaterial === "object";
}
export function hasSheets(x: any): x is PackResultFlat {
  return x && typeof x === "object" && Array.isArray(x.sheets);
}
