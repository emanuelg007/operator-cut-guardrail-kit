// src/nesting/engine.ts
import { maxRectsPack, type MRHeuristic } from "./maxRects";
import { skylinePack } from "./skyline";
import type {
  BoardSpec,
  NestablePart,
  SheetLayout,
  PackResultByMaterial,
  Grain,
} from "./types";
import type { Rect } from "./rect";

export interface PackOptions {
  /** kerf in mm; if undefined we default to 3 */
  kerf?: number;
  /** outer margin in mm; if undefined we default to 10 */
  margin?: number;
  /** if a part has no explicit canRotate, use this default (true) */
  allowRotateDefault?: boolean;
  heuristic?: MRHeuristic;
  /** global grain policy (rarely needed; parts/boards carry their own) */
  grain?: Grain;
  /** if true, allow rotation when material permits (default true) */
  materialRotate?: boolean;
  /** safety cap per material to avoid runaway */
  maxSheetsPerMaterial?: number;
  /** soft “quality guard”: if MaxRects places < threshold, try Skyline */
  fallbackThreshold?: number;
}

/* ------------------------------ helpers ---------------------------------- */

const lc = (s: any) => String(s ?? "").trim().toLowerCase();
const matOfPart = (p: NestablePart) => lc(p.materialTag ?? p.material);
const matOfBoard = (b: BoardSpec) => lc(b.materialTag);

/** returns "X" if grain runs along X (width) so rotation is locked, "Y" if along Y (length), null if free */
const rotationLockFor = (p: NestablePart): "X" | "Y" | null => {
  const g: Grain = (p as NestablePart & { grain?: Grain }).grain ?? "none";
  if (g === "alongX") return "X";
  if (g === "alongY") return "Y";
  return null;
};

/* ---------------------------- main function ------------------------------- */

