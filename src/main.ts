// src/main.ts
import { parseCsv } from "./csv/parseCsv";
import { normalizeRows, type Mapping } from "./csv/normalize";
import { autoMapHeaders, mappingMissing } from "./csv/autoMap";
import { openHeaderMapModal as _maybeModal } from "./ui/modals/header-map-modal";

import * as SettingsUI from "./ui/settings";
import { wireMaterialsUpload } from "./ui/materials-upload";

import { getBoards } from "./state/materials";
import { getSettings } from "./state/settings";

import { packPartsToSheets } from "./nesting/engine";
import type { PackResult, SheetLayout, NestablePart } from "./nesting/types";
import { hasByMaterial, hasSheets } from "./nesting/types";

import { createBoardPager, renderBoardSvg } from "./render/boardSvg";
import { on, emit, Events } from "./events";

import { markPrinted, undoPrinted } from "./state/partStatus";
import { printLabelBrowser } from "./printing/labels";

/* ----------------------------- DOM REFERENCES ----------------------------- */

// Cutting list
const fileInput = document.getElementById("fileInput") as HTMLInputElement | null;
const uploadBtn = document.getElementById("uploadBtn") as HTMLButtonElement | null;
const statusEl = document.getElementById("status") as HTMLDivElement | null;
const previewEl = document.getElementById("preview") as HTMLDivElement | null; // we will NOT use it for components anymore
const fileNameEl = document.getElementById("fileName") as HTMLSpanElement | null;

// Master materials
const materialsFileInput = document.getElementById("materialsFileInput") as HTMLInputElement | null;
const uploadMaterialsBtn = document.getElementById("uploadMaterialsBtn") as HTMLButtonElement | null;
const materialsStatusEl = document.getElementById("materialsStatus") as HTMLSpanElement | null;

// Render targets (legacy base mount – we’ll show SVG in a modal, not here)
const svgContainer = document.getElementById("board-svg")!;
const settingsContainer = document.getElementById("settings")!;

/* ------------------------- SETTINGS LAUNCHER (modal) ------------------------- */

setupSettingsLauncher();
function setupSettingsLauncher() {
  if (settingsContainer) settingsContainer.style.display = "none";

  let btn = document.getElementById("oc-open-settings") as HTMLButtonElement | null;
  if (!btn) {
    btn = document.createElement("button");
    btn.id = "oc-open-settings";
    btn.textContent = "Settings";
    btn.type = "button";
    btn.style.position = "fixed";
    btn.style.top = "10px";
    btn.style.right = "10px";
    btn.style.zIndex = String(2147483647);
    btn.style.pointerEvents = "auto";
    btn.style.padding = "6px 10px";
    btn.style.border = "1px solid #d1d5db";
    btn.style.borderRadius = "8px";
    btn.style.background = "#fff";
    btn.style.cursor = "pointer";
    document.body.appendChild(btn);
  }

  const openSettings = () => {
    for (const sel of ["#oc-settings-overlay", "#oc-settings-modal", '[data-oc-modal="settings"]']) {
      document.querySelectorAll(sel).forEach((n) => n.remove());
    }
    const ui: any = SettingsUI;
    try {
      if (typeof ui?.openSettingsModal === "function") {
        ui.openSettingsModal();
        return;
      }
      if (typeof ui?.initSettingsUI === "function" && settingsContainer) {
        settingsContainer.style.display = "";
        ui.initSettingsUI(settingsContainer);
        return;
      }
      alert("Settings UI is not available.");
    } catch (err) {
      console.error("[settings] open failed:", err);
      alert("Could not open Settings (see console)");
    }
  };

  btn.replaceWith(btn.cloneNode(true));
  btn = document.getElementById("oc-open-settings") as HTMLButtonElement;
  btn.addEventListener("click", openSettings);

  const onHotkey = (e: KeyboardEvent) => {
    if (e.key.toLowerCase() !== "s") return;
    const el = document.activeElement as HTMLElement | null;
    const typing = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
    if (!typing) { e.preventDefault(); openSettings(); }
  };
  window.addEventListener("keydown", onHotkey);
}

/* --------------------------------- STATE ---------------------------------- */

