export function format() {/* stub */}

/* -------------------------------------------------------------------------- *
 * App-level formatting helpers
 * -------------------------------------------------------------------------- */
import { parseNumberLike } from "./num";
import { formatLenWithSettings } from "./units";

/** Clamp number to [min, max]. */
export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** Human-ish quantity formatting (integers preferred). */
export function formatQty(n: number | string): string {
  const v = typeof n === "number" ? n : parseNumberLike(n);
  if (!isFinite(v)) return "—";
  const rounded = Math.round(v);
  const useInt = Math.abs(v - rounded) < 1e-9;
  return (useInt ? rounded : +v.toFixed(2)).toLocaleString();
}

/** Title Case for labels / material names. */
export function titleCase(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/[-_]+/g, " ")
    .replace(/\b([a-z])/g, (_, c: string) => c.toUpperCase());
}

/** Format a size (w × h) where inputs are in millimeters. */
export function formatSize(wMM: number, hMM: number, opts?: { sep?: string; suffix?: boolean }) {
  const sep = opts?.sep ?? " × ";
  const w = formatLenWithSettings(wMM, { suffix: !!opts?.suffix });
  const h = formatLenWithSettings(hMM, { suffix: !!opts?.suffix });
  return `${w}${sep}${h}`;
}

/** Safe numeric parsing adapter (delegates to parseNumberLike). */
export function parseQty(input: unknown, fallback = 0): number {
  const n = parseNumberLike(input as any);
  return Number.isFinite(n) ? n : fallback;
}
