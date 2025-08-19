// src/main.ts
import { getBoards, setBoards } from "./state/materials";
import { parseCsv } from "./csv/parseCsv";
import { validateRequiredColumns } from "./csv/validateRows";
// If you created the helper (recommended), keep this import:
import { materialsRowsToBoards } from "./materials/toBoards";

import { openHeaderMapModal } from "./ui/modals/header-map-modal";
import { normalizeRows, type NormalizedPart } from "./csv/normalize";
import { packPartsToSheets } from "./nesting/engine";
import type { PackResult, SheetLayout } from "./nesting/types";
import { createBoardPager } from "./render/boardSvg";
import { on, emit, Events } from "./events";
import { initSettingsUI } from "./ui/settings";
import "./styles/app.css";

/** Ensure the Master Materials controls exist and are wired IDs we expect. */
function ensureMaterialsControls() {
  const settings = document.getElementById("settings");
  // Create a visible button in #settings
  if (settings && !document.getElementById("uploadMaterialsBtn")) {
    const wrap = document.createElement("div");
    wrap.style.display = "flex";
    wrap.style.alignItems = "center";
    wrap.style.gap = "8px";
    wrap.style.margin = "8px 0";

    const btn = document.createElement("button");
    btn.id = "uploadMaterialsBtn";
    btn.type = "button";
    btn.textContent = "Upload Master Materials (CSV)";
    btn.style.padding = "6px 10px";
    btn.style.border = "1px solid #d1d5db";
    btn.style.borderRadius = "8px";
    btn.style.background = "#fff";
    btn.style.cursor = "pointer";

    const status = document.createElement("span");
    status.id = "materialsStatus";
    status.style.fontSize = "12px";
    status.style.color = "#374151";

    wrap.appendChild(btn);
    wrap.appendChild(status);
    settings.prepend(wrap);
  }
  // Hidden file input lives in <body> so it can be clicked from anywhere
  if (!document.getElementById("materialsFileInput")) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv,text/csv";
    input.id = "materialsFileInput";
    input.style.display = "none";
    document.body.appendChild(input);
  }
}


/* ----------------------------- DOM REFERENCES ----------------------------- */

// Cutting list
const fileInput = document.getElementById("fileInput") as HTMLInputElement | null;
const uploadBtn = document.getElementById("uploadBtn") as HTMLButtonElement | null;
const statusEl = document.getElementById("status") as HTMLDivElement | null;
const previewEl = document.getElementById("preview") as HTMLDivElement | null;
const fileNameEl = document.getElementById("fileName") as HTMLSpanElement | null;

// Master materials
ensureMaterialsControls();
// Master materials (ensure exists, then query)
const materialsFileInput = document.getElementById("materialsFileInput") as HTMLInputElement | null;
const uploadMaterialsBtn = document.getElementById("uploadMaterialsBtn") as HTMLButtonElement | null;
const materialsStatusEl = document.getElementById("materialsStatus") as HTMLSpanElement | null;


// Render targets
const svgContainer = document.getElementById("board-svg") as HTMLElement | null;
const settingsContainer = document.getElementById("settings") as HTMLElement | null;

/* --------------------------------- INIT ----------------------------------- */

if (settingsContainer) initSettingsUI(settingsContainer);

// Ensure board area shows a placeholder so it has height immediately
if (svgContainer && svgContainer.children.length === 0) {
  svgContainer.innerHTML = `<div class="empty-state">No sheets yet — upload Master Materials and a cutting list.</div>`;
}

// Render in-page pager when layouts are ready
on(Events.LAYOUTS_READY, (payload: { sheets: SheetLayout[] }) => {
  if (!svgContainer) return;
  svgContainer.innerHTML = "";
  createBoardPager(svgContainer, payload.sheets);
});

/* --------------------------------- STATE ---------------------------------- */

let pendingFile: File | null = null;
let pendingMaterialsFile: File | null = null;
let lastPack: PackResult | null = null;

/* -------------------------------- HELPERS --------------------------------- */

function setStatus(type: "ok" | "err" | "neutral", msg: string) {
  if (!statusEl) return;
  statusEl.className = "status " + (type === "ok" ? "ok" : type === "err" ? "err" : "");
  statusEl.textContent = msg;
}
function setMaterialsStatus(type: "ok" | "err" | "neutral", msg: string) {
  if (!materialsStatusEl) return;
  materialsStatusEl.className = "status " + (type === "ok" ? "ok" : type === "err" ? "err" : "");
  materialsStatusEl.textContent = msg;
}
function showFileName(name: string) { if (fileNameEl) fileNameEl.textContent = name || "No file chosen"; }
function clearPreview() { if (previewEl) previewEl.innerHTML = ""; }

