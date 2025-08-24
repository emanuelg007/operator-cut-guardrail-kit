// src/printing/labels.ts

// NOTE: This file intentionally does NOT import getSettings to avoid coupling
// and the “declares locally but not exported” error. It reads settings from
// localStorage ("oc:settings") and falls back to the same defaults as in
// src/state/settings.ts.

/* ----------------------------- public types ------------------------------ */

export type PrintablePart = {
  id?: string;
  name?: string;
  material?: string;
  materialTag?: string;
  w: number;
  h: number;
  notes1?: string;
  notes2?: string;
};

export type LabelOptions = {
  // existing options (kept)
  widthMm?: number;
  heightMm?: number;
  showQr?: boolean;
  showBarcode?: boolean;
  title?: string;
  dpi?: 203 | 300 | 600;     // for ZPL
  fontFamily?: string;       // for HTML label
  basePt?: number;           // base point size for HTML label typography
  color?: string;            // main text color for HTML label

  // NEW optional fine-grain overrides (non-breaking; all optional)
  titlePt?: number;
  metaPt?: number;
  sizePt?: number;
  notesPt?: number;
  metaColor?: string;
  notesColor?: string;
};

/* ---------------------- mirror of settings defaults ---------------------- */

type PrinterMode = "browser" | "zebra";
type PrinterSettings = {
  mode: PrinterMode;
  labelWidthMM: number;
  labelHeightMM: number;
  zebraDPI: 203 | 300 | 600 | number;
  includeQR: boolean;
  includeBarcode: boolean;
};

type FontPreset = {
  family: string;
  size: number;   // treated as pt for print CSS
  color?: string;
};

type MinimalSettings = {
  printFont: FontPreset;
  printer: PrinterSettings;
};

const DEFAULTS: MinimalSettings = {
  printFont: { family: "Inter, system-ui, sans-serif", size: 12, color: "#000000" },
  printer: {
    mode: "browser",
    labelWidthMM: 100,
    labelHeightMM: 50,
    zebraDPI: 203,
    includeQR: false,
    includeBarcode: false,
  },
};

/* ----------------------------- internal helpers -------------------------- */

function loadSettings(): MinimalSettings {
  try {
    const raw = localStorage.getItem("oc:settings");
    const saved = raw ? JSON.parse(raw) : {};
    const pf: FontPreset = { ...DEFAULTS.printFont, ...(saved.printFont || {}) };
    const pr: PrinterSettings = { ...DEFAULTS.printer, ...(saved.printer || {}) };
    return { printFont: pf, printer: pr };
  } catch {
    return DEFAULTS;
  }
}

function dotsPerMm(dpi: number): number {
  return dpi / 25.4; // 25.4 mm per inch
}

function escapeHtml(s: string) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function zplEscape(s: string) {
  return String(s ?? "").replace(/[\^~]/g, " "); // strip ZPL control chars
}

/* ----------------------------- HTML (browser) ---------------------------- */

