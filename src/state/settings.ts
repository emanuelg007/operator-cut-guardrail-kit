// Minimal settings store (units, kerf, margin) with conversions
import { emit, Events } from "../events";

export type Units = "mm" | "cm" | "in";
export interface Settings {
  units: Units;
  kerf: number;   // in current units
  margin: number; // in current units
}

let settings: Settings = {
  units: "mm",
  kerf: 3,
  margin: 8,
};

export function getSettings(): Settings {
  return { ...settings };
}

export function setSettings(next: Partial<Settings>): void {
  settings = { ...settings, ...next };
  emit<Settings>(Events.SETTINGS_UPDATED, getSettings());
}

// helpers
const IN_PER_MM = 0.03937007874;
export function toMM(value: number, from: Units): number {
  if (from === "mm") return value;
  if (from === "cm") return value * 10;
  // inches
  return value / IN_PER_MM;
}

export function fromMM(valueMM: number, to: Units): number {
  if (to === "mm") return valueMM;
  if (to === "cm") return valueMM / 10;
  return valueMM * IN_PER_MM;
}

// Read kerf/margin in mm for the engine
export function getKerfMM(): number {
  const s = getSettings();
  return toMM(s.kerf, s.units);
}
export function getMarginMM(): number {
  const s = getSettings();
  return toMM(s.margin, s.units);
}
