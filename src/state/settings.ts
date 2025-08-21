// src/state/settings.ts
import { emit, Events } from "../events";

export type Units = "mm" | "in";
export interface Settings {
  units: Units;
  kerf: number;
  margin: number;
  showLabels: boolean;
  showDims: boolean;
}
const DEFAULTS: Settings = { units: "mm", kerf: 3, margin: 10, showLabels: true, showDims: true };

let current: Settings = load();
function load(): Settings {
  try { return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem("oc:settings") || "null") || {}) }; }
  catch { return DEFAULTS; }
}
function save() { try { localStorage.setItem("oc:settings", JSON.stringify(current)); } catch {} }

export function getSettings(): Settings { return current; }
export function setSettings(patch: Partial<Settings>) {
  current = { ...current, ...patch }; save(); emit(Events.SETTINGS_UPDATED, current);
}
export function getKerfMM(): number { return current.kerf; }
export function getMarginMM(): number { return current.margin; }