export function packPartsToSheets(
  boards: BoardSpec[],
  parts: NestablePart[],
  opts: PackOptions = {}
): PackResultByMaterial {
  // use only values provided in opts; do not import settings here
  const kerfGlobal = opts.kerf ?? 3;
  const marginGlobal = opts.margin ?? 10;
  const allowRotateDefault = opts.allowRotateDefault ?? true;
  const maxSheetsPerMaterial = Math.max(1, opts.maxSheetsPerMaterial ?? 999);
  const fallbackThreshold = Math.min(1, Math.max(0, opts.fallbackThreshold ?? 0.65));
  const heuristic: MRHeuristic = opts.heuristic ?? "BSSF";

  // explode qty → “demand” list
  const demand: NestablePart[] = [];
  for (const p of parts) {
    const qty = Math.max(0, Math.trunc(p.qty ?? 0));
    for (let i = 0; i < qty; i++) demand.push({ ...p, qty: 1 });
  }

  // sort by area desc, then max side desc
  demand.sort(
    (a, b) => b.w * b.h - a.w * a.h || Math.max(b.w, b.h) - Math.max(a.w, a.h)
  );

  // replicate boards per material by copies
  const boardsByMat = new Map<string, BoardSpec[]>();
  for (const b of boards) {
    const m = matOfBoard(b);
    const arr = boardsByMat.get(m) ?? [];
    const copies =
      b.copies === "infinite"
        ? Number.MAX_SAFE_INTEGER
        : Math.max(0, b.copies ?? 1);
    for (let i = 0; i < copies; i++) arr.push(b);
    boardsByMat.set(m, arr);
  }

  // union of all materials seen in parts and boards
  const mats = new Set<string>();
  for (const p of demand) mats.add(matOfPart(p));
  for (const [m] of boardsByMat) mats.add(m);

  const byMaterial: Record<string, SheetLayout[]> = {};
  const unplaced: NestablePart[] = [];

  for (const m of mats) {
    const matParts = demand.filter((p) => matOfPart(p) === m);
    if (!matParts.length) continue;

    const matBoards = boardsByMat.get(m) ?? [];
    if (!matBoards.length) {
      // nothing to place them on
      unplaced.push(...matParts);
      continue;
    }

    const layouts: SheetLayout[] = [];

    // remaining counts per unique key
    const remaining = new Map<string, { p: NestablePart; left: number }>();
    const keyOf = (p: NestablePart) =>
      p.id ?? `${p.name ?? ""}:${p.w}x${p.h}:${p.materialTag ?? p.material ?? ""}`;
    for (const p of matParts) {
      const k = keyOf(p);
      const rec = remaining.get(k);
      if (rec) rec.left += 1;
      else remaining.set(k, { p, left: 1 });
    }

    for (
      let copyIdx = 0;
      copyIdx < matBoards.length && copyIdx < maxSheetsPerMaterial;
      copyIdx++
    ) {
      // anything left to place?
      let anyLeft = false;
      for (const r of remaining.values()) {
        if (r.left > 0) {
          anyLeft = true;
          break;
        }
      }
      if (!anyLeft) break;

      const board = matBoards[copyIdx];

      // per-board overrides if present
      const margin = (board.margin ?? marginGlobal) || 0;
      const kerf = (board.kerf ?? kerfGlobal) || 0;

      // working rect excludes outer margins
      const W = Math.max(0, (board.width ?? 0) - 2 * margin);
      const H = Math.max(0, (board.height ?? 0) - 2 * margin);
      const sheet: Rect = { x: 0, y: 0, w: W, h: H };

      // build items list
      type Item = {
        k: string;
        w: number;
        h: number;
        allowRotate: boolean;
        src: NestablePart;
      };
      const items: Item[] = [];
      for (const { p, left } of remaining.values()) {
        if (left <= 0) continue;
        const lock = rotationLockFor(p);
        const canRotateFlag =
          (p.canRotate ?? allowRotateDefault) && lock === null;
        // inflate with kerf as spacing proxy
        items.push({
          k: keyOf(p),
          w: p.w + kerf,
          h: p.h + kerf,
          allowRotate: canRotateFlag,
          src: p,
        });
      }
      if (!items.length) break;

      // run MaxRects, maybe fallback to Skyline
      const mr = maxRectsPack(
        sheet,
        items.map((it) => ({ w: it.w, h: it.h })),
        heuristic
      );
      const mrPlaced = countPlaced(mr);

      let chosen = mr;
      if (fallbackThreshold > 0) {
        const density = mrPlaced / items.length;
        if (density < fallbackThreshold) {
          const sl = skylinePack(
            sheet,
            items.map((it) => ({ w: it.w, h: it.h }))
          );
          const slPlaced = countPlaced(sl);
          if (slPlaced >= mrPlaced) chosen = sl;
        }
      }

      // translate back to original dims and reduce remaining
      const placed: SheetLayout["placed"] = [];
      for (let i = 0; i < chosen.length; i++) {
        const plc = chosen[i];
        if (!plc || plc.rect.w === 0 || plc.rect.h === 0) continue;

        const it = items[i];
        if (plc.rotated && !it.allowRotate) continue;

        const rec = remaining.get(it.k);
        if (!rec || rec.left <= 0) continue;

        rec.left -= 1;

        placed.push({
          id: it.src.id,
          name: it.src.name,
          x: plc.rect.x + margin,
          y: plc.rect.y + margin,
          // use original part size (without kerf inflation)
          w: it.src.w,
          h: it.src.h,
          rotated: plc.rotated,
          material: it.src.materialTag ?? it.src.material,
          boardIdx: copyIdx,
        } as SheetLayout["placed"][number]);
      }

      if (placed.length) {
        layouts.push({
          boardId: board.id,
          boardIdx: copyIdx,
          width: board.width,
          height: board.height,
          placed,
        });
      }
    }

    // collect leftovers
    for (const rec of remaining.values()) {
      for (let i = 0; i < rec.left; i++) unplaced.push(rec.p);
    }

    byMaterial[m || ""] = layouts;
  }

  return { byMaterial, unplaced };
}

/* -------------------------------- utils ----------------------------------- */

function countPlaced(arr: Array<{ rect: Rect } | undefined>): number {
  let n = 0;
  for (const a of arr) if (a && a.rect.w > 0 && a.rect.h > 0) n++;
  return n;
}
