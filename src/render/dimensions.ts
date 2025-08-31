// Rendering dimension helpers
import { formatLen, type Unit } from "../utils/units";
export function fmtLen(mm: number, units: Unit): string {
  return formatLen(mm, units);
}
