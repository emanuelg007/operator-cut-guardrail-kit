console.log("BOOT: main.ts loaded");
// src/main.ts
import { parseCsv } from "./csv/parseCsv";
import { normalizeRows, type Mapping } from "./csv/normalize";
import { autoMapHeaders } from "./csv/autoMap";
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

/* ----------------------------- DOM REFS ----------------------------- */

// Cutting list
const fileInput = document.getElementById("fileInput") as HTMLInputElement | null;
const uploadBtn = document.getElementById("uploadBtn") as HTMLButtonElement | null;
const statusEl = document.getElementById("status") as HTMLDivElement | null;
const fileNameEl = document.getElementById("fileName") as HTMLSpanElement | null;

// Master materials
const materialsFileInput = document.getElementById("materialsFileInput") as HTMLInputElement | null;
const uploadMaterialsBtn = document.getElementById("uploadMaterialsBtn") as HTMLButtonElement | null;
const materialsStatusEl = document.getElementById("materialsStatus") as HTMLSpanElement | null;

// Legacy inline preview target (not used for list anymore; SVG can still mount here for dev)
const svgContainer = document.getElementById("board-svg")!;
const settingsContainer = document.getElementById("settings")!;

/* ------------------------- SETTINGS LAUNCHER ------------------------- */

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
      if (typeof ui?.openSettingsModal === "function") return void ui.openSettingsModal();
      if (typeof ui?.initSettingsUI === "function" && settingsContainer) {
        settingsContainer.style.display = "";
        return void ui.initSettingsUI(settingsContainer);
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
let showSvgAfterPack = false;

/* -------------------------------- HELPERS --------------------------------- */

function setStatus(type: "ok" | "err" | "neutral", msg: string) {
  if (!statusEl) return;
  statusEl.className = "status " + (type === "ok" ? "ok" : type === "err" ? "err" : "");
  statusEl.textContent = msg;
}
function showFileName(name: string) { if (fileNameEl) fileNameEl.textContent = name || "No file chosen"; }

/* -------------------------- PART ACTIONS MODAL -------------------------- */
function openSvgPartActionModal(p: NestablePart, pid: string) {
  const overlay = document.createElement("div");
  overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;z-index:10000;";

  const card = document.createElement("div");
  card.style.cssText = "width:min(640px,92vw);max-height:80vh;overflow:auto;background:#fff;border-radius:12px;box-shadow:0 20px 50px rgba(0,0,0,0.35);padding:16px;";

  const title = document.createElement("h3");
  title.textContent = `Component — ${p.name ?? p.id ?? ""}`;
  title.style.marginTop = "0";

  const table = document.createElement("table");
  table.style.width = "100%";
  table.style.borderCollapse = "collapse";
  const tbody = document.createElement("tbody");
  Object.entries(p as unknown as Record<string, unknown>).forEach(([k, v]) => {
    const tr = document.createElement("tr");
    const ktd = document.createElement("td");
    const vtd = document.createElement("td");
    ktd.textContent = k;
    const input = document.createElement("input");
    input.type = "text";
    input.value = String(v ?? "");
    input.style.cssText = "width:100%;padding:6px 8px;border:1px solid #cbd5e1;border-radius:8px;";
    input.onchange = () => ((p as any)[k] = input.value);
    vtd.appendChild(input);
    ktd.style.fontWeight = "600";
    ktd.style.width = "30%";
    for (const td of [ktd, vtd]) { td.style.borderBottom = "1px solid #eee"; td.style.padding = "6px 8px"; }
    tr.append(ktd, vtd);
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);

  const bar = document.createElement("div");
  bar.style.cssText = "display:flex;justify-content:flex-end;gap:8px;margin-top:12px;";
  const pill = (label: string, onClick: () => void) => {
    const b = document.createElement("button");
    b.type = "button"; b.textContent = label;
    b.style.cssText = "padding:6px 12px;border:1px solid #d1d5db;border-radius:8px;background:#fff;cursor:pointer;";
    b.onclick = onClick;
    return b;
  };

  const printBtn = pill("Print", () => {
    printLabelBrowser({
      id: (p as any).id, name: p.name,
      material: (p as any).material, materialTag: (p as any).materialTag,
      w: p.w, h: p.h, notes1: (p as any).notes1, notes2: (p as any).notes2,
    });
    markPrinted(pid);
    emit(Events.PART_STATUS_CHANGED, { pid, printed: true });
    overlay.remove();
  });

  const undoBtn = pill("Undo", () => {
    undoPrinted(pid);
    emit(Events.PART_STATUS_CHANGED, { pid, printed: false });
    overlay.remove();
  });

  const closeBtn = pill("Close", () => overlay.remove());
  bar.append(printBtn, undoBtn, closeBtn);

  card.append(title, table, bar);
  overlay.appendChild(card);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
  window.addEventListener("keydown", function onEsc(e) { if (e.key === "Escape") { overlay.remove(); window.removeEventListener("keydown", onEsc); } });

  document.body.appendChild(overlay);
}

/* --------------------- HEADER MAP (modal OR fallback) -------------------- */

type DrawerResolve = (m: Mapping) => void;

function buildFallbackMapDrawer(
  headers: string[],
  seed: Partial<Mapping> | undefined,
  onApply: DrawerResolve
) {
  const overlay = document.createElement("div");
  overlay.id = "header-map-fallback-overlay";
  overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.40);z-index:2147483000;";

  const panel = document.createElement("div");
  panel.style.cssText = "position:fixed;top:0;right:0;width:460px;height:100%;background:#fff;box-shadow:-8px 0 30px rgba(0,0,0,0.25);padding:16px;display:flex;flex-direction:column;gap:12px;";
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
    label.style.display = "grid"; label.style.gap = "6px";
    label.textContent = key;

    const sel = document.createElement("select");
    sel.style.cssText = "padding:6px 8px;border:1px solid #d1d5db;border-radius:8px;";

    const blank = document.createElement("option");
    blank.value = ""; blank.textContent = "(choose column)"; sel.appendChild(blank);

    for (const h of headers) {
      const opt = document.createElement("option");
      opt.value = h; opt.textContent = h; sel.appendChild(opt);
    }
    const preset = (seed?.[key] as string | undefined) ?? "";
    if (preset) sel.value = preset;

    selects[key] = sel; label.appendChild(sel); form.appendChild(label);
  }

  const bar = document.createElement("div");
  bar.style.cssText = "margin-top:8px;display:flex;gap:8px;justify-content:flex-end;";

  const cancel = document.createElement("button");
  cancel.type = "button"; cancel.textContent = "Cancel"; cancel.style.padding = "6px 10px";
  cancel.onclick = () => document.body.removeChild(overlay);

  const apply = document.createElement("button");
  apply.type = "button"; apply.textContent = "Apply";
  apply.style.cssText = "padding:6px 10px;border:1px solid #d1d5db;border-radius:8px;background:#fff;";
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
  // Prefer your modal if present
  if (typeof (_maybeModal as any) === "function") {
    return new Promise<Mapping>((resolve) => (_maybeModal as any)(headers, (m: Mapping) => resolve(m), guess, rows));
  }
  // Fallback drawer
  return new Promise<Mapping>((resolve) => buildFallbackMapDrawer(headers, guess, resolve));
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
  if (lastParts.length) void repackAndRender();
});

