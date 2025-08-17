// src/main.ts

import { parseCsv } from "./csv/parseCsv";
import { validateRequiredColumns } from "./csv/validateRows";
import { openHeaderMapModal } from "./ui/modals/header-map-modal";

// ---------- Types used locally ----------
type CanonicalKey =
  | "Name" | "Material" | "Length" | "Width" | "Qty"
  | "Notes" | "Note1" | "Note2"
  | "AllowRotate" | "EdgeL1" | "EdgeL2" | "EdgeW1" | "EdgeW2";

type Mapping = Record<CanonicalKey, string | null>;

export interface NormalizedPart {
  Name: string;
  Material: string;
  Length: number;
  Width: number;
  Qty: number;
  Notes?: string;
  Note1?: string;
  Note2?: string;
  AllowRotate?: string;
  EdgeL1?: string;
  EdgeL2?: string;
  EdgeW1?: string;
  EdgeW2?: string;
}

// ---------- DOM refs ----------
const fileInput = document.getElementById("fileInput") as HTMLInputElement | null;
const uploadBtn = document.getElementById("uploadBtn") as HTMLButtonElement | null;
const statusEl = document.getElementById("status") as HTMLDivElement | null;
const previewEl = document.getElementById("preview") as HTMLDivElement | null;
const fileNameEl = document.getElementById("fileName") as HTMLSpanElement | null;

const materialsFileInput = document.getElementById("materialsFileInput") as HTMLInputElement | null;
const uploadMaterialsBtn = document.getElementById("uploadMaterialsBtn") as HTMLButtonElement | null;
const materialsStatusEl = document.getElementById("materialsStatus") as HTMLSpanElement | null;

let pendingFile: File | null = null;
let pendingMaterialsFile: File | null = null;

// ---------- Small helpers ----------
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
  previewEl.appendChild(h3);
  previewEl.appendChild(table);
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
      p.Note2 ?? ""
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

  previewEl.appendChild(wrap);
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
    tr.appendChild(ktd); tr.appendChild(vtd);
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

