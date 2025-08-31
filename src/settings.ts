// src/ui/settings.ts
// Settings modal UI (touch-friendly). Works with state/settings exported getSettings/setSettings.

import { getSettings, setSettings } from "./state/settings";

/** Back-compat inline hook — we just show the modal now. */
export function initSettingsUI(_container: HTMLElement) {
  openSettingsModal();
}

/** Open the settings modal (replaces any existing one). */
export function openSettingsModal() {
  // Clean up any stale overlays
  document.querySelectorAll("#oc-settings-overlay").forEach((n) => n.remove());

  const S = getSettings();

  // ---- Overlay ----
  const overlay = el("div", {
    id: "oc-settings-overlay",
    style: `
      position: fixed; inset: 0; z-index: 2147483000;
      background: rgba(0,0,0,0.4);
      display: grid; place-items: center;
    `,
  });

  // ---- Modal ----
  const modal = el("div", {
    style: `
      width: min(980px, 94vw);
      max-height: 90vh;
      overflow: auto;
      background: #ffffff;
      border-radius: 12px;
      box-shadow: 0 30px 80px rgba(0,0,0,0.45);
      padding: 14px;
      display: grid;
      grid-template-rows: auto 1fr auto;
      gap: 10px;
      font-family: ${safe(S.uiFont?.family, 'Inter, system-ui, sans-serif')};
      color: ${safe(S.uiFont?.color, '#0f172a')};
      font-size: ${px(S.uiFont?.size ?? 14)};
    `,
  });

  const header = el("div", {
    style: `display:flex;align-items:center;justify-content:space-between;gap:10px;`,
  });
  header.append(
    el("h3", {
      text: "Settings",
      style: "margin:0;font-size:18px;font-weight:800;color:#0f172a;",
    }),
    iconButton("Close", () => close())
  );

  const content = el("div", {
    style: `
      display: grid; gap: 12px;
      grid-template-columns: 1fr;
    `,
  });

  // --- Sections ---
  content.append(
    section("Nesting", grid(
      row(select("Units", ["mm", "in"], S.units), "units"),
      row(number("Kerf (mm)", S.kerf, 0.1, 0.1), "kerf"),
      row(number("Margin (mm)", S.margin, 1, 0.5), "margin"),
      row(checkbox("Show Labels", S.showLabels), "showLabels"),
      row(checkbox("Show Dimensions", S.showDims), "showDims"),
    )),

    section("Fonts", grid(
      subhead("UI Font"),
      row(input("Family", S.uiFont?.family ?? "Inter, system-ui, sans-serif"), "uiFont.family"),
      row(number("Size (px)", S.uiFont?.size ?? 14, 1, 1), "uiFont.size"),
      row(color("Color", S.uiFont?.color ?? "#0f172a"), "uiFont.color"),

      subhead("SVG Font"),
      row(input("Family", S.svgFont?.family ?? "Inter, system-ui, sans-serif"), "svgFont.family"),
      row(number("Size (px)", S.svgFont?.size ?? 10, 1, 1), "svgFont.size"),
      row(color("Color", S.svgFont?.color ?? "#0f172a"), "svgFont.color"),

      subhead("Print Font"),
      row(input("Family", S.printFont?.family ?? "Inter, system-ui, sans-serif"), "printFont.family"),
      row(number("Base Size (pt)", S.printFont?.size ?? 12, 1, 1), "printFont.size"),
      row(color("Color", S.printFont?.color ?? "#000000"), "printFont.color"),
    )),

    section("SVG Style", grid(
      row(color("Board Stroke", S.svgStyle?.boardStroke ?? "#111827"), "svgStyle.boardStroke"),
      row(color("Board Fill", S.svgStyle?.boardFill ?? "#ffffff"), "svgStyle.boardFill"),
      row(number("Board Stroke Width", S.svgStyle?.boardStrokeWidth ?? 2, 0.5, 0.5), "svgStyle.boardStrokeWidth"),

      row(color("Part Stroke", S.svgStyle?.partStroke ?? "#1f2937"), "svgStyle.partStroke"),
      row(color("Part Fill", S.svgStyle?.partFill ?? "#e5e7eb"), "svgStyle.partFill"),
      row(color("Printed Part Fill", S.svgStyle?.partPrintedFill ?? "#2563eb"), "svgStyle.partPrintedFill"),
      row(number("Part Stroke Width", S.svgStyle?.partStrokeWidth ?? 2, 0.5, 0.5), "svgStyle.partStrokeWidth"),

      row(color("Label Color", S.svgStyle?.labelColor ?? "#0f172a"), "svgStyle.labelColor"),
      row(color("Dimension Color", S.svgStyle?.dimColor ?? "#0f172a"), "svgStyle.dimColor"),
      row(color("Cut Line Color", S.svgStyle?.cutLineColor ?? "#334155"), "svgStyle.cutLineColor"),
      row(number("Cut Line Width", S.svgStyle?.cutLineWidth ?? 2, 0.5, 0.5), "svgStyle.cutLineWidth"),
      row(number("Touch Padding (px)", S.svgStyle?.touchTargetPadding ?? 6, 1, 1), "svgStyle.touchTargetPadding"),
      row(checkbox("Show tooltips", S.svgStyle?.showTooltips ?? true), "svgStyle.showTooltips"),
    )),

    section("Printer", grid(
      row(select("Mode", ["browser", "zebra"], S.printer?.mode ?? "browser"), "printer.mode"),
      row(number("Label Width (mm)", S.printer?.labelWidthMM ?? 100, 1, 1), "printer.labelWidthMM"),
      row(number("Label Height (mm)", S.printer?.labelHeightMM ?? 50, 1, 1), "printer.labelHeightMM"),
      row(select("Zebra DPI", ["203", "300", "600"], String(S.printer?.zebraDPI ?? 203)), "printer.zebraDPI"),
      row(checkbox("Include QR", !!S.printer?.includeQR), "printer.includeQR"),
      row(checkbox("Include Barcode", !!S.printer?.includeBarcode), "printer.includeBarcode"),
    )),
  );

  // ---- Footer ----
  const footer = el("div", {
    style: `display:flex;justify-content:flex-end;gap:8px;`,
  });
  const cancelBtn = pill("Cancel", () => close());
  const saveBtn = primary("Save", () => {
    const patch = readForm(content);
    setSettings(patch as any);
    close();
  });
  footer.append(cancelBtn, saveBtn);

  modal.append(header, content, footer);
  overlay.append(modal);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
  window.addEventListener("keydown", onEsc);
  document.body.appendChild(overlay);

  function onEsc(e: KeyboardEvent) {
    if (e.key === "Escape") close();
  }
  function close() {
    window.removeEventListener("keydown", onEsc);
    overlay.remove();
  }
}

