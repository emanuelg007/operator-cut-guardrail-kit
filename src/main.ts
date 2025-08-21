// src/main.ts
import { parseCsv } from "./csv/parseCsv";
import { normalizeRows, type Mapping } from "./csv/normalize";
import { autoMapHeaders, mappingMissing } from "./csv/autoMap";
// If your modal exists we will use it; if the import fails, our fallback UI kicks in.
import { openHeaderMapModal as _maybeModal } from "./ui/modals/header-map-modal";

import { initSettingsUI } from "./ui/settings";
import { wireMaterialsUpload } from "./ui/materials-upload";

import { getBoards } from "./state/materials";
import { getSettings } from "./state/settings";

import { packPartsToSheets } from "./nesting/engine";
import type { PackResult, SheetLayout, NestablePart, BoardSpec } from "./nesting/types";
import { hasByMaterial, hasSheets } from "./nesting/types";

import { createBoardPager } from "./render/boardSvg";
import { on, emit, Events } from "./events";

/* ----------------------------- DOM REFERENCES ----------------------------- */

// Cutting list
const fileInput = document.getElementById("fileInput") as HTMLInputElement | null;
const uploadBtn = document.getElementById("uploadBtn") as HTMLButtonElement | null;
const statusEl = document.getElementById("status") as HTMLDivElement | null;
const previewEl = document.getElementById("preview") as HTMLDivElement | null;
const fileNameEl = document.getElementById("fileName") as HTMLSpanElement | null;

// Master materials
const materialsFileInput = document.getElementById("materialsFileInput") as HTMLInputElement | null;
const uploadMaterialsBtn = document.getElementById("uploadMaterialsBtn") as HTMLButtonElement | null;
const materialsStatusEl = document.getElementById("materialsStatus") as HTMLSpanElement | null;

// Render targets
const svgContainer = document.getElementById("board-svg")!;
const settingsContainer = document.getElementById("settings")!;
initSettingsUI(settingsContainer);

/* --------------------------------- STATE ---------------------------------- */

let pendingFile: File | null = null;
let lastParts: NestablePart[] = [];
let lastPack: PackResult | null = null;

/* -------------------------------- HELPERS --------------------------------- */

function setStatus(type: "ok" | "err" | "neutral", msg: string) {
  if (!statusEl) return;
  statusEl.className = "status " + (type === "ok" ? "ok" : type === "err" ? "err" : "");
  statusEl.textContent = msg;
}
function showFileName(name: string) { if (fileNameEl) fileNameEl.textContent = name || "No file chosen"; }
function clearPreview() { if (previewEl) previewEl.innerHTML = ""; }