function readNumberByIds(ids: string[], def = 0): number {
  for (const id of ids) {
    const el = document.getElementById(id) as HTMLInputElement | null;
    if (el && el.value !== "") {
      const v = parseFloat(el.value);
      if (!Number.isNaN(v)) return v;
    }
  }
  return def;
}

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

function buildNormalizedPreview(parts: NormalizedPart[]) {
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

  const headers = ["Name","Material","Length","Width","Qty","Note1","Note2",""] as const;
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
      p.Name,
      p.Material,
      String(p.Length),
      String(p.Width),
      String(p.Qty),
      p.Note1 ?? "",
      p.Note2 ?? "",
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

function openPartDetails(p: NormalizedPart) {
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
  title.textContent = `Details — ${p.Name}`;
  title.style.marginTop = "0";

  const table = document.createElement("table");
  table.style.width = "100%";
  table.style.borderCollapse = "collapse";

  const tbody = document.createElement("tbody");
  for (const [k, v] of Object.entries(p)) {
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

/* --------------------- SHEET CONTROLS & MODAL (SVG render) ---------------- */

function buildSheetControls(pack: PackResult, host: HTMLElement) {
  host.innerHTML = "";

  const mats = Object.keys(pack.byMaterial);
  const matSel = document.createElement("select");
  mats.forEach((m) => {
    const o = document.createElement("option");
    o.value = m;
    o.textContent = m;
    matSel.appendChild(o);
  });

  const sheetSel = document.createElement("select");
  const ctrlBar = document.createElement("div");
  ctrlBar.style.display = "flex";
  ctrlBar.style.gap = "8px";
  ctrlBar.style.marginBottom = "8px";
  ctrlBar.style.alignItems = "center";

  const svgWrap = document.createElement("div");

  function draw() {
    const m = matSel.value;
    const sIdx = Number(sheetSel.value || 0);
    const sheet = (pack.byMaterial[m] ?? [])[sIdx];
    if (!sheet) return;
    svgWrap.innerHTML = "";
    // Reuse the same pager renderer for consistency (single-sheet pager)
    createBoardPager(svgWrap, [sheet]);
  }
  function refreshSheets() {
    const m = matSel.value;
    const sheets = pack.byMaterial[m] ?? [];
    sheetSel.innerHTML = "";
    sheets.forEach((_, i) => {
      const o = document.createElement("option");
      o.value = String(i);
      o.textContent = `Sheet ${i + 1} / ${sheets.length}`;
      sheetSel.appendChild(o);
    });
    draw();
  }

  matSel.addEventListener("change", refreshSheets);
  sheetSel.addEventListener("change", draw);

  ctrlBar.append("Material:", matSel, "Sheet:", sheetSel);
  host.appendChild(ctrlBar);
  host.appendChild(svgWrap);

  if (mats.length) {
    matSel.value = mats[0];
    refreshSheets();
  } else {
    host.innerHTML = "<p style='margin:8px;color:#b91c1c'>No sheets produced.</p>";
  }
}

function openSheetsModal(pack: PackResult) {
  const overlay = document.createElement("div");
  overlay.style.position = "fixed";
  overlay.style.inset = "0";
  overlay.style.background = "rgba(0,0,0,0.35)";
  overlay.style.display = "flex";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";
  overlay.style.zIndex = "10000";

  const panel = document.createElement("div");
  panel.style.width = "min(1100px, 92vw)";
  panel.style.maxHeight = "90vh";
  panel.style.background = "#fff";
  panel.style.borderRadius = "12px";
  panel.style.boxShadow = "0 24px 70px rgba(0,0,0,0.35)";
  panel.style.padding = "12px";
  panel.style.display = "grid";
  panel.style.gridTemplateRows = "auto 1fr";
  panel.style.gap = "8px";

  const topBar = document.createElement("div");
  topBar.style.display = "flex";
  topBar.style.alignItems = "center";
  topBar.style.justifyContent = "space-between";
  topBar.style.gap = "8px";

  const title = document.createElement("strong");
  title.textContent = "Sheets Preview";

  const close = document.createElement("button");
  close.textContent = "× Close";
  close.style.border = "1px solid #d1d5db";
  close.style.borderRadius = "8px";
  close.style.background = "#fff";
  close.style.cursor = "pointer";
  close.style.padding = "6px 10px";
  close.onclick = () => document.body.removeChild(overlay);

  topBar.appendChild(title);
  topBar.appendChild(close);

  const host = document.createElement("div");
  host.style.overflow = "auto";
  host.style.minHeight = "0";

  panel.appendChild(topBar);
  panel.appendChild(host);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  buildSheetControls(pack, host);

  const onEsc = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      document.body.removeChild(overlay);
      window.removeEventListener("keydown", onEsc);
    }
  };
  window.addEventListener("keydown", onEsc);
}

/* ----------------------------- MAIN PROCESSING ----------------------------- */

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

    const res = validateRequiredColumns(headers);
    if (!res.ok) {
      setStatus("err", `Missing required column(s): ${res.missing!.join(", ")}`);
      buildRawPreview(headers, rows);
      return;
    }

    setStatus("ok", `Loaded ${rows.length.toLocaleString()} row(s). Delimiter detected: "${delimiter}"`);
    buildRawPreview(headers, rows);

    const savedDefaults = (() => {
      try { return JSON.parse(localStorage.getItem("oc:lastMapping") || "null"); }
      catch { return null; }
    })();

    openHeaderMapModal(
      headers,
      (mapping) => {
        try { localStorage.setItem("oc:lastMapping", JSON.stringify(mapping)); } catch {}

        const normalized = normalizeRows(headers, rows, mapping);
        if (normalized.length === 0) {
          setStatus("err", "Mapping applied, but no valid rows were produced (check required fields).");
          return;
        }
        clearPreview();
        setStatus("ok", `Mapped to ${normalized.length.toLocaleString()} part(s).`);
        buildNormalizedPreview(normalized);

       // === PACK using real boards from Master Materials ===
const boards = getBoards();
if (!boards.length) {
  setStatus("err", "No boards loaded. Upload your Master Materials CSV first.");
  console.error("packPartsToSheets aborted: no boards in state.");
  return;
}

// sanity: materials in parts vs boards
const partMaterials = Array.from(new Set(
  normalized
    .map(p => String((p as any).Material ?? "").trim().toLowerCase())
    .filter(Boolean)
));
const boardTags = Array.from(new Set(
  boards
    .map(b => String((b as any).materialTag ?? "").trim().toLowerCase())
    .filter(Boolean)
));
const overlap = partMaterials.filter(m => boardTags.includes(m));
if (!overlap.length) {
  setStatus(
    "err",
    `No matching materials: parts use [${partMaterials.join(", ")}], boards have [${boardTags.join(", ")}]. ` +
    `Make sure the parts “Material” exactly equals the boards “MaterialTag”.`
  );
  console.error("Material mismatch", { partMaterials, boardTags });
  return;
}

const currentKerf = readNumberByIds(["kerf", "kerfInput", "input-kerf"], 0);
const currentMargin = readNumberByIds(["margin", "marginInput", "input-margin"], 0);

// Choose the correct engine signature at runtime.
// If your engine is (boards, parts, opts) we’ll use that.
// If it’s (parts, opts) we’ll fall back and pick the first matching board per material.
let pack: any = null;
try {
  const arity = (packPartsToSheets as any).length;

  if (arity >= 3) {
    // Modern engine: (boards[], parts[], options)
    pack = packPartsToSheets(boards as any, normalized as any, {
      kerf: currentKerf,
      margin: currentMargin,
    } as any);
  } else {
    // Legacy engine: (parts[], options) — run per material with a matching board size
    console.warn("[engine] Using legacy two-argument packer path.");

    const byMaterial: Record<string, any[]> = {};
    const unplaced: any[] = [];

    // group parts by material
    const groups = new Map<string, NormalizedPart[]>();
    for (const p of normalized) {
      const m = String((p as any).Material ?? "").trim().toLowerCase();
      if (!m) continue;
      if (!groups.has(m)) groups.set(m, []);
      groups.get(m)!.push(p);
    }

    for (const [m, parts] of groups.entries()) {
      // pick a matching board; if multiple, take the first
      const match = boards.find(
        b => String((b as any).materialTag ?? "").trim().toLowerCase() === m
      ) || boards[0];

      const res = packPartsToSheets(parts as any, {
        boardW: (match as any).width,
        boardH: (match as any).height,
        kerf: currentKerf,
        margin: currentMargin,
        heuristic: "BSSF",
        grain: "lengthwise",
        materialRotate: true,
      } as any);

      // Expect legacy result to expose res.sheets or be an array; normalize into array
      const sheets = Array.isArray(res?.sheets) ? res.sheets : (Array.isArray(res) ? res : []);
      byMaterial[m] = sheets;
      if (Array.isArray(res?.unplaced) && res.unplaced.length) {
        unplaced.push(...res.unplaced);
      }
    }

    pack = { byMaterial, unplaced };
  }
} catch (e) {
  console.error("Packing failed:", e);
  setStatus("err", "Packing failed — see console for details.");
  return;
}

lastPack = pack;

// Modal for per-material inspection (uses the pack.byMaterial shape)
if (lastPack?.unplaced?.length) {
  console.warn("Unplaced parts:", lastPack.unplaced);
}
if (lastPack?.byMaterial && Object.keys(lastPack.byMaterial).length) {
  openSheetsModal(lastPack);
}

// Also render in-page pager with all sheets flattened
const sheets: SheetLayout[] = lastPack?.byMaterial
  ? (Object.values(lastPack.byMaterial) as any[]).flat()
  : (Array.isArray(lastPack?.sheets) ? lastPack.sheets : []);
if (sheets.length) {
  emit(Events.LAYOUTS_READY, { sheets });
} else {
  setStatus("err", "No sheets produced. Check material tags and dimensions.");
}


        // Render modal for per-material inspection
        if (lastPack.unplaced?.length) {
          console.warn("Unplaced parts:", lastPack.unplaced);
        }
        if (Object.keys(lastPack.byMaterial ?? {}).length) {
          openSheetsModal(lastPack);
        }

// Also render in-page pager
const allSheets: SheetLayout[] = Object.values(lastPack.byMaterial ?? {}).flat();
emit(Events.LAYOUTS_READY, { sheets: allSheets });

      },
      savedDefaults ?? undefined,
      rows // live preview inside the drawer
    );
  } catch (err: any) {
    console.error(err);
    setStatus("err", `Failed to read CSV: ${err?.message ?? err}`);
  }
}

