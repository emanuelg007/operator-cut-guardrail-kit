// src/ui/modals/header-map-modal.ts
import { autoMap, type Mapping } from "../../csv/normalize";

/**
 * Header Mapping Drawer (right-docked)
 * - Required for pipeline: Name, Material, Length, Width, Qty
 * - Mapping type also requires: MaterialTag, CanRotateRaw, LongExpansion, ShortExpansion
 * - Optional fields persisted + broadcast for labels/reports
 * - Live preview (first 15 rows)
 */
export function openHeaderMapModal(
  headers: string[],
  onApply: (mapping: Mapping) => void,
  savedDefaults?: Partial<Mapping>,
  rowsForPreview: string[][] = []
) {
  // ---- helpers
  const REQUIRED: (keyof Mapping)[] = ["Name", "Material", "Length", "Width", "Qty"];
  const DISPLAY_LABEL: Record<keyof Mapping, string> = {
    Name: "Name",
    Material: "Material",
    Length: "Length",
    Width: "Width",
    Qty: "Quantity (Qty)",
    MaterialTag: "Material Tag",
    CanRotateRaw: "Allow Rotate (raw)",
    LongExpansion: "Long Expansion",
    ShortExpansion: "Short Expansion",
  };

  const hasHeader = (h: string) => headers.includes(h);
  const findHeader = (...candidates: string[]) =>
    candidates.find((c) => hasHeader(c)) || "";
  const isComplete = (m: Mapping) => REQUIRED.every((k) => String(m[k]).trim() !== "");

  // ---- initial mapping (cover *all* Mapping keys)
  const guess = autoMap(headers);
  let req: Mapping = {
    Name: savedDefaults?.Name ?? guess.Name ?? findHeader("Name"),
    Material: savedDefaults?.Material ?? guess.Material ?? findHeader("Material"),
    MaterialTag: savedDefaults?.MaterialTag ?? guess.MaterialTag ?? findHeader("Material Tag", "MaterialTag"),
    Length: savedDefaults?.Length ?? guess.Length ?? findHeader("Length", "L"),
    Width: savedDefaults?.Width ?? guess.Width ?? findHeader("Width", "W"),
    Qty: savedDefaults?.Qty ?? guess.Qty ?? findHeader("Qty", "Quantity"),
    CanRotateRaw:
      savedDefaults?.CanRotateRaw ??
      guess.CanRotateRaw ??
      findHeader("AllowRotate", "Can Rotate (0 = No / 1 = Yes / 2 = Same As Material)"),
    LongExpansion:
      savedDefaults?.LongExpansion ??
      guess.LongExpansion ??
      findHeader("Long Expansion", "LongExpansion"),
    ShortExpansion:
      savedDefaults?.ShortExpansion ??
      guess.ShortExpansion ??
      findHeader("Short Expansion", "ShortExpansion"),
  };

  // ---- OPTIONAL fields (persisted + emitted for other modules)
  const OPTIONAL_FIELDS_BASE: string[] = [
    // layout/meta
    "Type", "Group", "Report Tags", "Import ID", "Parent ID", "Library Item Name",
    // rotation/grain/thickness
    "Thickness", "Grain", "AllowRotate", "Can Rotate (0 = No / 1 = Yes / 2 = Same As Material)",
    // edging lengths & tags
    "EdgeL1", "EdgeL2", "EdgeW1", "EdgeW2",
    "Edging Length 1", "Edging Length 2", "Edging Width 1", "Edging Width 2",
    "Edging Length 1 Tag", "Edging Length 2 Tag", "Edging Width 1 Tag", "Edging Width 2 Tag",
    "Include Edging Thickness",
    // notes
    "Notes", "Notes1", "Notes2", "Note 1", "Note 2", "Note 3", "Note 4",
    // holes/grooving
    "Holes Length 1", "Holes Length 2", "Holes Width 1", "Holes Width 2",
    "Grooving Length 1", "Grooving Length 2", "Grooving Width 1", "Grooving Width 2",
    // material alias
    "Material Tag",
    // other
    "Apply Machining Charge", "Long Expansion", "Short Expansion",
  ];

  const OPTIONAL_FIELDS: string[] = Array.from(
    new Set<string>([...OPTIONAL_FIELDS_BASE, ...headers])
  ).filter((f) => !(f in DISPLAY_LABEL));

  const seedExtrasFromGuess = (): Record<string, string> => {
    const e: Record<string, string> = {};
    const maybe = (canon: string, ...candidates: (keyof Mapping | string)[]) => {
      for (const c of candidates) {
        // @ts-expect-error probing with string keys
        const v = guess[c as any];
        if (typeof v === "string" && hasHeader(v)) { e[canon] = v; return; }
      }
      for (const c of candidates) if (hasHeader(String(c))) { e[canon] = String(c); return; }
      e[canon] = "";
    };

    // rotation
    maybe("AllowRotate", "CanRotateRaw", "AllowRotate", "Can Rotate (0 = No / 1 = Yes / 2 = Same As Material)");

    // notes
    maybe("Notes1", "Note 1", "Notes1");
    maybe("Notes2", "Note 2", "Notes2");

    // edging
    maybe("EdgeL1", "Edging Length 1", "EdgeL1");
    maybe("EdgeL2", "Edging Length 2", "EdgeL2");
    maybe("EdgeW1", "Edging Width 1", "EdgeW1");
    maybe("EdgeW2", "Edging Width 2", "EdgeW2");

    // material tag alias
    maybe("Material Tag", "Material Tag", "MaterialTag");

    // thickness & grain
    maybe("Thickness", "Thickness");
    maybe("Grain", "Grain");

    // holes / grooving
    for (const f of [
      "Holes Length 1","Holes Length 2","Holes Width 1","Holes Width 2",
      "Grooving Length 1","Grooving Length 2","Grooving Width 1","Grooving Width 2",
    ]) maybe(f, f);

    // misc
    maybe("Include Edging Thickness", "Include Edging Thickness");
    maybe("Apply Machining Charge", "Apply Machining Charge");
    maybe("Long Expansion", "Long Expansion", "LongExpansion");
    maybe("Short Expansion", "Short Expansion", "ShortExpansion");

    // meta
    for (const f of ["Type","Group","Report Tags","Import ID","Parent ID","Library Item Name"]) maybe(f, f);

    // map any remaining uploaded header to itself so it can be retained
    for (const h of headers) if (!(h in e)) e[h] = h;

    return e;
  };

  let extras: Record<string, string> = {
    ...seedExtrasFromGuess(),
    ...safeParse(localStorage.getItem("oc:lastMappingExtras") || "{}"),
  };

  // ---- DOM: overlay + right drawer
  const overlay = document.createElement("div");
  overlay.style.position = "fixed";
  overlay.style.inset = "0";
  overlay.style.background = "rgba(17,24,39,0.45)";
  overlay.style.zIndex = "10000";
  overlay.style.display = "flex";
  overlay.style.justifyContent = "flex-end";

  const drawer = document.createElement("div");
  drawer.id = "header-map-drawer";
  drawer.style.width = "min(680px, 94vw)";
  drawer.style.height = "100%";
  drawer.style.background = "#fff";
  drawer.style.boxShadow = "-16px 0 40px rgba(0,0,0,0.35)";
  drawer.style.display = "grid";
  // Rows: header, note, required, SCROLLABLE MIDDLE, footer
  drawer.style.gridTemplateRows = "auto auto auto 1fr auto";
  drawer.style.rowGap = "10px";
  drawer.style.padding = "14px";
  // drawer.style.overflow = "hidden"; // not needed

  // ---- header bar
  const top = rowFlex();
  const title = document.createElement("h3");
  title.textContent = "Header Mapping";
  title.style.margin = "0";
  const closeBtn = btn("×");
  closeBtn.setAttribute("aria-label", "Close");
  closeBtn.onclick = () => document.body.removeChild(overlay);
  top.append(title, closeBtn);

  // ---- instructions
  const note = document.createElement("div");
  note.innerHTML = `
    <p style="margin:.25rem 0 .25rem 0;color:#4b5563">
      Map your uploaded headers to the app's fields.
      <strong>Required:</strong> Name, Material, Length, Width, Quantity (Qty).
      Optional fields are saved for labels/reports later.
    </p>`;

  // ---- REQUIRED form (2 columns)
  const reqForm = grid2();
  const reqSelects: Partial<Record<keyof Mapping, HTMLSelectElement>> = {};
  for (const key of REQUIRED) {
    const label = labelEl(DISPLAY_LABEL[key]);
    const sel = selectFor(headers, req[key] ?? "");
    sel.onchange = () => { req = { ...req, [key]: sel.value } as Mapping; refreshValidity(); renderPreview(); };
    reqSelects[key] = sel;
    reqForm.append(label, sel);
  }

  // ---- OPTIONAL form (2 columns)
  const optHeader = document.createElement("div");
  optHeader.textContent = "Optional fields";
  optHeader.style.fontWeight = "600";

  const optForm = grid2();
  const optSelects: Record<string, HTMLSelectElement> = {};
  for (const field of OPTIONAL_FIELDS) {
    const label = labelEl(field);
    const sel = selectFor(headers, extras[field] ?? "");
    sel.onchange = () => { extras[field] = sel.value; renderPreview(); };
    optSelects[field] = sel;
    optForm.append(label, sel);
  }

  // ---- preview
  const previewWrap = document.createElement("div");
  previewWrap.style.overflow = "auto";
  previewWrap.style.minHeight = "0";
  previewWrap.style.borderTop = "1px solid #e5e7eb";
  previewWrap.style.paddingTop = "8px";
  const previewTitle = document.createElement("div");
  previewTitle.textContent = "Live Preview (first 15 rows)";
  previewTitle.style.fontWeight = "600";
  previewTitle.style.margin = "0 0 6px 0";
  const preview = document.createElement("div");
  preview.id = "header-map-preview";
  previewWrap.append(previewTitle, preview);

  // ---- SCROLLABLE middle area (Optional + Preview)
  const middle = document.createElement("div");
  middle.style.display = "grid";
  middle.style.gridTemplateRows = "auto auto 1fr";
  middle.style.rowGap = "10px";
  middle.style.overflow = "auto";
  middle.style.minHeight = "0";
  middle.append(optHeader, optForm, previewWrap);

  // ---- footer
  const footer = rowFlex();
  footer.style.gap = "8px";
  const leftBtns = rowFlex(); leftBtns.style.gap = "8px";

  const autoBtn = btn("Auto-Map");
  autoBtn.onclick = () => {
    const g = autoMap(headers);
    req = {
      Name: g.Name ?? findHeader("Name"),
      Material: g.Material ?? findHeader("Material"),
      Length: g.Length ?? findHeader("Length", "L"),
      Width: g.Width ?? findHeader("Width", "W"),
      Qty: g.Qty ?? findHeader("Qty", "Quantity"),
      MaterialTag: g.MaterialTag ?? findHeader("Material Tag", "MaterialTag"),
      CanRotateRaw: g.CanRotateRaw ?? findHeader("AllowRotate", "Can Rotate (0 = No / 1 = Yes / 2 = Same As Material)"),
      LongExpansion: g.LongExpansion ?? findHeader("Long Expansion", "LongExpansion"),
      ShortExpansion: g.ShortExpansion ?? findHeader("Short Expansion", "ShortExpansion"),
    } as Mapping;

    for (const k of REQUIRED) reqSelects[k]!.value = req[k] ?? "";

    // refresh extras guesses too
    extras = seedExtrasFromGuess();
    for (const f of Object.keys(optSelects)) optSelects[f].value = extras[f] ?? "";

    refreshValidity();
    renderPreview();
  };

  const cancelBtn = btn("Cancel");
  cancelBtn.onclick = () => document.body.removeChild(overlay);

  const validityMsg = document.createElement("div");
  validityMsg.style.marginLeft = "auto";
  validityMsg.style.color = "#b91c1c";
  validityMsg.style.fontSize = "0.95em";

  const applyBtn = btnPrimary("Apply");
  applyBtn.disabled = !isComplete(req);
  applyBtn.onclick = () => {
    if (!isComplete(req)) return;
    try { localStorage.setItem("oc:lastMappingExtras", JSON.stringify(extras)); } catch {}
    document.dispatchEvent(new CustomEvent("oc:headerMappingExtras", { detail: { extras } }));
    onApply(req);
    document.body.removeChild(overlay);
  };

  leftBtns.append(autoBtn, cancelBtn);
  footer.append(leftBtns, validityMsg, applyBtn);

  // ---- assemble and mount
  drawer.append(top, note, reqForm, middle, footer);
  overlay.appendChild(drawer);
  const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") { document.body.removeChild(overlay); window.removeEventListener("keydown", onEsc); } };
  window.addEventListener("keydown", onEsc);
  document.body.appendChild(overlay);

  // ---- initial
  refreshValidity();
  renderPreview();

  // --------- helpers ----------
  function renderPreview() {
    preview.innerHTML = "";
    const chosenOptional = Object.entries(extras).filter(([_, v]) => v && v.trim()).slice(0, 8);
    const cols: Array<{ label: string; header: string }> = [
      { label: "Name", header: req.Name || "—" },
      { label: "Material", header: req.Material || "—" },
      { label: "Length", header: req.Length || "—" },
      { label: "Width", header: req.Width || "—" },
      { label: "Quantity (Qty)", header: req.Qty || "—" },
      ...chosenOptional.map(([lab, hdr]) => ({ label: lab, header: hdr })),
    ];

    const table = document.createElement("table");
    table.style.borderCollapse = "collapse";
    table.style.width = "100%";
    table.style.background = "#fff";

    const thead = document.createElement("thead");
    const thr = document.createElement("tr");
    for (const c of cols) {
      const th = document.createElement("th");
      th.textContent = `${c.label} ↦ ${c.header}`;
      th.style.textAlign = "left";
      th.style.borderBottom = "1px solid #e5e7eb";
      th.style.padding = "6px 8px";
      thr.appendChild(th);
    }
    thead.appendChild(thr);

    const tbody = document.createElement("tbody");
    const limit = Math.min(15, rowsForPreview.length);
    for (let i = 0; i < limit; i++) {
      const tr = document.createElement("tr");
      for (const c of cols) {
        const j = headers.findIndex((h) => h === c.header);
        const td = document.createElement("td");
        td.style.borderBottom = "1px solid #f3f4f6";
        td.style.padding = "6px 8px";
        td.textContent = j >= 0 ? (rowsForPreview[i]?.[j] ?? "") : "";
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    table.append(thead, tbody);
    preview.appendChild(table);
  }

  function refreshValidity() {
    const ok = isComplete(req);
    applyBtn.disabled = !ok;
    validityMsg.textContent = ok ? "" : "Select all required fields.";
  }
}

// ---- tiny styled helpers (no external CSS)
function rowFlex() {
  const d = document.createElement("div");
  d.style.display = "flex";
  d.style.alignItems = "center";
  d.style.justifyContent = "space-between";
  return d;
}
function grid2() {
  const d = document.createElement("div");
  d.style.display = "grid";
  d.style.gridTemplateColumns = "1fr 1fr";
  d.style.columnGap = "10px";
  d.style.rowGap = "8px";
  d.style.alignItems = "start";
  return d;
}
function labelEl(text: string) {
  const l = document.createElement("label");
  l.textContent = text;
  l.style.fontWeight = "600";
  return l;
}
function selectFor(headers: string[], value: string) {
  const sel = document.createElement("select");
  sel.style.padding = "6px 8px";
  sel.style.border = "1px solid #d1d5db";
  sel.style.borderRadius = "8px";
  sel.style.width = "100%";
  sel.appendChild(new Option("— choose —", ""));
  for (const h of headers) sel.appendChild(new Option(h, h));
  sel.value = value || "";
  return sel;
}
function btn(text: string) {
  const b = document.createElement("button");
  b.textContent = text;
  b.style.padding = "6px 10px";
  b.style.border = "1px solid #d1d5db";
  b.style.borderRadius = "8px";
  b.style.background = "#fff";
  b.style.cursor = "pointer";
  return b;
}
function btnPrimary(text: string) {
  const b = btn(text);
  b.style.background = "#111827";
  b.style.color = "#fff";
  b.style.borderColor = "#111827";
  return b;
}
function safeParse(s: string) {
  try { return JSON.parse(s); } catch { return {}; }
}
