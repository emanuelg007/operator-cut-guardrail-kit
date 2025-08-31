/* -------------------------------------------------------------------------- *
 * Units & formatting utilities (pure-first, then thin settings adapters)
 * -------------------------------------------------------------------------- */
import { getSettings } from "../state/settings";

export type Unit = "mm" | "in";
const MM_PER_IN = 25.4;

/** Pure converters */
export const mmToIn = (mm: number): number => mm / MM_PER_IN;
export const inToMm = (inch: number): number => inch * MM_PER_IN;

/** Convert a millimeter value to target unit, purely. */
export function toUnits(mmValue: number, unit: Unit): number {
  return unit === "in" ? mmToIn(mmValue) : mmValue;
}

/** Convert a value in a given unit to millimeters, purely. */
export function fromUnits(value: number, unit: Unit): number {
  return unit === "in" ? inToMm(value) : value;
}

/** Round a length to a sensible number of decimals for a given unit. */
export function roundLen(value: number, unit: Unit, decimals?: number): number {
  const d = decimals ?? (unit === "in" ? 3 : 1);
  const p = 10 ** d;
  return Math.round(value * p) / p;
}

/** Format a length given in mm into a target unit (pure). */
export function formatLen(
  mmValue: number,
  unit: Unit,
  opts?: { decimals?: number; suffix?: boolean }
): string {
  const n = roundLen(toUnits(mmValue, unit), unit, opts?.decimals);
  const s = String(n);
  return opts?.suffix ? `${s} ${unit}` : s;
}

/** Adapter that reads the current unit from settings. */
export function formatLenWithSettings(
  mmValue: number,
  opts?: { decimals?: number; suffix?: boolean }
): string {
  const u = getSettings().units as Unit;
  return formatLen(mmValue, u, opts);
}

/** Format area from mm² into current unit’s squared (mm² or in²), purely controlled. */
export function formatArea(
  mm2: number,
  unit: Unit,
  opts?: { decimals?: number; suffix?: boolean }
): string {
  const factor = unit === "in" ? MM_PER_IN * MM_PER_IN : 1;
  const val = mm2 / factor;
  const d = opts?.decimals ?? (unit === "in" ? 4 : 0);
  const p = 10 ** d;
  const n = Math.round(val * p) / p;
  const s = String(n);
  return opts?.suffix ? `${s} ${unit}²` : s;
}

export function formatAreaWithSettings(
  mm2: number,
  opts?: { decimals?: number; suffix?: boolean }
): string {
  const u = getSettings().units as Unit;
  return formatArea(mm2, u, opts);
}
