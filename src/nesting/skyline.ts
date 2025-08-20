// src/nesting/skyline.ts
import { Rect } from "./rect";

export interface SLPlacement { rect: Rect; rotated: boolean; }

export function skylinePack(sheet: Rect, items: { w: number; h: number }[]): SLPlacement[] {
  const result: SLPlacement[] = new Array(items.length) as any;
  const skyline: { x: number; y: number; w: number }[] = [{ x: sheet.x, y: sheet.y, w: sheet.w }];

  for (let i = 0; i < items.length; i++) {
    let best: { y: number; x: number; rotated: boolean } | null = null;
    let place: Rect | null = null;

    for (const seg of skyline) {
      const y = seg.y, x = seg.x;

      // regular
      if (items[i].w <= seg.w && y + items[i].h <= sheet.y + sheet.h) {
        if (!best || y < best.y || (y === best.y && x < best.x)) {
          best = { y, x, rotated: false };
          place = { x, y, w: items[i].w, h: items[i].h };
        }
      }
      // rotated
      if (items[i].h <= seg.w && y + items[i].w <= sheet.y + sheet.h) {
        if (!best || y < best.y || (y === best.y && x < best.x)) {
          best = { y, x, rotated: true };
          place = { x, y, w: items[i].h, h: items[i].w };
        }
      }
    }

    if (!best || !place) { result[i] = { rect: { x: 0, y: 0, w: 0, h: 0 }, rotated: false }; continue; }
    result[i] = { rect: place, rotated: best.rotated };

    // naive skyline advance
    skyline.push({
      x: place.x + place.w,
      y: place.y,
      w: (sheet.x + sheet.w) - (place.x + place.w)
    });
  }

  return result;
}
