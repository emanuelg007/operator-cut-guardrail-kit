// src/state/settings.ts
import { emit, Events } from "../events";

export interface Settings {
  kerf: number;   // in mm
  margin: number; // in mm
  units?: "mm" | "cm" | "in";
}

let current: Settings = { kerf: 0, margin: 0, units: "mm" };

export function getSettings(): Settings { return current; }

export function setSettings(p: Partial<Settings>) {
  current = { ...current, ...p };
  emit(Events.SETTINGS_UPDATED, getSettings());
}

/** Helpers expected by the engine */
export function getKerfMM(): number { return current.kerf ?? 0; }
export function getMarginMM(): number { return current.margin ?? 0; }