/* ---------------------------- form helpers ---------------------------- */

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  opts: { id?: string; text?: string; html?: string; style?: string } = {}
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (opts.id) node.id = opts.id;
  if (opts.text) node.textContent = opts.text;
  if (opts.html) node.innerHTML = opts.html;
  if (opts.style) (node as HTMLElement).style.cssText = opts.style;
  return node;
}

function section(title: string, body: HTMLElement) {
  const wrap = el("div", { style: `border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;background:#fff;` });
  const head = el("div", {
    text: title,
    style: `padding:10px 12px;font-weight:700;background:linear-gradient(180deg,#f8fafc 0%,#ffffff 40%);border-bottom:1px solid #e5e7eb;`,
  });
  wrap.append(head, body);
  return wrap;
}

function grid(...children: HTMLElement[]) {
  const g = el("div", {
    style: `display:grid;grid-template-columns: repeat(auto-fit,minmax(240px,1fr));gap:10px;padding:10px;`,
  });
  g.append(...children);
  return g;
}

function row(inputEl: HTMLElement, path: string) {
  const wrap = el("label", {
    style: `
      display:grid;gap:6px;
      border:1px solid #e5e7eb;border-radius:8px;padding:8px;background:#ffffff;
      font-size:12px;
    `,
  });
  wrap.dataset.path = path;
  const cap = el("div", { text: (inputEl as HTMLInputElement).dataset?.label ?? "", style: "opacity:.8" });
  if (!(inputEl as HTMLInputElement).dataset?.label) {
    // infer from path
    cap.textContent = prettify(path);
  }
  wrap.append(cap, inputEl);
  return wrap;
}

function input(label: string, value: string) {
  const i = document.createElement("input");
  i.type = "text";
  i.value = String(value ?? "");
  i.dataset.label = label;
  i.style.cssText = fieldCss();
  return i;
}

