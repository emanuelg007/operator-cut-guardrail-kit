// @ts-nocheck
// src/ui/modals/components-modal.ts
import type { NestablePart } from "../../nesting/types";

/**
 * Open the Components modal.
 * - parts: reference array (we clone internally; Cancel discards, Optimize commits)
 * - headers: full header list from the CSV (used in Details/Create to show every field)
 * - onOptimize: called when Optimize → is pressed, with the latest parts array
 */
export function openComponentsModal(
  parts: NestablePart[],
  headers: string[] = [],
  onOptimize?: (updated: NestablePart[]) => void
): void {
  // Remove any existing
  document.querySelectorAll("#oc-components-overlay").forEach((n) => n.remove());

  // Work on a shallow copy so Close/Cancel can discard; Optimize → commits back
  const working: NestablePart[] = parts.map(p => ({ ...(p as any) }));

  const overlay = div({
    id: "oc-components-overlay",
    style: `
      position: fixed; inset: 0; z-index: 2147483200;
      background: rgba(15,23,42,0.35);
      display: grid; place-items: center;
    `,
  });

  const modal = div({
    style: `
      width: min(1200px, 96vw);
      height: min(92vh, 920px);
      background: #ffffff;
      border-radius: 12px;
      box-shadow: 0 40px 100px rgba(0,0,0,0.45);
      display: grid;
      grid-template-rows: auto 1fr auto;
      gap: 10px;
      padding: 12px;
      overflow: hidden;
      font: 13px/1.4 system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;
      color:#0f172a;
    `,
  });

  // Header
  const header = div({
    style: "display:flex;align-items:center;justify-content:space-between;gap:8px;",
  });
  const title = h3(`Components (${working.length.toLocaleString()})`);
  const headerBtns = div({ style: "display:flex;gap:8px;" });

  const addBtn = pill("Add Component", () => {
    const fresh = emptyPartFromHeaders(headers);
    working.push(fresh);
    rebuildBody();
    title.textContent = `Components (${working.length.toLocaleString()})`;
    // Immediately open details so all fields are available
    openDetailsEditor(fresh, headers, () => refreshTitle(working, title), rebuildBody);
  });

  const closeBtn = pill("Close", () => overlay.remove());
  headerBtns.append(addBtn, closeBtn);
  header.append(title, headerBtns);

  // Body (scroll region)
  const body = div({ style: "overflow:auto;padding:4px;" });

  // Footer
  const footer = div({ style: "display:flex;justify-content:flex-end;gap:8px;" });
  const cancel = pill("Cancel", () => overlay.remove());
  const optimize = primary("Optimize →", () => {
    // Push working edits back to original array
    parts.splice(0, parts.length, ...working);
    overlay.remove();
    onOptimize?.(parts);
  });
  footer.append(cancel, optimize);

  modal.append(header, body, footer);
  overlay.appendChild(modal);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });
  window.addEventListener("keydown", function onEsc(e) {
    if (e.key === "Escape") { overlay.remove(); window.removeEventListener("keydown", onEsc); }
  });

  document.body.appendChild(overlay);
  rebuildBody();

  function rebuildBody() {
    body.innerHTML = "";
    body.append(buildEditableTable(working, headers, title, rebuildBody));
  }
}

/* -------------------------------------------------------------------------- */
/*                          Editable list (compact)                           */
/* -------------------------------------------------------------------------- */