let pendingFile: File | null = null;
let lastParts: NestablePart[] = [];
let lastPack: PackResult | null = null;
let showSvgAfterPack = false; // when Optimize is pressed, we use this to open the SVG modal on LAYOUTS_READY

/* ------------------------------- EVT HELPERS ------------------------------ */
const EVT = (name: string) => ((Events as any)?.[name] ?? name);
const emitLoose = (name: string, payload?: any) => (emit as any)(EVT(name), payload);
const onLoose = (name: string, cb: (...args: any[]) => void) => (on as any)(EVT(name), cb);

/* -------------------------------- HELPERS --------------------------------- */

function setStatus(type: "ok" | "err" | "neutral", msg: string) {
  if (!statusEl) return;
  statusEl.className = "status " + (type === "ok" ? "ok" : type === "err" ? "err" : "");
  statusEl.textContent = msg;
}
function showFileName(name: string) { if (fileNameEl) fileNameEl.textContent = name || "No file chosen"; }
function clearPreview() { if (previewEl) previewEl.innerHTML = ""; }

/* -------------------------- SVG PART ACTION MODAL ------------------------- */
function openSvgPartActionModal(p: NestablePart, pid: string) {
  const overlay = document.createElement("div");
  overlay.style.position = "fixed";
  overlay.style.inset = "0";
  overlay.style.background = "rgba(0,0,0,0.35)";
  overlay.style.display = "flex";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";
  overlay.style.zIndex = "10000";

  const card = document.createElement("div");
  card.style.width = "min(640px, 92vw)";
  card.style.maxHeight = "80vh";
  card.style.overflow = "auto";
  card.style.background = "#fff";
  card.style.borderRadius = "12px";
  card.style.boxShadow = "0 20px 50px rgba(0,0,0,0.35)";
  card.style.padding = "16px";

  const title = document.createElement("h3");
  title.textContent = `Component — ${p.name ?? p.id ?? ""}`;
  title.style.marginTop = "0";

  const facts = document.createElement("div");
  facts.style.display = "flex";
  facts.style.gap = "10px";
  facts.style.flexWrap = "wrap";
  facts.style.marginBottom = "8px";
  const fact = (k: string, v: string) => {
    const span = document.createElement("span");
    span.style.padding = "4px 8px";
    span.style.border = "1px solid #e5e7eb";
    span.style.borderRadius = "8px";
    span.style.background = "#f9fafb";
    span.textContent = `${k}: ${v}`;
    return span;
  };
  facts.append(
    fact("Material", String((p as any).materialTag ?? (p as any).material ?? "")),
    fact("Size", `${Math.round(p.w)} × ${Math.round(p.h)} mm`),
    fact("Qty", String((p as any).qty ?? 1)),
  );

  const table = document.createElement("table");
  table.style.width = "100%";
  table.style.borderCollapse = "collapse";
  const tbody = document.createElement("tbody");
  (Object.entries(p as unknown as Record<string, unknown>)).forEach(([k, v]) => {
    const tr = document.createElement("tr");
    const ktd = document.createElement("td");
    const vtd = document.createElement("td");
    ktd.textContent = k;
    vtd.textContent = String(v ?? "");
    ktd.style.fontWeight = "600";
    ktd.style.width = "30%";
    for (const td of [ktd, vtd]) {
      td.style.borderBottom = "1px solid #eee";
      td.style.padding = "6px 8px";
    }
    tr.append(ktd, vtd);
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);

  const bar = document.createElement("div");
  bar.style.display = "flex";
  bar.style.justifyContent = "flex-end";
  bar.style.gap = "8px";
  bar.style.marginTop = "12px";

  const btn = (label: string) => {
    const b = document.createElement("button");
    b.textContent = label;
    b.style.padding = "6px 12px";
    b.style.border = "1px solid #d1d5db";
    b.style.borderRadius = "8px";
    b.style.background = "#fff";
    b.style.cursor = "pointer";
    return b;
  };

  const printBtn = btn("Print");
  printBtn.onclick = () => {
    printLabelBrowser({
      id: (p as any).id,
      name: p.name,
      material: (p as any).material,
      materialTag: (p as any).materialTag,
      w: p.w,
      h: p.h,
      notes1: (p as any).notes1,
      notes2: (p as any).notes2,
    });
    markPrinted(pid);
    emitLoose("PART_STATUS_CHANGED", { pid, printed: true });
    document.body.removeChild(overlay);
  };

  const undoBtn = btn("Undo");
  undoBtn.onclick = () => {
    undoPrinted(pid);
    emitLoose("PART_STATUS_CHANGED", { pid, printed: false });
    document.body.removeChild(overlay);
  };

  const closeBtn = btn("Close");
  closeBtn.onclick = () => document.body.removeChild(overlay);

  bar.append(printBtn, undoBtn, closeBtn);
  card.append(title, facts, table, bar);
  overlay.appendChild(card);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) document.body.removeChild(overlay); });
  window.addEventListener("keydown", function onEsc(e) {
    if (e.key === "Escape") { document.body.removeChild(overlay); window.removeEventListener("keydown", onEsc); }
  });

  document.body.appendChild(overlay);
}

