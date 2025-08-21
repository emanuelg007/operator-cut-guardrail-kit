// src/nesting/engine.ts
import { getKerfMM, getMarginMM } from "../state/settings";
import { maxRectsPack, type MRHeuristic } from "./maxRects";
import { skylinePack } from "./skyline";
import type { BoardSpec, NestablePart, SheetLayout, PackResultByMaterial, Grain } from "./types";
import type { Rect } from "./rect";

export interface PackOptions {
  kerf?: number;
  margin?: number;
  allowRotateDefault?: boolean;
  heuristic?: MRHeuristic;
  grain?: Grain;
  materialRotate?: boolean;
  maxSheetsPerMaterial?: number;
  budgetMs?: number;
  seed?: number;
  fallbackThreshold?: number;
}

const lc = (s:any)=> String(s ?? "").trim().toLowerCase();
const matOfPart = (p:NestablePart)=> lc(p.materialTag ?? p.material);
const matOfBoard = (b:BoardSpec)=> lc(b.materialTag);
const rotationLockFor = (p: NestablePart): "X"|"Y"|null => {
  const g = p.grain ?? "none";
  if (g === "alongX") return "X"; if (g === "alongY") return "Y"; return null;
};

export function packPartsToSheets(
  boards: BoardSpec[], parts: NestablePart[], opts: PackOptions = {}
): PackResultByMaterial {
  const kerf = opts.kerf ?? getKerfMM();
  const margin = opts.margin ?? getMarginMM();
  const allowRotateDefault = opts.allowRotateDefault ?? true;
  const maxSheetsPerMaterial = Math.max(1, opts.maxSheetsPerMaterial ?? 999);
  const fallbackThreshold = Math.min(1, Math.max(0, opts.fallbackThreshold ?? 0.65));
  const heuristic: MRHeuristic = opts.heuristic ?? "BSSF";

  const demand: NestablePart[] = [];
  for (const p of parts) {
    const qty = Math.max(0, Math.trunc(p.qty ?? 0));
    for (let i=0;i<qty;i++) demand.push({ ...p, qty:1 });
  }
  demand.sort((a,b)=> (b.w*b.h - a.w*a.h) || Math.max(b.w,b.h)-Math.max(a.w,a.h));

  const boardsByMat = new Map<string, BoardSpec[]>();
  for (const b of boards) {
    const m = matOfBoard(b);
    const arr = boardsByMat.get(m) ?? [];
    const copies = b.copies === "infinite" ? Number.MAX_SAFE_INTEGER : Math.max(0, b.copies ?? 1);
    for (let i=0;i<copies;i++) arr.push(b);
    boardsByMat.set(m, arr);
  }

  const mats = new Set<string>();
  for (const p of demand) mats.add(matOfPart(p));
  for (const [m] of boardsByMat) mats.add(m);

  const byMaterial: Record<string, SheetLayout[]> = {};
  const unplaced: NestablePart[] = [];

  for (const m of mats) {
    const matParts = demand.filter(p => matOfPart(p) === m);
    if (!matParts.length) continue;

    const matBoards = boardsByMat.get(m) ?? [];
    if (!matBoards.length) { unplaced.push(...matParts); continue; }

    const layouts: SheetLayout[] = [];
    const remaining = new Map<string, { p:NestablePart; left:number }>();
    const keyOf = (p:NestablePart)=> (p.id ?? `${p.name}:${p.w}x${p.h}`);
    for (const p of matParts) {
      const k = keyOf(p);
      const rec = remaining.get(k);
      if (rec) rec.left += 1; else remaining.set(k, { p, left: 1 });
    }

    for (let copyIdx = 0; copyIdx < matBoards.length && copyIdx < maxSheetsPerMaterial; copyIdx++) {
      let anyLeft = false; for (const r of remaining.values()) if (r.left>0){ anyLeft=true; break; }
      if (!anyLeft) break;

      const board = matBoards[copyIdx];
      const W = Math.max(0, (board.width ?? 0) - 2 * margin);
      const H = Math.max(0, (board.height ?? 0) - 2 * margin);
      const sheet: Rect = { x:0, y:0, w:W, h:H };

      type Item = { k:string; w:number; h:number; allowRotate:boolean; src:NestablePart };
      const items: Item[] = [];
      for (const { p, left } of remaining.values()) {
        if (left <= 0) continue;
        const lock = rotationLockFor(p);
        const allowRotate = (p.canRotate ?? allowRotateDefault) && lock === null;
        items.push({ k: keyOf(p), w: p.w + kerf, h: p.h + kerf, allowRotate, src: p });
      }
      if (!items.length) break;

      const mr = maxRectsPack(sheet, items.map(it => ({ w: it.w, h: it.h })), heuristic);
      const mrPlaced = countPlaced(mr);

      let chosen = mr;
      if (fallbackThreshold > 0) {
        const density = mrPlaced / items.length;
        if (density < fallbackThreshold) {
          const sl = skylinePack(sheet, items.map(it => ({ w: it.w, h: it.h })));
          const slPlaced = countPlaced(sl);
          if (slPlaced >= mrPlaced) chosen = sl;
        }
      }

      const placed: SheetLayout["placed"] = [];
      for (let i=0;i<chosen.length;i++) {
        const plc = chosen[i]; if (!plc || plc.rect.w===0 || plc.rect.h===0) continue;
        const it = items[i]; if (plc.rotated && !it.allowRotate) continue;
        const rec = remaining.get(it.k); if (!rec || rec.left<=0) continue;
        rec.left -= 1;
        placed.push({
          id: it.src.id, name: it.src.name,
          x: plc.rect.x + margin, y: plc.rect.y + margin,
          w: it.src.w, h: it.src.h,
          rotated: plc.rotated, rotation: plc.rotated ? 90 : 0,
          material: it.src.materialTag ?? it.src.material,
          boardIdx: copyIdx,
        });
      }
      if (placed.length) {
        layouts.push({
          boardId: board.id, boardIdx: copyIdx, width: board.width, height: board.height, placed,
        });
      }
    }

    for (const rec of remaining.values()) for (let i=0;i<rec.left;i++) unplaced.push(rec.p);
    byMaterial[m || ""] = layouts;
  }

  return { byMaterial, unplaced };
}

function countPlaced(arr: Array<{ rect: Rect } | undefined>): number {
  let n=0; for (const a of arr) if (a && a.rect.w>0 && a.rect.h>0) n++; return n;
}
