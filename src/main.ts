// src/main.ts
import { parseCsv } from "./csv/parseCsv";
import { validateRequiredColumns } from "./csv/validateRows";
import { openHeaderMapModal } from "./ui/modals/header-map-modal";
import { normalizeRows, type NormalizedPart } from "./csv/normalize";
import { packPartsToSheets, type PackResult } from "./nesting/engine";
import { renderBoardSvg } from "./render/boardSvg";

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
    renderBoardSvg(svgWrap, sheet);
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

        // Pack → Sheets → Modal
        lastPack = packPartsToSheets(normalized, {
          boardW: 1830,
          boardH: 2750,
          kerf: 3,
          margin: 10,
          heuristic: "BSSF",
          grain: "lengthwise",
          materialRotate: true,
        });
        if (lastPack.unplaced.length) {
          console.warn("Unplaced parts:", lastPack.unplaced);
        }
        if (Object.keys(lastPack.byMaterial).length) {
          openSheetsModal(lastPack);
        }
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

    const required = ["Name", "BoardLength", "BoardWidth", "Thickness"];
    const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
    const H = new Set(headers.map(norm));
    const missing = required.filter(r => !H.has(norm(r)));
    if (missing.length) {
      setMaterialsStatus("err", `Missing column(s): ${missing.join(", ")}`);
      return;
    }

    setMaterialsStatus("ok", `Loaded ${rows.length.toLocaleString()} material row(s). Delimiter: "${delimiter}"`);
    // TODO: add to materials library state
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
uploadMaterialsBtn?.addEventListener("click", () => {
  void handleMaterialsCsv(pendingMaterialsFile ?? (materialsFileInput?.files?.[0] ?? null));
});

// Prevent form submits from reloading the page (in case you wrap controls later)
document.addEventListener("submit", (e) => e.preventDefault());