/* --------------------- MAPPING (drawer or real modal) --------------------- */

type DrawerResolve = (m: Mapping) => void;

function buildFallbackMapDrawer(
  headers: string[],
  seed: Partial<Mapping> | undefined,
  onApply: DrawerResolve
) {
  const overlay = document.createElement("div");
  overlay.id = "header-map-fallback-overlay";
  overlay.style.position = "fixed";
  overlay.style.inset = "0";
  overlay.style.background = "rgba(0,0,0,0.40)";
  overlay.style.zIndex = "2147483000";

  const panel = document.createElement("div");
  panel.style.position = "fixed";
  panel.style.top = "0";
  panel.style.right = "0";
  panel.style.width = "460px";
  panel.style.height = "100%";
  panel.style.background = "#fff";
  panel.style.boxShadow = "-8px 0 30px rgba(0,0,0,0.25)";
  panel.style.padding = "16px";
  panel.style.display = "flex";
  panel.style.flexDirection = "column";
  panel.style.gap = "12px";
  panel.id = "header-map-fallback";

  const title = document.createElement("h3");
  title.textContent = "Map CSV headers → Required fields";
  title.style.margin = "0 0 8px";

  const fields: (keyof Mapping)[] = ["Name","Material","Length","Width","Qty"];
  const form = document.createElement("form");
  form.onsubmit = (e) => { e.preventDefault(); };

  const selects: Partial<Record<keyof Mapping, HTMLSelectElement>> = {};
  for (const key of fields) {
    const label = document.createElement("label");
    label.style.display = "grid";
    label.style.gap = "6px";
    label.textContent = key;

    const sel = document.createElement("select");
    sel.style.padding = "6px 8px";
    sel.style.border = "1px solid #d1d5db";
    sel.style.borderRadius = "8px";

    const blank = document.createElement("option");
    blank.value = "";
    blank.textContent = "(choose column)";
    sel.appendChild(blank);

    for (const h of headers) {
      const opt = document.createElement("option");
      opt.value = h;
      opt.textContent = h;
      sel.appendChild(opt);
    }
    const preset = (seed?.[key] as string | undefined) ?? "";
    if (preset) sel.value = preset;

    selects[key] = sel;
    label.appendChild(sel);
    form.appendChild(label);
  }

  const bar = document.createElement("div");
  bar.style.marginTop = "8px";
  bar.style.display = "flex";
  bar.style.gap = "8px";
  bar.style.justifyContent = "flex-end";

  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.textContent = "Cancel";
  cancel.style.padding = "6px 10px";
  cancel.onclick = () => document.body.removeChild(overlay);

  const apply = document.createElement("button");
  apply.type = "button";
  apply.textContent = "Apply";
  apply.style.padding = "6px 10px";
  apply.style.border = "1px solid #d1d5db";
  apply.style.borderRadius = "8px";
  apply.style.background = "#fff";
  apply.onclick = () => {
    const mapping: Mapping = {
      Name: selects.Name!.value,
      Material: selects.Material!.value,
      Length: selects.Length!.value,
      Width: selects.Width!.value,
      Qty: selects.Qty!.value,
    };
    document.body.removeChild(overlay);
    onApply(mapping);
  };

  bar.append(cancel, apply);
  panel.append(title, form, bar);
  overlay.onclick = (e) => { if (e.target === overlay) document.body.removeChild(overlay); };
  overlay.appendChild(panel);
  document.body.appendChild(overlay);
}