/* ----------------------------- SVG MOUNT/OVERLAY -------------------------- */

on(Events.LAYOUTS_READY, (payload) => {
  const { sheets = [] as SheetLayout[] } = payload ?? { sheets: [] as SheetLayout[] };
  // Keep dev inline mount alive (optional)
  if (svgContainer) {
    svgContainer.innerHTML = "";
    createBoardPager(svgContainer, sheets);
  }
  // Open overlay if Optimize flow requested
  if (showSvgAfterPack) {
    showSvgAfterPack = false;
    openSvgModal(sheets);
  }
});

/* --------------------- SVG → part actions popover wiring ------------------ */

on(Events.PART_CLICKED, ({ pid, part }: any) => {
  if (!pid || !part) return;
  openSvgPartActionModal(part, pid);
});
on(Events.PART_PRINT_REQUEST, ({ pid }: any) => {
  if (!pid) return;
  markPrinted(pid);
  emit(Events.PART_STATUS_CHANGED, { pid, printed: true });
});
on(Events.PART_UNDO_PRINT_REQUEST, ({ pid }: any) => {
  if (!pid) return;
  undoPrinted(pid);
  emit(Events.PART_STATUS_CHANGED, { pid, printed: false });
});
on(Events.PART_STATUS_CHANGED, ({ pid, printed }) => {
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

    // Store parts and open Components modal (no inline list)
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

  if (!boards.length) {
    setStatus("err", "No boards loaded. Upload your Master Materials CSV first.");
    return;
  }
  if (!lastParts.length) {
    setStatus("err", "No parts loaded. Upload your Cutting List CSV.");
    return;
  }

  const s = getSettings();

  // deterministic fit check
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
    setStatus("err", `No parts fit any board. Examples: ${show.join(", ")}. Boards: ${boardSamples.join(", ")}. Check Length/Width and margins.`);
    return;
  }

  const tryPack = (parts: NestablePart[], ignoreTags: boolean): PackResult => {
    const P = ignoreTags ? parts.map(p => ({ ...p, materialTag: undefined })) : parts;
    return packPartsToSheets(boards, P, {
      kerf: s.kerf, margin: s.margin, heuristic: "BSSF", fallbackThreshold: 0.65,
    });
  };

  const flattenPack = (p: PackResult): SheetLayout[] => {
    if (hasByMaterial(p)) return (Object.values(p.byMaterial) as SheetLayout[][]).flat();
    if (hasSheets(p))     return (p as import("./nesting/types").PackResultFlat).sheets;
    return [];
  };

  let pack = tryPack(lastParts, false);
  let flatSheets = flattenPack(pack);
  if (!flatSheets.length) {
    setStatus("neutral", "No placements with material matching; retrying without tags…");
    pack = tryPack(lastParts, true);
    flatSheets = flattenPack(pack);
  }

  lastPack = pack;

  if (flatSheets.length) {
    setStatus("ok", `Generated ${flatSheets.length} sheet(s).`);
    emit(Events.LAYOUTS_READY, { sheets: flatSheets });
  } else {
    setStatus("err", "No sheets produced. Likely blocked by tags or copies=0.");
  }
}