async function handleMaterialsCsv(file: File | null) {
  if (!file) {
    setMaterialsStatus("err", "Choose a Master Materials CSV first.");
    return;
  }
  try {
    const text = await file.text();
    const { headers, rows, delimiter } = parseCsv(text);

    if (!headers || headers.length === 0) {
      setMaterialsStatus("err", "Could not detect a header row. Check the first line of your CSV.");
      return;
    }

    // Build row objects {header: cell}
    const objects = rows.map((r) =>
      Object.fromEntries(headers.map((h, idx) => [h, r[idx] ?? ""]))
    );

    const boards = materialsRowsToBoards(objects);
    if (!boards.length) {
      setMaterialsStatus("err", "No valid rows. Expected BoardLength & BoardWidth (mm).");
      return;
    }

    setBoards(boards);
    setMaterialsStatus("ok", `Loaded ${boards.length.toLocaleString()} board spec(s). Delimiter: "${delimiter}"`);
  } catch (err: any) {
    console.error(err);
    setMaterialsStatus("err", `Failed: ${err?.message ?? err}`);
  }
}

/* --------------------------------- WIRING --------------------------------- */

// Cutting list
fileInput?.addEventListener("change", () => {
  pendingFile = fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;
  showFileName(pendingFile ? pendingFile.name : "No file chosen");
});
uploadBtn?.addEventListener("click", () => {
  void handleCuttingList(pendingFile ?? (fileInput && fileInput.files ? fileInput.files[0] : null));
});

// Master materials
materialsFileInput?.addEventListener("change", () => {
  pendingMaterialsFile = materialsFileInput.files && materialsFileInput.files[0] ? materialsFileInput.files[0] : null;
  setMaterialsStatus("neutral", pendingMaterialsFile ? `Selected: ${pendingMaterialsFile.name}` : "");
});
// Master materials – open picker on click, then process immediately on selection
uploadMaterialsBtn?.addEventListener("click", () => {
  materialsFileInput?.click();
});

materialsFileInput?.addEventListener("change", async () => {
  const file = materialsFileInput?.files?.[0] ?? null;
  if (!file) {
    setMaterialsStatus("err", "No file selected.");
    return;
  }
  setMaterialsStatus("neutral", `Reading ${file.name}…`);
  try {
    await handleMaterialsCsv(file);              // ← parse + setBoards happens here
    setMaterialsStatus("ok", `Loaded materials from ${file.name}`);
  } finally {
    // allow picking the same file again (browsers won't fire change if same file name otherwise)
    materialsFileInput.value = "";
  }
});

// Prevent form submits from reloading the page (in case you wrap controls later)
document.addEventListener("submit", (e) => e.preventDefault());

