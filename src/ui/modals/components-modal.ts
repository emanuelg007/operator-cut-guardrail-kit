// src/ui/modals/components-modal.ts
import type { NestablePart } from "../../nesting/types";

/**
 * Full-screen Components Handler modal.
 * - Shows ALL rows (no 15-row limit)
 * - Inline editing for ALL columns (union of keys across items)
 * - Add Component submodal with all fields
 * - Apply → send updated parts to caller (does NOT pack)
 * - Optimize → send updated parts, then dispatch window 'oc:optimizeRequested', and close
 */

type OnApply = (updated: NestablePart[]) => void;

type Options = {
  title?: string;
};

const Z = 2147483646;

export function openComponentsModal(
  parts: NestablePart[],
  _opts: Partial<Options> | undefined,
  onApply: OnApply
): void {
  // Remove any stale instance
  document.querySelectorAll("#oc-components-overlay").forEach((n) => n.remove());
  const opts: Options = { title: "Components", ...( _opts || {} ) };

  // Work on a deep-ish clone so we don’t mutate original until Apply
  const data: NestablePart[] = parts.map(p => ({ ...(p as any) }));

  // Collect ALL headers (union of keys across items). Known-first order, then the rest.
  const knownFirst = ["name","materialTag","material","h","w","qty","id","notes1","notes2","edging"];
  const allKeys = Array.from(
    data.reduce<Set<string>>((acc, row) => {
      Object.keys(row || {}).forEach(k => acc.add(k));
      return acc;
    }, new Set<string>(knownFirst))
  );

  // DOM
  const overlay = document.createElement("div");
  overlay.id = "oc-components-overlay";
  overlay.style.position = "fixed";
  overlay.style.inset = "0";
  overlay.style.background = "rgba(0,0,0,0.45)";
  overlay.style.zIndex = String(Z);
  overlay.style.display = "flex";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";

  const panel = document.createElement("div");
  panel.style.width = "min(1200px, 96vw)";
  panel.style.height = "min(92vh, 900px)";
  panel.style.background = "#fff";
  panel.style.borderRadius = "12px";
  panel.style.boxShadow = "0 24px 60px rgba(0,0,0,0.35)";
  panel.style.display = "grid";
  panel.style.gridTemplateRows = "auto 1fr auto";
  panel.style.overflow = "hidden";

  const header = document.createElement("div");
  header.style.display = "flex";
  header.style.alignItems = "center";
  header.style.justifyContent = "space-between";
  header.style.gap = "8px";
  header.style.padding = "8px 10px";
  header.style.borderBottom = "1px solid #e5e7eb";
  const title = document.createElement("h3");
  title.textContent = `${opts.title ?? "Components"} — ${data.length.toLocaleString()} item(s)`;
  title.style.margin = "0";
  title.style.fontSize = "14px";

  const btnRow = document.createElement("div");
  btnRow.style.display = "flex";
  btnRow.style.gap = "8px";

  const btn = (label: string, solid = false) => {
    const b = document.createElement("button");
    b.textContent = label;
    b.type = "button";
    b.style.padding = "6px 10px";
    b.style.border = "1px solid #d1d5db";
    b.style.borderRadius = "8px";
    b.style.cursor = "pointer";
    b.style.background = solid ? "#111827" : "#fff";
    b.style.color = solid ? "#fff" : "#111827";
    return b;
  };

  const addBtn = btn("Add Component");
  const applyBtn = btn("Apply", true);
  const optimizeBtn = btn("Optimize", true);
  const closeBtn = btn("Close");

  btnRow.append(addBtn, applyBtn, optimizeBtn, closeBtn);
  header.append(title, btnRow);

  const body = document.createElement("div");
  body.style.overflow = "auto";

  const footer = document.createElement("div");
  footer.style.display = "flex";
  footer.style.justifyContent = "space-between";
  footer.style.gap = "8px";
  footer.style.padding = "6px 10px";
  footer.style.borderTop = "1px solid #e5e7eb";
  footer.style.fontSize = "12px";
  const hint = document.createElement("div");
  hint.textContent = "Tip: edit cells directly. Numeric fields are auto-parsed.";
  const status = document.createElement("div");
  status.textContent = "";
  footer.append(hint, status);

  panel.append(header, body, footer);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  // Prevent background scroll while open
  const prevOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";

  const teardown = () => {
    document.body.style.overflow = prevOverflow;
    overlay.remove();
  };

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) teardown();
  });
  window.addEventListener("keydown", function onEsc(e) {
    if (e.key === "Escape") { teardown(); window.removeEventListener("keydown", onEsc); }
  });
  closeBtn.addEventListener("click", () => teardown());

  /* ------------------------------- TABLE --------------------------------- */

  const table = document.createElement("table");
  table.style.width = "100%";
  table.style.borderCollapse = "collapse";
  table.style.fontSize = "12px"; // compact
  const thead = document.createElement("thead");
  const trh = document.createElement("tr");
  for (const k of allKeys) {
    const th = document.createElement("th");
    th.textContent = k;
    th.style.position = "sticky";
    th.style.top = "0";
    th.style.background = "#f8fafc";
    th.style.borderBottom = "1px solid #e5e7eb";
    th.style.textAlign = "left";
    th.style.padding = "6px";
    trh.appendChild(th);
  }
  // actions col
  const thA = document.createElement("th");
  thA.textContent = "";
  thA.style.position = "sticky";
  thA.style.top = "0";
  thA.style.background = "#f8fafc";
  thA.style.borderBottom = "1px solid #e5e7eb";
  thA.style.width = "1%";
  trh.appendChild(thA);

  thead.appendChild(trh);
  const tbody = document.createElement("tbody");
  table.append(thead, tbody);
  body.appendChild(table);

  const renderRow = (row: any, idx: number) => {
    const tr = document.createElement("tr");
    tr.style.borderBottom = "1px solid #f1f5f9";
    for (const key of allKeys) {
      const td = document.createElement("td");
      td.style.padding = "4px 6px"; // compact
      td.style.verticalAlign = "middle";

      const val = row?.[key];
      const input = document.createElement("input");
      input.type = isNumericKey(key) ? "number" : "text";
      if (isNumericKey(key)) {
        input.step = key === "qty" ? "1" : "0.01";
      }
      input.value = val == null ? "" : String(val);
      input.style.width = "100%";
      input.style.boxSizing = "border-box";
      input.style.padding = "4px 6px";
      input.style.border = "1px solid #e5e7eb";
      input.style.borderRadius = "6px";
      input.addEventListener("change", () => {
        const newVal = input.value;
        row[key] = isNumericKey(key)
          ? parseNumeric(newVal, key === "qty" ? 0 : 0)
          : (newVal ?? "");
        status.textContent = `Edited row ${idx + 1}, "${key}"`;
      });

      td.appendChild(input);
      tr.appendChild(td);
    }

    const tdAct = document.createElement("td");
    tdAct.style.padding = "4px 6px";
    tdAct.style.whiteSpace = "nowrap";
    const del = btn("Delete");
    del.addEventListener("click", () => {
      data.splice(idx, 1);
      title.textContent = `${opts.title ?? "Components"} — ${data.length.toLocaleString()} item(s)`;
      rebuildBody();
      status.textContent = `Deleted row ${idx + 1}`;
    });
    tdAct.appendChild(del);
    tr.appendChild(tdAct);

    return tr;
  };

  const rebuildBody = () => {
    tbody.innerHTML = "";
    for (let i = 0; i < data.length; i++) {
      tbody.appendChild(renderRow(data[i], i));
    }
  };

  rebuildBody();

  /* ----------------------------- ADD COMPONENT ---------------------------- */

  addBtn.addEventListener("click", () => {
    openAddModal(allKeys, (row) => {
      data.push(row as NestablePart);
      title.textContent = `${opts.title ?? "Components"} — ${data.length.toLocaleString()} item(s)`;
      rebuildBody();
      status.textContent = "Component added.";
    });
  });

  /* ------------------------------- APPLY / OPTIMIZE ----------------------- */

  applyBtn.addEventListener("click", () => {
    onApply(clone(data));
    status.textContent = "Changes applied.";
  });

  optimizeBtn.addEventListener("click", () => {
    onApply(clone(data)); // persist current edits to the app
    // Ask the app to run packing → SVG; the app listens to this.
    window.dispatchEvent(new CustomEvent("oc:optimizeRequested"));
    teardown();
  });
}