function buildEditableTable(
  parts: NestablePart[],
  headers: string[],
  titleEl: HTMLElement,
  refresh: () => void
): HTMLElement {
  // First view columns: all details up to notes2 + edging, then Details btn
  const table = document.createElement("table");
  table.style.width = "100%";
  table.style.borderCollapse = "separate";
  table.style.borderSpacing = "0 6px";

  const thead = document.createElement("thead");
  const trh = document.createElement("tr");
  const cols = ["Name", "Material", "Length", "Width", "Qty", "Notes1", "Notes2", "Edging", ""];
  cols.forEach((label) => {
    const th = document.createElement("th");
    th.textContent = label;
    th.style.textAlign = "left";
    th.style.padding = "6px 8px";
    th.style.fontSize = "12px";
    th.style.color = "#334155";
    trh.appendChild(th);
  });
  thead.appendChild(trh);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");

  parts.forEach((p) => {
    const tr = document.createElement("tr");
    tr.style.background = "#f8fafc";
    tr.style.border = "1px solid #e5e7eb";

    const td = (node: HTMLElement | string) => {
      const cell = document.createElement("td");
      if (typeof node === "string") cell.textContent = node;
      else cell.appendChild(node);
      cell.style.padding = "6px 8px";
      cell.style.borderTop = "1px solid #e5e7eb";
      cell.style.borderBottom = "1px solid #e5e7eb";
      return cell;
    };

    const nameI = textInput(p.name ?? (p as any).id ?? "", (v) => { (p as any).name = v; });
    const matI  = textInput(((p as any).materialTag ?? (p as any).material ?? ""), (v) => {
      if ("materialTag" in p) (p as any).materialTag = v;
      else (p as any).material = v;
    });

    const lenI  = numInput(p.h ?? 0, (v) => { (p as any).h = v; }, "1");
    const widI  = numInput(p.w ?? 0, (v) => { (p as any).w = v; }, "1");
    const qtyI  = numInput((p as any).qty ?? 1, (v) => { (p as any).qty = v; }, "1");

    const n1I   = textInput((p as any).notes1 ?? "", (v) => { (p as any).notes1 = v; });
    const n2I   = textInput((p as any).notes2 ?? "", (v) => { (p as any).notes2 = v; });
    const edI   = textInput((p as any).edging ?? "", (v) => { (p as any).edging = v; });

    const detailsBtn = smallBtn("Details", () =>
      openDetailsEditor(p, headers, () => refreshTitle(parts, titleEl), refresh)
    );

    tr.append(
      td(nameI), td(matI), td(lenI), td(widI), td(qtyI), td(n1I), td(n2I), td(edI), td(detailsBtn)
    );
    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  return table;
}

/* ------------------------------ Details editor ---------------------------- */

function openDetailsEditor(
  part: NestablePart,
  headers: string[],
  onChangeCount: () => void,
  onCloseRebuild: () => void
) {
  document.querySelectorAll("#oc-details-overlay").forEach((n) => n.remove());

  // union of known keys + headers + current part keys
  const baseKeys = new Set<string>([
    "id","name","materialTag","material",
    "h","w","qty",
    "notes1","notes2",
    // common edging fields you requested
    "edging","edgeTop","edgeRight","edgeBottom","edgeLeft",
  ]);
  for (const h of headers) baseKeys.add(h);
  for (const k of Object.keys(part as any)) baseKeys.add(k);

  // Present name-ish keys earlier, size near top, the rest alphabetical
  const pref = ["name","materialTag","material","h","w","qty","notes1","notes2","edging","edgeTop","edgeRight","edgeBottom","edgeLeft"];
  const all  = Array.from(baseKeys);
  const keys = [
    ...pref.filter(k => all.includes(k)),
    ...all.filter(k => !pref.includes(k)).sort((a,b)=>a.localeCompare(b))
  ];

  const overlay = div({
    id: "oc-details-overlay",
    style: `
      position: fixed; inset: 0; z-index: 2147483300;
      background: rgba(0,0,0,0.45);
      display: grid; place-items: center;
    `,
  });

  const card = div({
    style: `
      width: min(740px, 94vw);
      max-height: 90vh;
      overflow: auto;
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 30px 80px rgba(0,0,0,0.5);
      padding: 14px;
      display: grid; gap: 10px;
    `,
  });

  const head = div({ style: "display:flex;align-items:center;justify-content:space-between;gap:8px;" });
  head.append(h3(`Edit — ${part.name ?? (part as any).id ?? ""}`), pill("Close", () => { overlay.remove(); onCloseRebuild(); }));

  const form = div({
    style: `
      display:grid; grid-template-columns: repeat(auto-fit,minmax(220px,1fr));
      gap:10px;
    `,
  });

  // Build fields
  const editors: Record<string, HTMLInputElement> = {};
  for (const k of keys) {
    const val = (part as any)[k];
    const isNumber = typeof val === "number" || ["h","w","qty"].includes(k);
    const field = formRow(k, isNumber ? numberField(val ?? 0) : textField(String(val ?? "")));
    editors[k] = field.querySelector("input") as HTMLInputElement;
    form.append(field);
  }

  const footer = div({ style: "display:flex;justify-content:flex-end;gap:8px;" });
  const removeBtn = pill("Delete", () => {
    // Signal delete by setting a flag; actual array changes happen in caller
    (part as any).__deleted = true;
    overlay.remove();
    onCloseRebuild();
    onChangeCount();
  });
  const saveBtn = primary("Save", () => {
    for (const k of Object.keys(editors)) {
      const input = editors[k];
      const isNum = input.type === "number";
      (part as any)[k] = isNum ? toNumberSafe(input.value) : input.value;
    }
    overlay.remove();
    onCloseRebuild();
  });

  card.append(head, form, div({style:"height:2px;background:#f1f5f9;margin:2px 0;"}), footer);
  footer.append(removeBtn, saveBtn);

  overlay.appendChild(card);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) { overlay.remove(); onCloseRebuild(); } });
  window.addEventListener("keydown", function onEsc(e) {
    if (e.key === "Escape") { overlay.remove(); onCloseRebuild(); window.removeEventListener("keydown", onEsc); }
  });

  document.body.appendChild(overlay);
}