export function htmlLabelFor(part: PrintablePart, overrides?: Partial<LabelOptions>): string {
  const S = loadSettings();
  const o = {
    widthMm: overrides?.widthMm ?? S.printer.labelWidthMM,
    heightMm: overrides?.heightMm ?? S.printer.labelHeightMM,
    showQr: overrides?.showQr ?? !!S.printer.includeQR,
    showBarcode: overrides?.showBarcode ?? !!S.printer.includeBarcode,
    title: overrides?.title ?? (part.name || part.id || "Part"),
    dpi: overrides?.dpi ?? (S.printer.zebraDPI as 203 | 300 | 600) ?? 203,
    fontFamily:
      overrides?.fontFamily ??
      S.printFont.family ??
      `system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", "Liberation Sans", sans-serif`,
    basePt: overrides?.basePt ?? (S.printFont.size || 12),
    color: overrides?.color ?? (S.printFont.color || "#0f172a"),

    // NEW explicit typography overrides (fall back to ramp)
    titlePt: overrides?.titlePt,
    metaPt: overrides?.metaPt,
    sizePt: overrides?.sizePt,
    notesPt: overrides?.notesPt,
    metaColor: overrides?.metaColor,
    notesColor: overrides?.notesColor,
  };

  const title = o.title as string;
  const mat   = (part.materialTag || part.material || "").toString();
  const size  = `${Math.round(part.w)} × ${Math.round(part.h)} mm`;
  const notes = [part.notes1, part.notes2].filter(Boolean).join("  •  ");

  // type ramp derived from base (only used if explicit sizes not provided)
  const rampTitle = Math.round((o.basePt as number) * 1.33);
  const rampSize  = Math.round((o.basePt as number) * 1.0);
  const rampMeta  = Math.max(8, Math.round((o.basePt as number) * 0.85));
  const rampNotes = Math.max(8, Math.round((o.basePt as number) * 0.8));

  const titlePt = o.titlePt ?? rampTitle;
  const sizePt  = o.sizePt  ?? rampSize;
  const metaPt  = o.metaPt  ?? rampMeta;
  const notesPt = o.notesPt ?? rampNotes;

  const metaColor  = o.metaColor  ?? (o.color as string);
  const notesColor = o.notesColor ?? (o.color as string);

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
  @page { size: ${o.widthMm}mm ${o.heightMm}mm; margin: 0; }
  html, body { height: 100%; }
  body {
    margin: 0;
    padding: 0;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    font-family: ${o.fontFamily};
    color: ${o.color};
  }
  .label {
    width: ${o.widthMm}mm;
    height: ${o.heightMm}mm;
    box-sizing: border-box;
    padding: 6mm;
    display: grid;
    grid-template-columns: ${o.showQr ? "1fr auto" : "1fr"};
    grid-template-rows: auto auto auto 1fr;
    row-gap: 2mm;
    column-gap: 3mm;
  }
  .main { display: grid; grid-template-rows: auto auto auto 1fr; row-gap: 2mm; }
  .title { font-size: ${titlePt}pt; font-weight: 700; line-height: 1.1; }
  .meta  { font-size: ${metaPt}pt; color: ${metaColor}; }
  .size  { font-size: ${sizePt}pt; font-weight: 600; }
  .notes { font-size: ${notesPt}pt; color: ${notesColor}; white-space: pre-wrap; }
  .qr    { width: 20mm; height: 20mm; border: 1px dashed #cbd5e1; display:flex; align-items:center; justify-content:center; font-size:8pt; color:#94a3b8; }
</style>
</head>
<body>
  <div class="label">
    <div class="main">
      <div class="title">${escapeHtml(title)}</div>
      <div class="meta">${escapeHtml(mat)}</div>
      <div class="size">${escapeHtml(size)}</div>
      <div class="notes">${escapeHtml(notes)}</div>
    </div>
    ${o.showQr ? `<div class="qr">QR</div>` : ``}
  </div>
  <script>
    setTimeout(() => { try { window.print(); } catch(e){} }, 150);
  </script>
</body>
</html>`;
}

/** Open a print window and print a single label (browser mode). */
export function printLabelBrowser(part: PrintablePart, overrides?: Partial<LabelOptions>): boolean {
  const win = window.open("", "_blank", "noopener,noreferrer,width=600,height=400");
  if (!win) {
    console.warn("[labels] popup blocked by the browser.");
    alert("Popup blocked. Allow popups for this site to print labels.");
    return false;
  }
  win.document.open();
  win.document.write(htmlLabelFor(part, overrides));
  win.document.close();
  return true;
}

/* ------------------------------- ZPL output ------------------------------- */

export function zplForLabel(part: PrintablePart, overrides?: Partial<LabelOptions>): string {
  const S = loadSettings();
  const dpi = (overrides?.dpi ?? (S.printer.zebraDPI as 203 | 300 | 600) ?? 203) as number;
  const dpm = dotsPerMm(dpi);

  const widthMm  = overrides?.widthMm  ?? S.printer.labelWidthMM;
  const heightMm = overrides?.heightMm ?? S.printer.labelHeightMM;
  const w = Math.round(widthMm * dpm);
  const h = Math.round(heightMm * dpm);

  const showQr      = overrides?.showQr      ?? !!S.printer.includeQR;
  const showBarcode = overrides?.showBarcode ?? !!S.printer.includeBarcode;

  const title = overrides?.title ?? (part.name || part.id || "Part");
  const mat   = (part.materialTag || part.material || "").toString();
  const size  = `${Math.round(part.w)}x${Math.round(part.h)} mm`;
  const notes = [part.notes1, part.notes2].filter(Boolean).join(" • ");

  const left = 30;
  let y = 20;

  const lines: string[] = [
    "^XA",
    `^PW${w}`,
    `^LL${h}`,
    "^LH0,0",
    `^FO${left},${y}^A0N,40,40^FD${zplEscape(title)}^FS`,
  ];
  y += 60;
  lines.push(`^FO${left},${y}^A0N,28,28^FD${zplEscape(mat)}^FS`);
  y += 40;
  lines.push(`^FO${left},${y}^A0N,32,32^FD${zplEscape(size)}^FS`);
  if (notes) {
    y += 45;
    lines.push(`^FO${left},${y}^A0N,24,24^FD${zplEscape(notes)}^FS`);
  }

  if (showBarcode && (part.id || part.name)) {
    y += 80;
    const data = part.id || part.name || "";
    lines.push(
      `^FO${left},${y}^BY2`,
      "^BCN,80,Y,N,N",
      `^FD${zplEscape(data)}^FS`
    );
    y += 100;
  }

  if (showQr && (part.id || part.name)) {
    const data = part.id || part.name || "";
    lines.push(
      `^FO${w - 160},${20}^BQN,2,4`,
      `^FDLA,${zplEscape(data)}^FS`
    );
  }

  lines.push("^XZ");
  return lines.join("\n");
}

/**
 * Convenience: choose browser vs zebra from Settings.printer.mode.
 * In zebra mode we open a window with the ZPL text so the operator can copy/paste
 * into their sender until a direct transport is added.
 */
export function printLabelAuto(part: PrintablePart, overrides?: Partial<LabelOptions>): boolean {
  const S = loadSettings();
  if (S.printer.mode === "zebra") {
    const zpl = zplForLabel(part, {
      dpi: (S.printer.zebraDPI as 203 | 300 | 600) ?? 203,
      widthMm: S.printer.labelWidthMM,
      heightMm: S.printer.labelHeightMM,
      showQr: !!S.printer.includeQR,
      showBarcode: !!S.printer.includeBarcode,
      ...overrides,
    });
    const win = window.open("", "_blank", "noopener,noreferrer,width=600,height=500");
    if (!win) {
      alert("Popup blocked. Allow popups for this site to view ZPL.");
      return false;
    }
    win.document.open();
    win.document.write(
      "<!doctype html><meta charset='utf-8'><title>ZPL</title>" +
      "<style>body{margin:0;font:12px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;}" +
      "textarea{width:100vw;height:100vh;border:0;outline:0;padding:12px;box-sizing:border-box;}</style>" +
      `<textarea spellcheck="false">${escapeHtml(zpl)}</textarea>`
    );
    win.document.close();
    return true;
  }
  return printLabelBrowser(part, overrides);
}