async function ensureMappingViaDrawer(
  headers: string[],
  rows: string[][],
  guess: Partial<Mapping>
): Promise<Mapping> {
  // We prefer a modal (“handler”). If not available, we fall back to the drawer.
  const useModal = true;
  if (useModal && typeof (_maybeModal as any) === "function") {
    return new Promise<Mapping>((resolve) => {
      (_maybeModal as any)(headers, (m: Mapping) => resolve(m), guess, rows);
    });
  }
  // fallback drawer
  return new Promise<Mapping>((resolve) => {
    buildFallbackMapDrawer(headers, guess, resolve);
  });
}

/* ------------------------ MATERIALS UPLOAD + AUTOPACK --------------------- */

if (materialsFileInput && uploadMaterialsBtn && materialsStatusEl) {
  wireMaterialsUpload(materialsFileInput, uploadMaterialsBtn, materialsStatusEl);
}

on(Events.MATERIALS_LOADED, (payload) => {
  const { count } = payload ?? { count: 0 };
  if (materialsStatusEl) {
    materialsStatusEl.className = "status ok";
    materialsStatusEl.textContent = `Loaded ${count} board row(s).`;
  }
  console.debug("[main] materials loaded:", count);
  if (lastParts.length) void repackAndRender();
});

/* ----------------------------- SVG PAGER / MODAL -------------------------- */

// Keep legacy listener so devs can still see inline SVG (useful during dev),
// but if Optimize triggered, we’ll open the SVG full-screen modal as well.
on(Events.LAYOUTS_READY, (payload) => {
  const { sheets = [] as SheetLayout[] } = payload ?? { sheets: [] as SheetLayout[] };
  console.debug("[main] layouts ready:", sheets.length);
  // render to hidden/legacy mount
  if (svgContainer) {
    svgContainer.innerHTML = "";
    createBoardPager(svgContainer, sheets);
  }
  // if optimize flow requested, open the SVG modal
  if (showSvgAfterPack) {
    showSvgAfterPack = false;
    openSvgModal(sheets);
  }
});

/* --------------------- SVG → modal (print / undo / close) ----------------- */

onLoose("PART_CLICKED", ({ pid, part }: any) => {
  if (!pid || !part) return;
  openSvgPartActionModal(part, pid);
});

onLoose("PART_PRINT_REQUEST", ({ pid }: any) => {
  if (!pid) return;
  markPrinted(pid);
  emitLoose("PART_STATUS_CHANGED", { pid, printed: true });
});
onLoose("PART_UNDO_PRINT_REQUEST", ({ pid }: any) => {
  if (!pid) return;
  undoPrinted(pid);
  emitLoose("PART_STATUS_CHANGED", { pid, printed: false });
});
on(Events.PART_STATUS_CHANGED, (payload) => {
  const { pid, printed } = (payload ?? {}) as { pid?: string; printed?: boolean };
  if (!pid || printed === undefined) return;
  if (printed) markPrinted(pid); else undoPrinted(pid);
});

/* --------------------------------- WIRING --------------------------------- */

fileInput?.addEventListener("change", () => {
  pendingFile = fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;
  showFileName(pendingFile ? pendingFile.name : "No file chosen");
});
uploadBtn?.addEventListener("click", () => {
  void handleCuttingList(pendingFile ?? (fileInput && fileInput.files ? fileInput.files[0] : null));
});

/* ----------------------------- MAIN PROCESSING ---------------------------- */