function buildRawPreview(headers: string[], rows: string[][]) {
  if (!previewEl) return;
  const maxRows = Math.min(15, rows.length);
  const table = document.createElement("table");

  const thead = document.createElement("thead");
  const trh = document.createElement("tr");
  headers.forEach((h) => {
    const th = document.createElement("th");
    th.textContent = h;
    trh.appendChild(th);
  });
  thead.appendChild(trh);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  for (let i = 0; i < maxRows; i++) {
    const tr = document.createElement("tr");
    (rows[i] ?? []).forEach((cell) => {
      const td = document.createElement("td");
      td.textContent = cell ?? "";
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);

  const h3 = document.createElement("h3");
  h3.textContent = "Raw preview (first 15 rows)";
  previewEl!.appendChild(h3);
  previewEl!.appendChild(table);
}

function buildNormalizedPreview(parts: NestablePart[]) {
  if (!previewEl) return;
  const max = Math.min(200, parts.length);
  const wrap = document.createElement("div");
  wrap.id = "componentList";
  wrap.style.maxWidth = "calc(100vw - 560px)";
  wrap.style.margin = "8px 12px";
  wrap.style.overflow = "auto";

  const h3 = document.createElement("h3");
  h3.textContent = `Component List (${parts.length.toLocaleString()} items)`;
  wrap.appendChild(h3);

  const table = document.createElement("table");
  table.style.width = "100%";
  table.style.borderCollapse = "collapse";

  const headers = ["Name","Material","Length","Width","Qty",""] as const;
  const thead = document.createElement("thead");
  const trh = document.createElement("tr");
  headers.forEach((h) => {
    const th = document.createElement("th");
    th.textContent = h || "";
    th.style.textAlign = "left";
    th.style.borderBottom = "1px solid #ddd";
    th.style.padding = "6px 8px";
    trh.appendChild(th);
  });
  thead.appendChild(trh);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  for (let i = 0; i < max; i++) {
    const p = parts[i];
    const tr = document.createElement("tr");
    const cells = [
      p.name ?? "",
      p.materialTag ?? p.material ?? "",
      String(p.h),
      String(p.w),
      String(p.qty ?? 0),
    ];
    for (const val of cells) {
      const td = document.createElement("td");
      td.textContent = val;
      td.style.borderBottom = "1px solid #eee";
      td.style.padding = "6px 8px";
      tr.appendChild(td);
    }
    const tdBtn = document.createElement("td");
    tdBtn.style.borderBottom = "1px solid #eee";
    tdBtn.style.padding = "6px 8px";
    const btn = document.createElement("button");
    btn.textContent = "Details";
    btn.style.padding = "4px 10px";
    btn.style.border = "1px solid #d1d5db";
    btn.style.borderRadius = "8px";
    btn.style.background = "#fff";
    btn.style.cursor = "pointer";
    btn.onclick = () => openPartDetails(p);
    tdBtn.appendChild(btn);
    tr.appendChild(tdBtn);

    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  wrap.appendChild(table);

  previewEl!.appendChild(wrap);
}

function openPartDetails(p: NestablePart) {
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
  title.textContent = `Details — ${p.name ?? p.id ?? ""}`;
  title.style.marginTop = "0";

  const table = document.createElement("table");
  table.style.width = "100%";
  table.style.borderCollapse = "collapse";

  const tbody = document.createElement("tbody");
  const entries = Object.entries(p as unknown as Record<string, unknown>);
  for (const [k, v] of entries) {
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
    tr.appendChild(ktd);
    tr.appendChild(vtd);
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);

  const bar = document.createElement("div");
  bar.style.display = "flex";
  bar.style.justifyContent = "flex-end";
  bar.style.gap = "8px";
  bar.style.marginTop = "12px";

  const close = document.createElement("button");
  close.textContent = "Close";
  close.style.padding = "6px 12px";
  close.style.border = "1px solid #d1d5db";
  close.style.borderRadius = "8px";
  close.style.background = "#fff";
  close.style.cursor = "pointer";
  close.onclick = () => document.body.removeChild(overlay);

  bar.appendChild(close);

  card.appendChild(title);
  card.appendChild(table);
  card.appendChild(bar);

  overlay.appendChild(card);
  document.body.appendChild(overlay);
}

/* -------------- FALLBACK HEADER-MAP DRAWER (if module is missing) -------- */

type DrawerResolve = (m: Mapping) => void;

function buildFallbackMapDrawer(
  headers: string[],
  seed: Partial<Mapping> | undefined,
  onApply: DrawerResolve
) {
  // basic right-docked drawer
  const overlay = document.createElement("div");
  overlay.style.position = "fixed";
  overlay.style.inset = "0";
  overlay.style.background = "rgba(0,0,0,0.25)";
  overlay.style.zIndex = "9998";

  const panel = document.createElement("div");
  panel.style.position = "fixed";
  panel.style.top = "0";
  panel.style.right = "0";
  panel.style.width = "420px";
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
    // preselect
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

  bar.appendChild(cancel);
  bar.appendChild(apply);

  panel.appendChild(title);
  panel.appendChild(form);
  panel.appendChild(bar);

  overlay.onclick = (e) => {
    if (e.target === overlay) document.body.removeChild(overlay);
  };
  overlay.appendChild(panel);
  document.body.appendChild(overlay);
}

async function ensureMappingViaDrawer(
  headers: string[],
  rows: string[][],
  guess: Partial<Mapping>
): Promise<Mapping> {
  const forceDrawer = new URLSearchParams(location.search).get("map") !== "0";

  // prefer your real modal if available and drawer requested
  if (forceDrawer && typeof (_maybeModal as any) === "function") {
    return new Promise<Mapping>((resolve) => {
      (_maybeModal as any)(headers, (m: Mapping) => resolve(m), guess, rows);
    });
  }

  // fallback drawer (or silent auto-map if ?map=0 and guess complete)
  const missing = mappingMissing(guess);
  if (!forceDrawer && missing.length === 0) {
    return guess as Mapping;
  }

  return new Promise<Mapping>((resolve) => {
    buildFallbackMapDrawer(headers, guess, resolve);
  });
}

/* ------------------------ MATERIALS UPLOAD + AUTOPACK --------------------- */

if (materialsFileInput && uploadMaterialsBtn && materialsStatusEl) {
  wireMaterialsUpload(materialsFileInput, uploadMaterialsBtn, materialsStatusEl);
}

on(Events.MATERIALS_LOADED, ({ count }: { count: number }) => {
  if (materialsStatusEl) {
    materialsStatusEl.className = "status ok";
    materialsStatusEl.textContent = `Loaded ${count} board row(s).`;
  }
  console.debug("[main] materials loaded:", count);
  if (lastParts.length) {
    console.debug("[main] parts already loaded; repacking now…");
    void repackAndRender();
  }
});

/* ----------------------------- SVG PAGER WIRING --------------------------- */

on(Events.LAYOUTS_READY, (payload: { sheets: SheetLayout[] }) => {
  console.debug("[main] layouts ready:", payload.sheets.length);
  createBoardPager(svgContainer, payload.sheets);
});

/* --------------------------------- WIRING --------------------------------- */

// Cutting list
fileInput?.addEventListener("change", () => {
  pendingFile = fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;
  showFileName(pendingFile ? pendingFile.name : "No file chosen");
});
uploadBtn?.addEventListener("click", () => {
  void handleCuttingList(pendingFile ?? (fileInput && fileInput.files ? fileInput.files[0] : null));
});

/* ----------------------------- MAIN PROCESSING ---------------------------- */

async function handleCuttingList(file: File | null) {
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
    buildRawPreview(headers, rows);

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
    clearPreview();
    setStatus("ok", `Mapped to ${normalized.length.toLocaleString()} part(s).`);
    buildNormalizedPreview(normalized);
    lastParts = normalized;

    void repackAndRender();
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

  const s = getSettings(); // kerf, margin, etc. — all in mm

  // --- Deterministic pre-fit check (NO unit guessing) ----------------------
  const fitsAnyBoard = (p: NestablePart, bs: typeof boards, margin: number) => {
    for (const b of bs) {
      const wA = Math.max(0, (b.width ?? 0)  - 2 * margin);
      const hA = Math.max(0, (b.height ?? 0) - 2 * margin);
      // allow rotation
      if ((p.w <= wA && p.h <= hA) || (p.h <= wA && p.w <= hA)) return true;
    }
    return false;
  };

  const offenders = lastParts.filter(p => !fitsAnyBoard(p, boards, s.margin));
  if (offenders.length === lastParts.length) {
    // Nothing fits even with rotation: give concrete examples and bail early
    const show = offenders.slice(0, 6).map(p => `${p.name ?? p.id ?? "part"} (${Math.round(p.w)}×${Math.round(p.h)})`);
    const boardSamples = boards.slice(0, 3).map(b => `${Math.round(b.width)}×${Math.round(b.height)}`);
    setStatus(
      "err",
      `No parts physically fit any board (mm). Examples: ${show.join(", ")}. Boards: ${boardSamples.join(", ")}. ` +
      `Check Length/Width mapping and margins.`
    );
    console.warn("[main] deterministic fit check failed (mm).", {
      margin: s.margin,
      sampleBoards: boards.slice(0, 3),
      sampleParts: offenders.slice(0, 6),
    });
    return;
  }

  // --- Pack (two-pass: with material tags, then without) -------------------
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
    // Final, specific diagnostics
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
      boards: boards.slice(0, 3),
      parts: lastParts.slice(0, 6),
      margin: s.margin,
      kerf: s.kerf,
    });
  }
}


