export type Grain = "none" | "alongX" | "alongY";

export interface NestablePart {
  id: string;
  name?: string;
  w: number; // mm
  h: number; // mm
  canRotate: boolean;
  grain: Grain; // rotation must honor this
  qty: number;
  materialTag?: string;
}

export interface BoardSpec {
  id: string;
  width: number;  // mm
  height: number; // mm
  copies: number | "infinite";
  materialTag?: string;
}

export interface PlacedPart {
  id: string;
  name?: string;
  x: number; // mm (actual drawable origin after kerf centering)
  y: number; // mm
  w: number; // mm (actual drawable size, kerf already “removed”)
  h: number; // mm
  rotation: 0 | 90;
  boardIdx: number; // which sheet index of the source board id
}

export interface WasteRect { x: number; y: number; w: number; h: number; }

export interface SheetLayout {
  boardId: string;
  boardIdx: number; // 0..copies-1
  width: number; height: number;
  placed: PlacedPart[];
  waste: WasteRect[];
}

export interface PackResult {
  sheets: SheetLayout[];
  unplaced: { part: NestablePart; count: number }[];
}