async function handleCuttingList(file: File | null) {
  // Do NOT populate the base page with the list anymore.
  clearPreview();

  if (!file) {
    setStatus("err", "No file uploaded");
    showFileName("No file chosen");
    return;
  }
  showFileName(file.name);

  try {
    const text = await file.text();
    const { headers, rows, delimiter } = parseCsv(text);

    if (!headers || headers.length === 0) {
      setStatus("err", "Could not detect a header row. Check the first line of your CSV.");
      return;
    }

    setStatus("ok", `Loaded ${rows.length.toLocaleString()} row(s). Delimiter detected: "${delimiter}"`);

    // Seed auto-map with last saved mapping (if any)
    const savedDefaults: Partial<Mapping> | null = (() => {
      try { return JSON.parse(localStorage.getItem("oc:lastMapping") || "null"); }
      catch { return null; }
    })();

    const guess = autoMapHeaders(headers, savedDefaults ?? undefined);
    const mapping = await ensureMappingViaDrawer(headers, rows, guess);
    try { localStorage.setItem("oc:lastMapping", JSON.stringify(mapping)); } catch {}

    const normalized = normalizeRows(headers, rows, mapping);
    if (normalized.length === 0) {
      setStatus("err", "Mapping applied, but no valid rows were produced (check required fields).");
      return;
    }

    // Store and show components modal (not inline)
    lastParts = normalized.slice();
    setStatus("ok", `Mapped to ${lastParts.length.toLocaleString()} part(s).`);
    openComponentsModal(lastParts);
  } catch (err: any) {
    console.error(err);
    setStatus("err", `Failed to read CSV: ${err?.message ?? err}`);
  }
}

/* --------------------------- PACKING + RENDERING -------------------------- */

async function repackAndRender() {
  const boards = getBoards();
  console.debug("[main] repackAndRender boards:", boards.length, boards.slice(0, 2));

  if (!boards.length) {
    setStatus("err", "No boards loaded. Upload your Master Materials CSV first.");
    console.warn("packPartsToSheets aborted: no boards in state.");
    return;
  }
  if (!lastParts.length) {
    setStatus("err", "No parts loaded. Upload your Cutting List CSV.");
    console.warn("packPartsToSheets aborted: no parts.");
    return;
  }

  const s = getSettings();

  // Deterministic pre-fit check
  const fitsAnyBoard = (p: NestablePart, bs: typeof boards, margin: number) => {
    for (const b of bs) {
      const wA = Math.max(0, (b.width ?? 0)  - 2 * margin);
      const hA = Math.max(0, (b.height ?? 0) - 2 * margin);
      if ((p.w <= wA && p.h <= hA) || (p.h <= wA && p.w <= hA)) return true;
    }
    return false;
  };

  const offenders = lastParts.filter(p => !fitsAnyBoard(p, boards, s.margin));
  if (offenders.length === lastParts.length) {
    const show = offenders.slice(0, 6).map(p => `${p.name ?? p.id ?? "part"} (${Math.round(p.w)}×${Math.round(p.h)})`);
    const boardSamples = boards.slice(0, 3).map(b => `${Math.round(b.width)}×${Math.round(b.height)}`);
    setStatus(
      "err",
      `No parts physically fit any board (mm). Examples: ${show.join(", ")}. Boards: ${boardSamples.join(", ")}. ` +
      `Check Length/Width mapping and margins.`
    );
    console.warn("[main] deterministic fit check failed (mm).", {
      margin: s.margin, sampleBoards: boards.slice(0, 3), sampleParts: offenders.slice(0, 6),
    });
    return;
  }

  const tryPack = (parts: NestablePart[], ignoreTags: boolean): PackResult => {
    const P = ignoreTags ? parts.map(p => ({ ...p, materialTag: undefined })) : parts;
    return packPartsToSheets(boards, P, {
      kerf: s.kerf,
      margin: s.margin,
      heuristic: "BSSF",
      fallbackThreshold: 0.65,
    });
  };

  const flattenPack = (p: PackResult): SheetLayout[] => {
    if (hasByMaterial(p)) return (Object.values(p.byMaterial) as SheetLayout[][]).flat();
    if (hasSheets(p))     return (p as import("./nesting/types").PackResultFlat).sheets;
    return [];
  };

  let pack = tryPack(lastParts, false);
  let flatSheets = flattenPack(pack);
  if (flatSheets.length === 0) {
    setStatus("neutral", "No placements with material matching; retrying without material tags…");
    console.warn("[main] no sheets with tags; retrying without tags");
    pack = tryPack(lastParts, true);
    flatSheets = flattenPack(pack);
  }

  lastPack = pack;

  if (flatSheets.length) {
    console.debug("[main] flatSheets:", flatSheets.length);
    setStatus("ok", `Generated ${flatSheets.length} sheet(s).`);
    emit(Events.LAYOUTS_READY, { sheets: flatSheets });
  } else {
    const stillTooBig = lastParts
      .filter(p => !fitsAnyBoard(p, boards, s.margin))
      .slice(0, 6)
      .map(p => `${p.name ?? p.id ?? "part"} (${Math.round(p.w)}×${Math.round(p.h)})`);
    const msg = stillTooBig.length
      ? `No sheets produced. These items don't fit: ${stillTooBig.join(", ")}. Check mm sizes & mapping.`
      : `No sheets produced. Likely all placements blocked by tags or board copies=0. ` +
        `Try ensuring Material Tag matches or set Copies>0 for at least one board.`;
    setStatus("err", msg);
    console.warn("[main] packing yielded 0 sheets, diagnostics:", {
      boards: boards.slice(0, 3), parts: lastParts.slice(0, 6), margin: s.margin, kerf: s.kerf,
    });
  }
}