/* -------------------------------- helpers --------------------------------- */

function isNumericKey(k: string): boolean {
  return k === "h" || k === "w" || k === "qty";
}
function parseNumeric(v: string, d = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}
function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x));
}

/* --------------------------- Add Component modal -------------------------- */

function openAddModal(allKeys: string[], onCreate: (row: Record<string, unknown>) => void) {
  const overlay = document.createElement("div");
  overlay.style.position = "fixed";
  overlay.style.inset = "0";
  overlay.style.background = "rgba(0,0,0,0.45)";
  overlay.style.zIndex = String(2147483647);
  overlay.style.display = "flex";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";

  const card = document.createElement("div");
  card.style.width = "min(720px, 96vw)";
  card.style.maxHeight = "85vh";
  card.style.overflow = "auto";
  card.style.background = "#fff";
  card.style.borderRadius = "10px";
  card.style.boxShadow = "0 20px 50px rgba(0,0,0,0.35)";
  card.style.padding = "12px";

  const title = document.createElement("h3");
  title.textContent = "Add Component (all fields optional)";
  title.style.margin = "0 0 8px 0";

  const form = document.createElement("div");
  form.style.display = "grid";
  form.style.gridTemplateColumns = "1fr 1fr";
  form.style.gap = "8px";

  const inputs = new Map<string, HTMLInputElement>();

  for (const k of allKeys) {
    const wrap = document.createElement("label");
    wrap.style.display = "grid";
    wrap.style.gap = "4px";
    wrap.style.fontSize = "12px";

    const span = document.createElement("span");
    span.textContent = k;

    const input = document.createElement("input");
    input.type = isNumericKey(k) ? "number" : "text";
    input.style.padding = "6px 8px";
    input.style.border = "1px solid #d1d5db";
    input.style.borderRadius = "8px";

    inputs.set(k, input);
    wrap.append(span, input);
    form.appendChild(wrap);
  }

  const bar = document.createElement("div");
  bar.style.display = "flex";
  bar.style.justifyContent = "flex-end";
  bar.style.gap = "8px";
  bar.style.marginTop = "10px";

  const cancel = document.createElement("button");
  cancel.textContent = "Cancel";
  styleBtn(cancel);
  cancel.onclick = () => overlay.remove();

  const create = document.createElement("button");
  create.textContent = "Create";
  styleBtn(create, true);
  create.onclick = () => {
    const row: Record<string, unknown> = {};
    for (const [k, inp] of inputs) {
      const v = inp.value;
      if (v === "") continue;
      row[k] = isNumericKey(k) ? parseNumeric(v, k === "qty" ? 0 : 0) : v;
    }
    // Ensure minimal required fields if user filled them
    if (row["h"] != null) row["h"] = Number(row["h"]);
    if (row["w"] != null) row["w"] = Number(row["w"]);
    if (row["qty"] != null) row["qty"] = Number(row["qty"]);
    onCreate(row);
    overlay.remove();
  };

  bar.append(cancel, create);
  card.append(title, form, bar);
  overlay.appendChild(card);

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });
  window.addEventListener("keydown", function onEsc(e) {
    if (e.key === "Escape") { overlay.remove(); window.removeEventListener("keydown", onEsc); }
  });

  document.body.appendChild(overlay);
}

function styleBtn(b: HTMLButtonElement, solid = false) {
  b.style.padding = "6px 10px";
  b.style.borderRadius = "8px";
  b.style.border = "1px solid #d1d5db";
  b.style.cursor = "pointer";
  b.style.background = solid ? "#111827" : "#fff";
  b.style.color = solid ? "#fff" : "#111827";
}
