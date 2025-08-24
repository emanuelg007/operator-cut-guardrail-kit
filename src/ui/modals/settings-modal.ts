// src/ui/modals/settings-modal.ts
import { getSettings, setSettings } from "../../state/settings";
import { emit, Events } from "../../events";

/**
 * Settings modal (overlay). Reads current settings, renders a form,
 * and writes back with setSettings() on Save.
 *
 * Shape matches src/state/settings.ts:
 * {
 *   units, kerf, margin, showLabels, showDims,
 *   uiFont{family,size,color}, svgFont{...}, printFont{...},
 *   printer{ mode, labelWidthMM, labelHeightMM, zebraDPI, includeQR, includeBarcode }
 * }
 */

type Num = number | string | null | undefined;
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const num = (v: Num, def = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};

export function openSettingsModal(): void {
  // Clean any stale overlays
  document.querySelectorAll("#oc-settings-overlay").forEach(n => n.remove());

  const s = getSettings();

  const overlay = document.createElement("div");
  overlay.id = "oc-settings-overlay";
  overlay.style.position = "fixed";
  overlay.style.inset = "0";
  overlay.style.background = "rgba(0,0,0,0.40)";
  overlay.style.zIndex = "2147483646";
  overlay.style.display = "flex";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";

  const panel = document.createElement("div");
  panel.style.width = "min(920px, 96vw)";
  panel.style.maxHeight = "90vh";
  panel.style.overflow = "auto";
  panel.style.background = "#fff";
  panel.style.borderRadius = "12px";
  panel.style.boxShadow = "0 24px 60px rgba(0,0,0,0.35)";
  panel.style.padding = "16px 16px 12px 16px";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "true");

  const title = document.createElement("h2");
  title.textContent = "Settings";
  title.style.margin = "0 0 12px 0";

  const grid = document.createElement("div");
  grid.style.display = "grid";
  grid.style.gridTemplateColumns = "1fr 1fr";
  grid.style.gap = "12px";

  const section = (label: string) => {
    const card = document.createElement("div");
    card.style.border = "1px solid #e5e7eb";
    card.style.borderRadius = "10px";
    card.style.padding = "12px";
    const h = document.createElement("h3");
    h.textContent = label;
    h.style.margin = "0 0 8px 0";
    card.appendChild(h);
    return card;
  };

  const row = (label: string, input: HTMLElement) => {
    const wrap = document.createElement("label");
    wrap.style.display = "grid";
    wrap.style.gridTemplateColumns = "1fr auto";
    wrap.style.alignItems = "center";
    wrap.style.gap = "8px";
    wrap.style.margin = "6px 0";
    const span = document.createElement("span");
    span.textContent = label;
    wrap.append(span, input);
    return wrap;
  };

  const text = (v: string, ph = "") => {
    const i = document.createElement("input");
    i.type = "text";
    i.value = v ?? "";
    i.placeholder = ph;
    i.style.padding = "6px 8px";
    i.style.border = "1px solid #d1d5db";
    i.style.borderRadius = "8px";
    i.style.minWidth = "220px";
    return i;
  };
  const number = (v: Num, step = 1, min = 0) => {
    const i = document.createElement("input");
    i.type = "number";
    i.step = String(step);
    i.min = String(min);
    i.value = String(v ?? 0);
    i.style.padding = "6px 8px";
    i.style.border = "1px solid #d1d5db";
    i.style.borderRadius = "8px";
    i.style.minWidth = "120px";
    return i;
  };
  const checkbox = (checked: boolean) => {
    const i = document.createElement("input");
    i.type = "checkbox";
    i.checked = !!checked;
    return i;
  };
  const select = (items: Array<{label: string; value: string}>, current: string) => {
    const s = document.createElement("select");
    s.style.padding = "6px 8px";
    s.style.border = "1px solid #d1d5db";
    s.style.borderRadius = "8px";
    for (const it of items) {
      const o = document.createElement("option");
      o.value = it.value; o.textContent = it.label;
      if (current === it.value) o.selected = true;
      s.appendChild(o);
    }
    return s;
  };

  /* ------- General ------- */
  const secGeneral = section("General");
  const unitsSel = select([{label:"Millimeters (mm)", value:"mm"}, {label:"Inches (in)", value:"in"}], s.units);
  const kerfNum = number(s.kerf, 0.1, 0);
  const marginNum = number(s.margin, 0.5, 0);
  const showLabelsChk = checkbox(s.showLabels);
  const showDimsChk = checkbox(s.showDims);

  secGeneral.append(
    row("Units", unitsSel),
    row("Kerf", kerfNum),
    row("Margin", marginNum),
    row("Show Labels", showLabelsChk),
    row("Show Dimensions", showDimsChk)
  );

  /* ------- Fonts ------- */
  const secFonts = section("Fonts");
  // UI
  const uiFamily = text(s.uiFont.family);
  const uiSize   = number(s.uiFont.size, 1, 6);
  const uiColor  = text(s.uiFont.color ?? "#111827");
  // SVG
  const svgFamily = text(s.svgFont.family);
  const svgSize   = number(s.svgFont.size, 1, 6);
  const svgColor  = text(s.svgFont.color ?? "#0f172a");
  // Print
  const prFamily = text(s.printFont.family);
  const prSize   = number(s.printFont.size, 1, 6);
  const prColor  = text(s.printFont.color ?? "#000000");

  secFonts.append(
    row("UI font family", uiFamily),
    row("UI size (px)", uiSize),
    row("UI color", uiColor),
    row("SVG font family", svgFamily),
    row("SVG size (px)", svgSize),
    row("SVG color", svgColor),
    row("Print font family", prFamily),
    row("Print base size (pt)", prSize),
    row("Print color", prColor),
  );

  /* ------- Printer ------- */
  const secPrinter = section("Printing");
  const modeSel = select([
    { label: "Browser (HTML print)", value: "browser" },
    { label: "Zebra (ZPL export)", value: "zebra" },
  ], s.printer.mode);

  const wMm = number(s.printer.labelWidthMM, 1, 10);
  const hMm = number(s.printer.labelHeightMM, 1, 10);
  const dpiSel = select(
    [{label:"203 dpi", value:"203"}, {label:"300 dpi", value:"300"}, {label:"600 dpi", value:"600"}],
    String(s.printer.zebraDPI ?? 203)
  );
  const qrChk = checkbox(s.printer.includeQR);
  const bcChk = checkbox(s.printer.includeBarcode);

  secPrinter.append(
    row("Mode", modeSel),
    row("Label width (mm)", wMm),
    row("Label height (mm)", hMm),
    row("Zebra DPI", dpiSel),
    row("Include QR", qrChk),
    row("Include Barcode", bcChk),
  );

  grid.append(secGeneral, secFonts, secPrinter);
  panel.append(title, grid);

  // Footer
  const footer = document.createElement("div");
  footer.style.display = "flex";
  footer.style.justifyContent = "flex-end";
  footer.style.gap = "8px";
  footer.style.marginTop = "12px";

  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.textContent = "Cancel";
  styleBtn(cancel);
  cancel.onclick = () => overlay.remove();

  const save = document.createElement("button");
  save.type = "button";
  save.textContent = "Save";
  styleBtn(save, true);
  save.onclick = () => {
    setSettings({
      units: (unitsSel as HTMLSelectElement).value as "mm"|"in",
      kerf: clamp(num((kerfNum as HTMLInputElement).value, s.kerf), 0, 1000),
      margin: clamp(num((marginNum as HTMLInputElement).value, s.margin), 0, 1000),
      showLabels: (showLabelsChk as HTMLInputElement).checked,
      showDims: (showDimsChk as HTMLInputElement).checked,

      uiFont: {
        family: (uiFamily as HTMLInputElement).value || s.uiFont.family,
        size: clamp(num((uiSize as HTMLInputElement).value, s.uiFont.size), 6, 64),
        color: (uiColor as HTMLInputElement).value || s.uiFont.color,
      },
      svgFont: {
        family: (svgFamily as HTMLInputElement).value || s.svgFont.family,
        size: clamp(num((svgSize as HTMLInputElement).value, s.svgFont.size), 6, 64),
        color: (svgColor as HTMLInputElement).value || s.svgFont.color,
      },
      printFont: {
        family: (prFamily as HTMLInputElement).value || s.printFont.family,
        size: clamp(num((prSize as HTMLInputElement).value, s.printFont.size), 6, 64),
        color: (prColor as HTMLInputElement).value || s.printFont.color,
      },
      printer: {
        mode: (modeSel as HTMLSelectElement).value as "browser" | "zebra",
        labelWidthMM: clamp(num((wMm as HTMLInputElement).value, s.printer.labelWidthMM), 10, 500),
        labelHeightMM: clamp(num((hMm as HTMLInputElement).value, s.printer.labelHeightMM), 10, 500),
        zebraDPI: Number((dpiSel as HTMLSelectElement).value) as 203 | 300 | 600,
        includeQR: (qrChk as HTMLInputElement).checked,
        includeBarcode: (bcChk as HTMLInputElement).checked,
      },
    });
    overlay.remove();
    // Inform others to refresh if they rely on live settings
    emit(Events.SETTINGS_UPDATED);
  };

  footer.append(cancel, save);
  panel.appendChild(footer);

  overlay.appendChild(panel);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
  window.addEventListener("keydown", function onEsc(e) {
    if (e.key === "Escape") { overlay.remove(); window.removeEventListener("keydown", onEsc); }
  });

  document.body.appendChild(overlay);
}

function styleBtn(b: HTMLButtonElement, solid = false) {
  b.style.padding = "6px 12px";
  b.style.borderRadius = "8px";
  b.style.border = "1px solid #d1d5db";
  b.style.cursor = "pointer";
  b.style.background = solid ? "#111827" : "#fff";
  b.style.color = solid ? "#fff" : "#111827";
}
