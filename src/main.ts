// src/main.ts
import { parseCsv } from "./csv/parseCsv";
// NOTE: we no longer validate before mapping; mapping comes first
// import { validateRequiredColumns } from "./csv/validateRows";
import { normalizeRows, type Mapping } from "./csv/normalize";
import { openHeaderMapModal } from "./ui/modals/header-map-modal";

import { initSettingsUI } from "./ui/settings";
import { wireMaterialsUpload } from "./ui/materials-upload";

import { getBoards } from "./state/materials";
import { getSettings } from "./state/settings";

import { packPartsToSheets } from "./nesting/engine";
import type { PackResult, SheetLayout, NestablePart } from "./nesting/types";
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
  const entries = Object.entries(p as Record<string, unknown>);
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

/* --------------------- MAPPING VALIDATION AFTER MAPPER -------------------- */

function isMappingComplete(m: Mapping): { ok: boolean; missing: string[] } {
  const need = ["Name", "Material", "Length", "Width", "Qty"] as const;
  const missing = need.filter((k) => !m[k] || String(m[k]).trim() === "");
  return { ok: missing.length === 0, missing: missing as string[] };
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

    const savedDefaults = (() => {
      try { return JSON.parse(localStorage.getItem("oc:lastMapping") || "null"); }
      catch { return null; }
    })();

    // Map first, then validate the mapping itself
    openHeaderMapModal(
      headers,
      (mapping) => {
        try { localStorage.setItem("oc:lastMapping", JSON.stringify(mapping)); } catch {}

        const mv = isMappingComplete(mapping);
        if (!mv.ok) {
          setStatus("err", `Header mapping incomplete. Missing: ${mv.missing.join(", ")}`);
          return;
        }

        const normalized = normalizeRows(headers, rows, mapping);
        if (normalized.length === 0) {
          setStatus("err", "Mapping applied, but no valid rows were produced (check required fields).");
          return;
        }
        clearPreview();
        setStatus("ok", `Mapped to ${normalized.length.toLocaleString()} part(s).`);
        buildNormalizedPreview(normalized);
        lastParts = normalized;

        // Try to pack right away (will show "No boards" if materials not loaded yet)
        void repackAndRender();
      },
      savedDefaults ?? undefined,
      rows // (for future live preview UI)
    );
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
  let pack: PackResult;

  try {
    pack = packPartsToSheets(boards, lastParts, {
      kerf: s.kerf,
      margin: s.margin,
      heuristic: "BSSF",
      fallbackThreshold: 0.65,
    });
  } catch (e) {
    console.error("Packing failed:", e);
    setStatus("err","Packing failed — see console for details.");
    return;
  }

  lastPack = pack;

  let flatSheets: SheetLayout[] = [];
  if (hasByMaterial(pack)) {
    flatSheets = (Object.values(pack.byMaterial) as SheetLayout[][]).flat();
  } else if (hasSheets(pack)) {
    flatSheets = (pack as import("./nesting/types").PackResultFlat).sheets;
  }

  console.debug("[main] flatSheets:", flatSheets.length);
  if (flatSheets.length) {
    setStatus("ok", `Generated ${flatSheets.length} sheet(s).`);
    emit(Events.LAYOUTS_READY, { sheets: flatSheets });
  } else {
    setStatus("err", "No sheets produced. Check material tags and dimensions.");
  }
}