/* ----------------------------- COMPONENTS MODAL --------------------------- */

function openComponentsModal(parts: NestablePart[]) {
  // Replace any existing
  document.querySelectorAll("#oc-components-overlay").forEach((n) => n.remove());

  const overlay = document.createElement("div");
  overlay.id = "oc-components-overlay";
  overlay.style.cssText = "position:fixed;inset:0;z-index:2147483200;background:rgba(15,23,42,0.35);display:grid;place-items:center;";

  const modal = document.createElement("div");
  modal.style.cssText = "width:min(1200px,96vw);height:min(90vh,900px);background:#ffffff;border-radius:12px;box-shadow:0 40px 100px rgba(0,0,0,0.45);display:grid;grid-template-rows:auto 1fr auto;gap:10px;padding:12px;";

  const header = document.createElement("div");
  header.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:8px;";
  const h = document.createElement("h3");
  h.textContent = `Components (${parts.length.toLocaleString()})`;
  h.style.margin = "0"; h.style.fontSize = "18px"; h.style.fontWeight = "800";
  header.appendChild(h);

  const body = document.createElement("div");
  body.style.cssText = "overflow:auto;padding:4px;";
  body.appendChild(buildEditableTable(parts));

  const footer = document.createElement("div");
  footer.style.cssText = "display:flex;justify-content:space-between;gap:8px;";

  const left = document.createElement("div");
  left.style.cssText = "display:flex;gap:8px;";
  left.append(pill("Add Component", () => addComponentRow(body, parts)));

  const right = document.createElement("div");
  right.style.cssText = "display:flex;gap:8px;";
  right.append(
    pill("Close", () => overlay.remove()),
    primary("Optimize →", async () => { overlay.remove(); showSvgAfterPack = true; await repackAndRender(); })
  );

  footer.append(left, right);

  modal.append(header, body, footer);
  overlay.appendChild(modal);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
  window.addEventListener("keydown", function onEsc(e) { if (e.key === "Escape") { overlay.remove(); window.removeEventListener("keydown", onEsc); } });
  document.body.appendChild(overlay);
}

