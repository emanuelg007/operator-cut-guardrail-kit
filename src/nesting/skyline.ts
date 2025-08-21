// src/nesting/skyline.ts
import type { Rect } from "./rect";
export interface SLPlacement { rect: Rect; rotated: boolean; }
interface Node { x: number; y: number; w: number; }

export function skylinePack(sheet: Rect, items: { w: number; h: number }[]): SLPlacement[] {
  const result: SLPlacement[] = new Array(items.length) as any;
  let skyline: Node[] = [{ x: 0, y: 0, w: sheet.w }];

  for (let i = 0; i < items.length; i++) {
    const cand1 = findPosition(skyline, sheet, items[i].w, items[i].h);
    const cand2 = findPosition(skyline, sheet, items[i].h, items[i].w, true);
    const chosen = pickBetter(cand1, cand2);
    if (!chosen) { result[i] = { rect: { x:0,y:0,w:0,h:0 }, rotated:false }; continue; }
    placeSkyline(skyline, chosen.rect);
    result[i] = { rect: chosen.rect, rotated: chosen.rotated };
    normalizeSkyline(skyline);
  }
  return result;
}

function findPosition(skyline: Node[], sheet: Rect, w: number, h: number, rotated=false) {
  let best: { rect: Rect; rotated: boolean; score: number } | null = null;
  for (let i = 0; i < skyline.length; i++) {
    const x = skyline[i].x;
    if (x + w > sheet.w) continue;
    const y = calcYAt(skyline, i, w);
    if (y + h > sheet.h) continue;
    const score = y * 1_000_000 + x;
    const rect: Rect = { x, y, w, h };
    if (!best || score < best.score) best = { rect, rotated, score };
  }
  return best;
}
function pickBetter(a:any,b:any){ if(a&&b) return a.score<=b.score?a:b; return a||b; }
function calcYAt(skyline: Node[], startIdx: number, w: number): number {
  let x = skyline[startIdx].x;
  let y = skyline[startIdx].y;
  let widthLeft = w;
  let idx = startIdx;
  if (skyline[idx].w < widthLeft) {
    y = Math.max(y, skyline[idx].y);
    widthLeft -= skyline[idx].w;
    x += skyline[idx].w;
    idx++;
    while (widthLeft > 0 && idx < skyline.length) {
      y = Math.max(y, skyline[idx].y);
      if (skyline[idx].w >= widthLeft) break;
      widthLeft -= skyline[idx].w;
      x += skyline[idx].w;
      idx++;
    }
  }
  return y;
}
function placeSkyline(skyline: Node[], rect: Rect) {
  const endX = rect.x + rect.w;
  for (let i = 0; i < skyline.length; i++) {
    const node = skyline[i];
    const nodeEnd = node.x + node.w;
    if (nodeEnd <= rect.x || node.x >= endX) continue;
    const leftOverlap = Math.max(0, rect.x - node.x);
    const rightOverlap = Math.max(0, nodeEnd - endX);
    const newNodes: Node[] = [];
    if (leftOverlap > 0) newNodes.push({ x: node.x, y: node.y, w: leftOverlap });
    newNodes.push({ x: Math.max(rect.x, node.x), y: rect.y + rect.h, w: Math.min(endX, nodeEnd) - Math.max(rect.x, node.x) });
    if (rightOverlap > 0) newNodes.push({ x: endX, y: node.y, w: rightOverlap });
    skyline.splice(i, 1, ...newNodes);
    i += newNodes.length - 1;
  }
}
function normalizeSkyline(skyline: Node[]) {
  skyline.sort((a, b) => a.x - b.x);
  for (let i = 1; i < skyline.length; i++) {
    const prev = skyline[i - 1], cur = skyline[i];
    if (prev.y === cur.y && prev.x + prev.w === cur.x) {
      prev.w += cur.w; skyline.splice(i, 1); i--;
    }
  }
}