/* ----------------------------- COMPONENTS MODAL --------------------------- */

function openComponentsModal(parts: NestablePart[]) {
  // Remove any existing
  document.querySelectorAll("#oc-components-overlay").forEach((n) => n.remove());

  const overlay = document.createElement("div");
  overlay.id = "oc-components-overlay";
  overlay.style.position = "fixed";
  overlay.style.inset = "0";
  overlay.style.zIndex = "2147483200";
  overlay.style.background = "rgba(15,23,42,0.35)";
  overlay.style.display = "grid";
  overlay.style.placeItems = "center";

  const modal = document.createElement("div");
  modal.style.width = "min(1200px, 96vw)";
  modal.style.height = "min(90vh, 900px)";
  modal.style.background = "#ffffff";
  modal.style.borderRadius = "12px";
  modal.style.boxShadow = "0 40px 100px rgba(0,0,0,0.45)";
  modal.style.display = "grid";
  modal.style.gridTemplateRows = "auto 1fr auto";
  modal.style.gap = "10px";
  modal.style.padding = "12px";

  const header = document.createElement("div");
  header.style.display = "flex";
  header.style.alignItems = "center";
  header.style.justifyContent = "space-between";
  header.style.gap = "8px";
  const h = document.createElement("h3");
  h.textContent = `Components (${parts.length.toLocaleString()})`;
  h.style.margin = "0";
  h.style.fontSize = "18px";
  h.style.fontWeight = "800";
  header.appendChild(h);

  const body = document.createElement("div");
  body.style.overflow = "auto";
  body.style.padding = "4px";
  body.appendChild(buildEditableComponentsTable(parts));

  const footer = document.createElement("div");
  footer.style.display = "flex";
  footer.style.justifyContent = "space-between";
  footer.style.gap = "8px";

  const left = document.createElement("div");
  left.style.display = "flex"; left.style.gap = "8px";
  const addBtn = pill("Add Component", () => addComponentRow(body, parts));
  left.append(addBtn);

  const right = document.createElement("div");
  right.style.display = "flex"; right.style.gap = "8px";
  const closeBtn = pill("Close", () => overlay.remove());
  const optimizeBtn = primary("Optimize →", async () => {
    overlay.remove();
    showSvgAfterPack = true; // tell LAYOUTS_READY handler to open SVG modal
    await repackAndRender();
  });
  right.append(closeBtn, optimizeBtn);

  footer.append(left, right);

  modal.append(header, body, footer);
  overlay.appendChild(modal);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
  window.addEventListener("keydown", function onEsc(e) {
    if (e.key === "Escape") { overlay.remove(); window.removeEventListener("keydown", onEsc); }
  });
  document.body.appendChild(overlay);
}

