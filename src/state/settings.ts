// src/state/settings.ts
import { emit, Events } from "../events";

export type Units = "mm" | "in";
export type PrinterMode = "browser" | "zebra";

export interface FontPreset {
  family: string;
  size: number;      // px for UI/SVG; pt for print CSS (passed through)
  color?: string;    // CSS color
}

export interface PrinterSettings {
  mode: PrinterMode;
  labelWidthMM: number;
  labelHeightMM: number;
  zebraDPI: number;
  includeQR: boolean;
  includeBarcode: boolean;
}

/** SVG look & feel, configurable via settings UI */
export interface SvgStyleSettings {
  boardStroke: string;
  boardStrokeWidth: number;
  boardFill: string;

  partStroke: string;
  partStrokeWidth: number;
  partFill: string;          // unprinted
  partPrintedFill: string;   // printed

  labelColor: string;        // component name color
  dimColor: string;          // dimension text color

  cutLineColor: string;      // dashed “toolpath” look
  cutLineWidth: number;

  showTooltips: boolean;
  touchTargetPadding: number; // px of extra aura when tapping parts
}

export interface Settings {
  // core
  units: Units;
  kerf: number;
  margin: number;
  showLabels: boolean;
  showDims: boolean;

  // fonts
  uiFont: FontPreset;
  svgFont: FontPreset;
  printFont: FontPreset;

  // printers
  printer: PrinterSettings;

  // svg visuals
  svgStyle: SvgStyleSettings;
}

const DEFAULTS: Settings = {
  units: "mm",
  kerf: 3,
  margin: 10,
  showLabels: true,
  showDims: true,

  uiFont:   { family: "Inter, system-ui, sans-serif", size: 14, color: "#111827" },
  svgFont:  { family: "Inter, system-ui, sans-serif", size: 12, color: "#0f172a" },
  printFont:{ family: "Inter, system-ui, sans-serif", size: 12, color: "#000000" },

  printer: {
    mode: "browser",
    labelWidthMM: 100,
    labelHeightMM: 50,
    zebraDPI: 203,
    includeQR: false,
    includeBarcode: false,
  },

  svgStyle: {
    boardStroke: "#1f2937",
    boardStrokeWidth: 2,
    boardFill: "#ffffff",

    partStroke: "#111827",
    partStrokeWidth: 2.5,
    partFill: "#e5e7eb",
    partPrintedFill: "#2563eb",

    labelColor: "#0f172a",
    dimColor: "#334155",

    cutLineColor: "#ef4444",
    cutLineWidth: 2,

    showTooltips: true,
    touchTargetPadding: 4,
  },
};

let current: Settings = load();

function load(): Settings {
  try {
    const saved = JSON.parse(localStorage.getItem("oc:settings") || "null") || {};
    return {
      ...DEFAULTS,
      ...saved,
      uiFont:   { ...DEFAULTS.uiFont,    ...(saved.uiFont    || {}) },
      svgFont:  { ...DEFAULTS.svgFont,   ...(saved.svgFont   || {}) },
      printFont:{ ...DEFAULTS.printFont, ...(saved.printFont || {}) },
      printer:  { ...DEFAULTS.printer,   ...(saved.printer   || {}) },
      svgStyle: { ...DEFAULTS.svgStyle,  ...(saved.svgStyle  || {}) },
    };
  } catch {
    return DEFAULTS;
  }
}

function save() {
  try { localStorage.setItem("oc:settings", JSON.stringify(current)); } catch {}
}

export function getSettings(): Settings {
  return current;
}

export function setSettings(patch: Partial<Settings>) {
  current = {
    ...current,
    ...patch,
    uiFont:   { ...current.uiFont,    ...(patch.uiFont    || {}) },
    svgFont:  { ...current.svgFont,   ...(patch.svgFont   || {}) },
    printFont:{ ...current.printFont, ...(patch.printFont || {}) },
    printer:  { ...current.printer,   ...(patch.printer   || {}) },
    svgStyle: { ...current.svgStyle,  ...(patch.svgStyle  || {}) },
  };
  save();
  // no payload to avoid import cycle
  emit(Events.SETTINGS_UPDATED);
}

export function getKerfMM(): number { return current.kerf; }
export function getMarginMM(): number { return current.margin; }
