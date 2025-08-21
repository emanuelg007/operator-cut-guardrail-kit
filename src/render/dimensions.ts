// src/render/dimensions.ts
import type { Units } from "../state/settings";
export function fmtLen(mm: number, units: Units): string {
  if (units === "mm") return `${mm.toFixed(0)} mm`;
  const inches = mm / 25.4;
  return `${inches.toFixed(2)} in`;
}