// ---------- Normalization (local, avoids external dependency) ----------
function toNumber(s: string | undefined | null): number {
  if (!s) return NaN;
  const cleaned = s.replace(/,/g, ".").replace(/[^\d.+-]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

function normalizeFromMapping(
  headers: string[],
  rows: string[][],
  mapping: Mapping
): NormalizedPart[] {
  const idx: Partial<Record<CanonicalKey, number>> = {};
  (Object.keys(mapping) as CanonicalKey[]).forEach((k) => {
    const chosen = mapping[k];
    idx[k] = chosen ? headers.indexOf(chosen) : -1;
  });

  const required: CanonicalKey[] = ["Name", "Material", "Length", "Width", "Qty"];
  const out: NormalizedPart[] = [];

  for (const r of rows) {
    const get = (k: CanonicalKey) => {
      const j = idx[k] ?? -1;
      return j >= 0 ? (r[j] ?? "").trim() : "";
    };

    // Required
    const name = get("Name");
    const material = get("Material");
    const length = toNumber(get("Length"));
    const width = toNumber(get("Width"));
    const qty = toNumber(get("Qty"));

    if (!name || !material || !Number.isFinite(length) || !Number.isFinite(width) || !Number.isFinite(qty)) {
      continue; // skip invalid rows
    }

    const part: NormalizedPart = {
      Name: name,
      Material: material,
      Length: length,
      Width: width,
      Qty: qty
    };

    // Optional
    const notes = get("Notes"); if (notes) part.Notes = notes;
    const note1 = get("Note1"); if (note1) part.Note1 = note1;
    const note2 = get("Note2"); if (note2) part.Note2 = note2;
    const ar = get("AllowRotate"); if (ar) part.AllowRotate = ar;
    const el1 = get("EdgeL1"); if (el1) part.EdgeL1 = el1;
    const el2 = get("EdgeL2"); if (el2) part.EdgeL2 = el2;
    const ew1 = get("EdgeW1"); if (ew1) part.EdgeW1 = ew1;
    const ew2 = get("EdgeW2"); if (ew2) part.EdgeW2 = ew2;

    out.push(part);
  }

  return out;
}

// ---------- Cutting list flow ----------
async function handleProcessCutting(file: File | null) {
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

    // Validate required columns (based on your adjusted headings inside validateRows.ts)
    const res = validateRequiredColumns(headers);
    if (!res.ok) {
      setStatus("err", `Missing required column(s): ${res.missing.join(", ")}`);
      buildRawPreview(headers, rows);
      return;
    }

    setStatus("ok", `Loaded ${rows.length.toLocaleString()} row(s). Delimiter detected: "${delimiter}"`);
    buildRawPreview(headers, rows);

    // Load last-used mapping if any
    const savedDefaults: Partial<Mapping> | null = (() => {
      try { return JSON.parse(localStorage.getItem("oc:lastMapping") || "null"); }
      catch { return null; }
    })();

    // Open mapping drawer → normalize on apply
    openHeaderMapModal(
      headers,
      (mapping) => {
        try { localStorage.setItem("oc:lastMapping", JSON.stringify(mapping)); } catch {}
        const normalized = normalizeFromMapping(headers, rows, mapping as Mapping);
        if (normalized.length === 0) {
          setStatus("err", "Mapping applied, but no valid rows were produced (check required fields).");
          return;
        }
        clearPreview(); // hide raw preview
        setStatus("ok", `Mapped to ${normalized.length.toLocaleString()} part(s).`);
        buildNormalizedPreview(normalized);
      },
      savedDefaults ?? undefined,
      rows // live preview inside the drawer
    );
  } catch (err: any) {
    console.error(err);
    setStatus("err", `Failed to read CSV: ${err?.message ?? err}`);
  }
}

// ---------- Master Materials flow ----------
materialsFileInput?.addEventListener("change", () => {
  pendingMaterialsFile = materialsFileInput.files && materialsFileInput.files[0] ? materialsFileInput.files[0] : null;
  setMaterialsStatus("neutral", pendingMaterialsFile ? `Selected: ${pendingMaterialsFile.name}` : "");
});

uploadMaterialsBtn?.addEventListener("click", async () => {
  try {
    const file = pendingMaterialsFile ?? (materialsFileInput?.files?.[0] ?? null);
    if (!file) {
      setMaterialsStatus("err", "Choose a Master Materials CSV first.");
      return;
    }
    const text = await file.text();
    const { headers, rows, delimiter } = parseCsv(text);

    if (!headers || headers.length === 0) {
      setMaterialsStatus("err", "Could not detect a header row. Check the first line of your CSV.");
      return;
    }

    // Soft check, adjust later to your exact schema
    const required = ["Name", "BoardLength", "BoardWidth", "Thickness"];
    const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
    const H = new Set(headers.map(norm));
    const missing = required.filter((r) => !H.has(norm(r)));
    if (missing.length) {
      setMaterialsStatus("err", `Missing column(s): ${missing.join(", ")}`);
      return;
    }

    setMaterialsStatus("ok", `Loaded ${rows.length.toLocaleString()} material row(s). Delimiter: "${delimiter}"`);
    // TODO: store into materials library state when that module is wired
  } catch (err: any) {
    console.error(err);
    setMaterialsStatus("err", `Failed: ${err?.message ?? err}`);
  }
});

// ---------- Wiring (cutting list) ----------
fileInput?.addEventListener("change", () => {
  pendingFile = fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;
  showFileName(pendingFile ? pendingFile.name : "No file chosen");
});

uploadBtn?.addEventListener("click", () => {
  void handleProcessCutting(pendingFile ?? (fileInput && fileInput.files ? fileInput.files[0] : null));
});

// prevent accidental form submits
document.addEventListener("submit", (e) => e.preventDefault());