/* ------------------------ MATERIALS UPLOAD WIRING ------------------------- */

if (materialsFileInput && uploadMaterialsBtn && materialsStatusEl) {
  wireMaterialsUpload(materialsFileInput, uploadMaterialsBtn, materialsStatusEl);
}
on(Events.MATERIALS_LOADED, ({ count }: { count: number }) => {
  if (materialsStatusEl) {
    materialsStatusEl.className = "status ok";
    materialsStatusEl.textContent = `Loaded ${count} board row(s).`;
  }
  console.debug("[main] materials loaded:", count);
  if (lastParts.length) void repackAndRender();
});

/* ----------------------------- SVG PAGER WIRING --------------------------- */

on(Events.LAYOUTS_READY, (payload: { sheets: SheetLayout[] }) => {
  console.debug("[main] layouts ready:", payload.sheets.length);
  createBoardPager(svgContainer, payload.sheets);
});

/* --------------------------------- WIRING --------------------------------- */

fileInput?.addEventListener("change", () => {
  pendingFile = fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;
  showFileName(pendingFile ? pendingFile.name : "No file chosen");
});
uploadBtn?.addEventListener("click", () => {
  void handleCuttingList(pendingFile ?? (fileInput && fileInput.files ? fileInput.files[0] : null));
});