function mainColumnsFromParts(parts: NestablePart[]): string[] {
  // Ensure core editable columns + edging + notes
  const keys = new Set<string>();
  parts.slice(0, 50).forEach(p => Object.keys(p as any).forEach(k => keys.add(k)));
  const order = [
    "name","materialTag","material","h","w","qty","edging","edgeTop","edgeRight","edgeBottom","edgeLeft","notes1","notes2"
  ];
  const cols: string[] = [];
  for (const k of order) if (keys.has(k)) cols.push(k);
  // Ensure core exist even if missing
  for (const k of ["name","materialTag","h","w","qty","notes1","notes2"]) if (!cols.includes(k)) cols.push(k);
  return cols;
}

function buildEditableTable(parts: NestablePart[]) {
  const cols = mainColumnsFromParts(parts);

  const table = document.createElement("table");
  table.style.cssText = "width:100%;border-collapse:separate;border-spacing:0 6px;";

  const thead = document.createElement("thead");
  const trh = document.createElement("tr");
  for (const c of cols.concat([""])) {
    const th = document.createElement("th");
    th.textContent = c === "h" ? "Length" : c === "w" ? "Width" : c === "" ? "" : c[0].toUpperCase() + c.slice(1);
    th.style.cssText = "text-align:left;padding:6px 8px;font-size:12px;color:#334155;";
    trh.appendChild(th);
  }
  thead.appendChild(trh);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  parts.forEach((p) => {
    const tr = document.createElement("tr");
    tr.style.cssText = "background:#f8fafc;border:1px solid #e5e7eb;";

    const td = (content: HTMLElement | string) => {
      const cell = document.createElement("td");
      if (typeof content === "string") cell.textContent = content;
      else cell.appendChild(content);
      cell.style.cssText = "padding:6px 8px;border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;";
      return cell;
    };

    const makeInput = (key: string) => {
      const i = document.createElement("input");
      i.type = ["h","w","qty"].includes(key) ? "number" : "text";
      if (i.type === "number") i.step = key === "qty" ? "1" : "1";
      i.value = String((p as any)[key] ?? "");
      i.style.cssText = "padding:6px 8px;border:1px solid #cbd5e1;border-radius:8px;width:100%;";
      i.onchange = () => ((p as any)[key] = i.type === "number" ? Number(i.value || 0) : i.value);
      return i;
    };

    for (const c of cols) tr.appendChild(td(makeInput(c)));

    const detailsBtn = document.createElement("button");
    detailsBtn.textContent = "Details";
    detailsBtn.style.cssText = "padding:6px 10px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;cursor:pointer;";
    detailsBtn.onclick = () => openSvgPartActionModal(p, `list-${p.id ?? p.name ?? Math.random().toString(36).slice(2)}`);
    tr.appendChild(td(detailsBtn));

    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  return table;
}

function addComponentRow(body: HTMLElement, parts: NestablePart[]) {
  const p: NestablePart = {
    id: `new-${Date.now()}`, name: "", w: 0, h: 0, qty: 1, materialTag: "", notes1: "", notes2: "",
  } as any;
  parts.push(p);
  body.innerHTML = "";
  body.appendChild(buildEditableTable(parts));
}

/* -------------------------------- SVG OVERLAY ------------------------------ */

function openSvgModal(sheets: SheetLayout[]) {
  document.querySelectorAll("#oc-svg-overlay").forEach((n) => n.remove());

  const overlay = document.createElement("div");
  overlay.id = "oc-svg-overlay";
  overlay.style.cssText = "position:fixed;inset:0;background:rgba(15,23,42,0.25);z-index:2147483300;display:grid;grid-template-rows:auto 1fr;backdrop-filter:blur(1px);";

  // Top bar
  const topBar = document.createElement("div");
  topBar.style.cssText = "display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:8px;padding:8px;background:#ffffff;border-bottom:1px solid #e5e7eb;";

  const back = pill("← Back", () => { overlay.remove(); openComponentsModal(lastParts); });
  topBar.appendChild(back);

  const tabs = document.createElement("div");
  tabs.style.cssText = "display:flex;gap:6px;flex-wrap:wrap;";
  const rightBox = document.createElement("div");
  rightBox.style.cssText = "display:flex;gap:6px;";
  topBar.append(tabs, rightBox);

  const content = document.createElement("div");
  content.style.cssText = "background:#f3f4f6;display:grid;grid-template-columns:1fr;grid-template-rows:1fr;padding:10px;";

  const frame = document.createElement("div");
  frame.style.cssText = "background:#ffffff;border:1px solid #cbd5e1;border-radius:10px;overflow:hidden;margin:0 auto;width:min(96vw,1400px);height:min(78vh,820px);display:grid;place-items:center;";
  const mount = document.createElement("div");
  mount.style.cssText = "width:100%;height:100%;display:grid;place-items:center;";
  frame.appendChild(mount);
  content.appendChild(frame);

  overlay.append(topBar, content);
  document.body.appendChild(overlay);

  // Group by material-ish key
  const groups = groupByMaterial(sheets);
  const keys = Object.keys(groups);
  let activeKey = keys[0] ?? "All";
  let activeIdx = 0;

  function renderTabs() {
    tabs.innerHTML = "";
    for (const k of keys) {
      const b = document.createElement("button");
      b.textContent = k;
      b.style.cssText = `padding:6px 10px;border:1px solid #cbd5e1;border-radius:999px;cursor:pointer;${k===activeKey?"background:#3b82f6;color:#fff;":"background:#fff;color:#334155;"}`;
      b.onclick = () => { activeKey = k; activeIdx = 0; renderTabs(); renderSheetButtons(); draw(); };
      tabs.appendChild(b);
    }
  }

  function renderSheetButtons() {
    rightBox.innerHTML = "";
    const arr = groups[activeKey] || [];
    arr.forEach((_s, i) => {
      const b = document.createElement("button");
      b.textContent = `Sheet ${i + 1}`;
      b.style.cssText = `padding:6px 10px;border:1px solid #cbd5e1;border-radius:10px;cursor:pointer;${i===activeIdx?"background:#1f2937;color:#fff;":"background:#fff;color:#334155;"}`;
      b.onclick = () => { activeIdx = i; draw(); renderSheetButtons(); };
      rightBox.appendChild(b);
    });
  }

  function draw() {
    mount.innerHTML = "";
    const arr = groups[activeKey] || [];
    const sheet = arr[activeIdx];
    if (!sheet) return;
    const host = document.createElement("div");
    host.style.cssText = "width:100%;height:100%;display:grid;place-items:center;";
    mount.appendChild(host);
    renderBoardSvg(host, sheet, activeIdx);
  }

  renderTabs();
  renderSheetButtons();
  draw();
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
  b.style.cssText = "padding:8px 12px;border:1px solid #cbd5e1;border-radius:999px;cursor:pointer;background:#fff;color:#334155;";
  b.onclick = onClick;
  return b;
}
function primary(label: string, onClick: () => void) {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = label;
  b.style.cssText = "padding:8px 14px;border:1px solid #60a5fa;border-radius:10px;cursor:pointer;background:linear-gradient(180deg,#93c5fd,#3b82f6);color:#fff;font-weight:700;";
  b.onclick = onClick;
  return b;
}

// Explicit navbar init (defensive)
import { initNavbar } from "./ui/navbar";
if (typeof window !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => initNavbar(), { once: true });
  } else {
    initNavbar();
  }
}