function buildEditableComponentsTable(parts: NestablePart[]) {
  // Compact, touch-friendly table with essential fields + Details button
  const table = document.createElement("table");
  table.style.width = "100%";
  table.style.borderCollapse = "separate";
  table.style.borderSpacing = "0 6px";

  const thead = document.createElement("thead");
  const trh = document.createElement("tr");
  const headers = ["Name", "Material", "Length", "Width", "Qty", ""];
  for (const label of headers) {
    const th = document.createElement("th");
    th.textContent = label;
    th.style.textAlign = "left";
    th.style.padding = "6px 8px";
    th.style.fontSize = "12px";
    th.style.color = "#334155";
    trh.appendChild(th);
  }
  thead.appendChild(trh);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  parts.forEach((p) => {
    const tr = document.createElement("tr");
    tr.style.background = "#f8fafc";
    tr.style.border = "1px solid #e5e7eb";

    const td = (content: HTMLElement | string) => {
      const cell = document.createElement("td");
      if (typeof content === "string") cell.textContent = content;
      else cell.appendChild(content);
      cell.style.padding = "6px 8px";
      cell.style.borderTop = "1px solid #e5e7eb";
      cell.style.borderBottom = "1px solid #e5e7eb";
      return cell;
    };

    const input = (val: string | number, type: "text" | "number" = "text", step?: string) => {
      const i = document.createElement("input");
      i.type = type;
      if (type === "number" && step) i.step = step;
      i.value = String(val ?? "");
      i.style.padding = "6px 8px";
      i.style.border = "1px solid #cbd5e1";
      i.style.borderRadius = "8px";
      i.style.width = "100%";
      i.addEventListener("change", () => {
        // live-update the part object
        // map fields by column order
        p.name = nameI.value || p.name;
        (p as any).materialTag = materialI.value || (p as any).materialTag;
        p.h = Number(lenI.value) || p.h;
        p.w = Number(widI.value) || p.w;
        (p as any).qty = Number(qtyI.value) || (p as any).qty || 1;
      });
      return i;
    };

    const nameI = input(p.name ?? p.id ?? "", "text");
    const materialI = input((p as any).materialTag ?? (p as any).material ?? "", "text");
    const lenI = input(p.h, "number", "1");
    const widI = input(p.w, "number", "1");
    const qtyI = input((p as any).qty ?? 1, "number", "1");

    const detailsBtn = document.createElement("button");
    detailsBtn.textContent = "Details";
    detailsBtn.style.padding = "6px 10px";
    detailsBtn.style.border = "1px solid #cbd5e1";
    detailsBtn.style.borderRadius = "8px";
    detailsBtn.style.background = "#fff";
    detailsBtn.style.cursor = "pointer";
    detailsBtn.onclick = () => openSvgPartActionModal(p, `list-${p.id ?? p.name ?? Math.random().toString(36).slice(2)}`);

    tr.append(
      td(nameI), td(materialI), td(lenI), td(widI), td(qtyI),
      td(detailsBtn)
    );
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  return table;
}

function addComponentRow(body: HTMLElement, parts: NestablePart[]) {
  const p: NestablePart = {
    id: `new-${Date.now()}`,
    name: "",
    w: 0,
    h: 0,
    qty: 1,
    materialTag: "",
  } as any;
  parts.push(p);
  // rebuild table
  body.innerHTML = "";
  body.appendChild(buildEditableComponentsTable(parts));
}

/* -------------------------------- SVG MODAL ------------------------------- */

function openSvgModal(sheets: SheetLayout[]) {
  document.querySelectorAll("#oc-svg-overlay").forEach((n) => n.remove());

  const overlay = document.createElement("div");
  overlay.id = "oc-svg-overlay";
  overlay.style.position = "fixed";
  overlay.style.inset = "0";
  overlay.style.background = "rgba(15,23,42,0.25)";
  overlay.style.zIndex = "2147483300";
  overlay.style.display = "grid";
  overlay.style.gridTemplateRows = "auto 1fr";
  overlay.style.backdropFilter = "blur(1px)";

  // Top bar with Back + material tabs + sheet buttons
  const topBar = document.createElement("div");
  topBar.style.display = "grid";
  topBar.style.gridTemplateColumns = "auto 1fr auto";
  topBar.style.alignItems = "center";
  topBar.style.gap = "8px";
  topBar.style.padding = "8px";
  topBar.style.background = "#ffffff";
  topBar.style.borderBottom = "1px solid #e5e7eb";

  const back = pill("← Back", () => {
    overlay.remove();
    openComponentsModal(lastParts);
  });
  topBar.appendChild(back);

  const tabs = document.createElement("div");
  tabs.style.display = "flex";
  tabs.style.gap = "6px";
  tabs.style.flexWrap = "wrap";
  const rightBox = document.createElement("div");
  rightBox.style.display = "flex";
  rightBox.style.gap = "6px";

  topBar.append(tabs, rightBox);

  const content = document.createElement("div");
  content.style.background = "#f3f4f6";
  content.style.display = "grid";
  content.style.gridTemplateColumns = "1fr";
  content.style.gridTemplateRows = "1fr";
  content.style.padding = "10px";

  // canvas area
  const frame = document.createElement("div");
  frame.style.background = "#ffffff";
  frame.style.border = "1px solid #cbd5e1";
  frame.style.borderRadius = "10px";
  frame.style.overflow = "hidden";
  frame.style.margin = "0 auto";
  frame.style.width = "min(96vw, 1400px)";
  frame.style.height = "min(78vh, 820px)"; // landscape container
  frame.style.display = "grid";
  frame.style.placeItems = "center";

  const mount = document.createElement("div");
  mount.style.width = "100%";
  mount.style.height = "100%";
  mount.style.display = "grid";
  mount.style.placeItems = "center";
  frame.appendChild(mount);

  content.appendChild(frame);

  overlay.append(topBar, content);
  overlay.addEventListener("click", (e) => {
    // click outside to close is disabled in this modal; only Back button
    // if (e.target === overlay) overlay.remove();
  });
  window.addEventListener("keydown", function onEsc(e) {
    if (e.key === "Escape") { overlay.remove(); window.removeEventListener("keydown", onEsc); }
  });

  // Group sheets by a material-ish key
  const groups = groupByMaterial(sheets);
  const keys = Object.keys(groups);
  let activeKey = keys[0] ?? "All";
  let activeIdx = 0;

  function renderTabs() {
    tabs.innerHTML = "";
    for (const k of keys) {
      const b = document.createElement("button");
      b.textContent = k;
      b.style.padding = "6px 10px";
      b.style.border = "1px solid #cbd5e1";
      b.style.borderRadius = "999px";
      b.style.background = k === activeKey ? "#3b82f6" : "#fff";
      b.style.color = k === activeKey ? "#fff" : "#334155";
      b.style.cursor = "pointer";
      b.onclick = () => {
        activeKey = k;
        activeIdx = 0;
        renderTabs();
        renderSheetButtons();
        draw();
      };
      tabs.appendChild(b);
    }
  }

  function renderSheetButtons() {
    rightBox.innerHTML = "";
    const arr = groups[activeKey] || [];
    arr.forEach((_s, i) => {
      const b = document.createElement("button");
      b.textContent = `Sheet ${i + 1}`;
      b.style.padding = "6px 10px";
      b.style.border = "1px solid #cbd5e1";
      b.style.borderRadius = "10px";
      b.style.background = i === activeIdx ? "#1f2937" : "#fff";
      b.style.color = i === activeIdx ? "#fff" : "#334155";
      b.style.cursor = "pointer";
      b.onclick = () => { activeIdx = i; draw(); renderSheetButtons(); };
      rightBox.appendChild(b);
    });
  }

  function draw() {
    mount.innerHTML = "";
    const arr = groups[activeKey] || [];
    const sheet = arr[activeIdx];
    if (!sheet) return;
    // Use direct single-sheet renderer for the modal
    const host = document.createElement("div");
    host.style.width = "100%";
    host.style.height = "100%";
    host.style.display = "grid";
    host.style.placeItems = "center";
    mount.appendChild(host);
    renderBoardSvg(host, sheet, activeIdx);
  }

  renderTabs();
  renderSheetButtons();
  draw();

  document.body.appendChild(overlay);
}

function groupByMaterial(sheets: SheetLayout[]): Record<string, SheetLayout[]> {
  const map: Record<string, SheetLayout[]> = {};
  for (const s of sheets) {
    const key =
      (s as any).materialTag ||
      (s as any).material ||
      (s as any).boardType ||
      (s as any).name ||
      "All";
    (map[key] ||= []).push(s);
  }
  return map;
}

/* ------------------------- small UI button helpers ------------------------ */

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
