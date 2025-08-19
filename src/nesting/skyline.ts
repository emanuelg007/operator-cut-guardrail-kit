import { Rect } from "./rect";

export interface SLPlacement { rect: Rect; rotated: boolean; }

export function skylinePack(
  sheet: Rect,
  items: { w: number; h: number; allowRotate: boolean }[],
): (SLPlacement | null)[] {
  const skyline: { x: number; y: number; w: number }[] = [{ x: sheet.x, y: sheet.y, w: sheet.w }];
  const result: (SLPlacement | null)[] = new Array(items.length).fill(null);

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    let best: { y: number; x: number; rotated: boolean } | null = null;

    for (let s = 0; s < skyline.length; s++) {
      const node = skyline[s];
      tryPlace(node, it.w, it.h, false);
      if (it.allowRotate) tryPlace(node, it.h, it.w, true);
    }

    if (!best) continue;

    const rect = { x: best.x, y: best.y, w: best.rotated ? items[i].h : items[i].w, h: best.rotated ? items[i].w : items[i].h };
    result[i] = { rect, rotated: best.rotated };
    carve(rect);
  }
  return result;

  function tryPlace(node: { x: number; y: number; w: number }, w: number, h: number, rotated: boolean) {
    if (w > node.w) return;
    if (node.y + h > sheet.y + sheet.h) return;
    const y = node.y, x = node.x;
    if (!best || y < best.y || (y === best.y && x < best.x)) best = { y, x, rotated };
  }

  function carve(r: Rect) {
    let i = 0;
    while (i < skyline.length) {
      const node = skyline[i];
      const nx1 = node.x, nx2 = node.x + node.w;
      const rx1 = r.x, rx2 = r.x + r.w;

      if (nx2 <= rx1 || nx1 >= rx2) { i++; continue; }

      if (nx1 < rx1 && nx2 > rx2) {
        const left = { x: nx1, y: node.y, w: rx1 - nx1 };
        const right = { x: rx2, y: node.y, w: nx2 - rx2 };
        skyline.splice(i, 1, left, right);
        i += 2;
      } else if (nx1 < rx1) {
        skyline[i].w = rx1 - nx1; i++;
      } else if (nx2 > rx2) {
        skyline[i].x = rx2; skyline[i].w = nx2 - rx2; i++;
      } else {
        skyline.splice(i, 1);
      }
    }
    skyline.push({ x: r.x, y: r.y + r.h, w: r.w });
    skyline.sort((a, b) => a.x - b.x);
    let j = 0;
    while (j < skyline.length - 1) {
      if (skyline[j].y === skyline[j + 1].y) {
        skyline[j].w += skyline[j + 1].w;
        skyline.splice(j + 1, 1);
      } else j++;
    }
  }
}