/* ------------------------------ util helpers ------------------------------ */

function emptyPartFromHeaders(headers: string[]): NestablePart {
  const p: any = {
    id: `new-${Date.now()}`,
    name: "",
    materialTag: "",
    w: 0,
    h: 0,
    qty: 1,
    notes1: "",
    notes2: "",
    edging: "",
    edgeTop: "", edgeRight: "", edgeBottom: "", edgeLeft: "",
  };
  // initialize any unknown headers to empty strings so they're editable in Details
  for (const h of headers) if (!(h in p)) p[h] = "";
  return p as NestablePart;
}

function refreshTitle(parts: NestablePart[], el: HTMLElement) {
  el.textContent = `Components (${parts.filter(p => !(p as any).__deleted).length.toLocaleString()})`;
}

/* DOM helpers */
function div(opts: Partial<HTMLElement> & { style?: string; id?: string } = {}) {
  const d = document.createElement("div");
  if (opts.id) d.id = opts.id;
  if (opts.style) (d as HTMLElement).style.cssText = opts.style;
  return d;
}
function h3(text: string) { const h = document.createElement("h3"); h.textContent = text; h.style.margin = "0"; h.style.fontSize = "18px"; h.style.fontWeight = "800"; return h; }

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
function smallBtn(label: string, onClick: () => void) {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = label;
  b.style.cssText = `
    padding: 6px 10px; border:1px solid #cbd5e1; border-radius:8px; cursor:pointer;
    background:#fff; color:#1f2937;
  `;
  b.onclick = onClick;
  return b;
}

/* inline inputs */
function baseInputCss() {
  return `
    font: 13px/1.4 system-ui,-apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
    padding: 6px 8px; border:1px solid #cbd5e1; border-radius:8px;
    background:#ffffff; color:#0f172a; outline:none; width:100%;
  `;
}
function textInput(value: string, onChange: (v: string) => void) {
  const i = document.createElement("input");
  i.type = "text";
  i.value = String(value ?? "");
  i.style.cssText = baseInputCss();
  i.addEventListener("change", () => onChange(i.value));
  return i;
}
function numInput(value: number, onChange: (v: number) => void, step = "1") {
  const i = document.createElement("input");
  i.type = "number";
  i.step = step;
  i.value = String(value ?? 0);
  i.style.cssText = baseInputCss();
  i.addEventListener("change", () => onChange(toNumberSafe(i.value)));
  return i;
}

/* details form inputs */
function numberField(value: number) {
  const w = document.createElement("div");
  const i = numInput(value ?? 0, () => {}, "1");
  w.appendChild(i);
  return w;
}
function textField(value: string) {
  const w = document.createElement("div");
  const i = textInput(value ?? "", () => {});
  w.appendChild(i);
  return w;
}
function formRow(label: string, fieldWrap: HTMLElement) {
  const wrap = div({
    style: `
      display:grid; gap:6px; border:1px solid #e5e7eb; border-radius:8px; padding:8px; background:#fff;
      font-size:12px;
    `,
  });
  const cap = document.createElement("div");
  cap.textContent = prettify(label);
  cap.style.opacity = "0.8";
  wrap.append(cap, fieldWrap);
  return wrap;
}

function prettify(key: string) {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\w/, (m) => m.toUpperCase());
}
function toNumberSafe(s: string) {
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