function number(label: string, value: number, step = 1, min?: number) {
  const i = document.createElement("input");
  i.type = "number";
  i.step = String(step);
  if (min !== undefined) i.min = String(min);
  i.value = String(value ?? 0);
  i.dataset.label = label;
  i.style.cssText = fieldCss();
  return i;
}

function color(label: string, value: string) {
  const i = document.createElement("input");
  i.type = "color";
  // try to keep a valid hex; fallback if necessary
  i.value = toHex(value, "#0f172a");
  i.dataset.label = label;
  i.style.cssText = fieldCss();
  return i;
}

function checkbox(label: string, checked: boolean) {
  const w = (el("div") as HTMLDivElement);
  const i = document.createElement("input");
  i.type = "checkbox";
  i.checked = !!checked;
  i.dataset.label = label;
  i.style.cssText = "transform: scale(1.2); margin-right: 8px; cursor: pointer;";
  const l = el("span", { text: label, style: "vertical-align:middle;" });
  w.append(i, l);
  // mark for readForm
  (w as any).__isCheckbox = true;
  return w;
}

function select(label: string, options: string[], value: string) {
  const s = document.createElement("select");
  for (const opt of options) {
    const o = document.createElement("option");
    o.value = opt;
    o.text = opt;
    if (String(value) === opt) o.selected = true;
    s.appendChild(o);
  }
  s.dataset.label = label;
  s.style.cssText = fieldCss();
  return s;
}

function fieldCss() {
  return `
    font: 13px/1.4 system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
    padding: 8px 10px; border:1px solid #cbd5e1; border-radius:8px;
    background:#ffffff; color:#0f172a; outline:none;
  `;
}

function iconButton(label: string, onClick: () => void) {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = label;
  b.style.cssText = `
    padding: 6px 10px; border:1px solid #e5e7eb; border-radius:8px; cursor:pointer;
    background:#fff; color:#1f2937;
  `;
  b.onclick = onClick;
  return b;
}

function pill(label: string, onClick: () => void) {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = label;
  b.style.cssText = `
    padding: 8px 12px; border:1px solid #cbd5e1; border-radius:999px; cursor:pointer;
    background:#fff; color:#334155;
  `;
  b.onclick = onClick;
  return b;
}

function primary(label: string, onClick: () => void) {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = label;
  b.style.cssText = `
    padding: 8px 14px; border:1px solid #60a5fa; border-radius:10px; cursor:pointer;
    background: linear-gradient(180deg, #93c5fd, #3b82f6); color:#fff; font-weight:700;
  `;
  b.onclick = onClick;
  return b;
}

function subhead(text: string) {
  return el("div", {
    text,
    style: "grid-column: 1 / -1; font-weight: 700; margin-top: 6px; opacity:.8;",
  });
}

function prettify(path: string) {
  return path
    .split(".")
    .pop()!
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

/** Read all inputs inside content and build a patch object shaped like Settings. */
function readForm(content: HTMLElement) {
  const patch: any = {};
  const rows = Array.from(content.querySelectorAll("label[data-path]")) as HTMLLabelElement[];
  for (const r of rows) {
    const path = r.dataset.path!;
    const inputEl = r.querySelector("input, select") as HTMLInputElement | HTMLSelectElement | null;
    if (!inputEl) continue;

    let val: any;
    if ((r.firstElementChild as any)?.__isCheckbox) {
      const cb = r.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
      val = !!cb?.checked;
    } else if (inputEl instanceof HTMLInputElement && inputEl.type === "number") {
      val = Number(inputEl.value);
    } else if (inputEl instanceof HTMLInputElement && inputEl.type === "color") {
      val = inputEl.value;
    } else {
      val = (inputEl as any).value;
    }

    setDeep(patch, path, val);
  }
  if (patch?.printer?.zebraDPI) patch.printer.zebraDPI = Number(patch.printer.zebraDPI);
  return patch;
}

function setDeep(obj: any, path: string, val: any) {
  const parts = path.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i];
    if (!(k in cur)) cur[k] = {};
    cur = cur[k];
  }
  cur[parts[parts.length - 1]] = val;
}

function safe<T>(v: T | undefined, d: T): T { return v === undefined || v === null ? d : v; }
function px(n: number) { return `${Math.max(8, Math.round(n))}px`; }
function toHex(value: string, fallback: string) {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value || "") ? value : fallback;
}
