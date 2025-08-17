// src/ui/modals/header-map-modal.ts

export type CanonicalKey =
  | "Name"
  | "Material"
  | "Length"
  | "Width"
  | "Qty"
  | "Notes"
  | "Note1"
  | "Note2"
  | "AllowRotate"
  | "EdgeL1"
  | "EdgeL2"
  | "EdgeW1"
  | "EdgeW2";

type Mapping = Record<CanonicalKey, string | null>;

function norm(s: string) {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function preselect(headers: string[], canonical: CanonicalKey, guesses: string[]): string | null {
  const H = headers.map((h) => ({ raw: h, n: norm(h) }));
  for (const g of guesses) {
    const hit = H.find((x) => x.n === norm(g));
    if (hit) return hit.raw;
  }
  const hit2 = H.find((x) => x.n === norm(canonical));
  return hit2 ? hit2.raw : null;
}

function is2DStringArray(v: unknown): v is string[][] {
  return Array.isArray(v) && (v.length === 0 || Array.isArray(v[0]));
}

export function openHeaderMapModal(
  headers: string[],
  onApply: (mapping: Mapping) => void,
  defaults?: Partial<Mapping>,
  sampleRows?: unknown            // <- can be anything; we guard below
) {
  const canonical: CanonicalKey[] = [
    "Name","Material","Length","Width","Qty","Notes","Note1","Note2",
    "AllowRotate","EdgeL1","EdgeL2","EdgeW1","EdgeW2",
  ];

  // SAFETY: coerce sample rows
  const rowsPreview: string[][] = is2DStringArray(sampleRows) ? (sampleRows as string[][]) : [];

  // Right-docked overlay (lets you still see the table on the left)
  const overlay = document.createElement("div");
  overlay.style.position = "fixed";
  overlay.style.inset = "0";
  overlay.style.background = "rgba(0,0,0,0.12)";
  overlay.style.display = "flex";
  overlay.style.justifyContent = "flex-end";
  overlay.style.alignItems = "stretch";
  overlay.style.zIndex = "9999";
  overlay.style.pointerEvents = "none";

  const panel = document.createElement("div");
  panel.style.width = "min(420px, 42vw)";
  panel.style.maxWidth = "420px";
  panel.style.height = "100vh";
  panel.style.background = "#fff";
  panel.style.borderLeft = "1px solid #e5e7eb";
  panel.style.borderRadius = "10px 0 0 10px";
  panel.style.padding = "14px";
  panel.style.boxShadow = "-12px 0 36px rgba(0,0,0,0.18)";
  panel.style.display = "grid";
  panel.style.gridTemplateRows = "auto 1fr auto";
  panel.style.gap = "10px";
  panel.style.pointerEvents = "auto";

  // Title bar with clear close button
  const titleBar = document.createElement("div");
  titleBar.style.display = "flex";
  titleBar.style.alignItems = "center";
  titleBar.style.justifyContent = "space-between";
  titleBar.style.gap = "10px";

  const h2 = document.createElement("h2");
  h2.style.margin = "0";
  h2.style.fontSize = "18px";
  h2.textContent = "Header Mapping";

  const closeBtn = document.createElement("button");
  closeBtn.setAttribute("aria-label", "Close header mapping");
  closeBtn.innerHTML = `<span style="font-weight:700;margin-right:6px;">×</span> Close`;
  closeBtn.style.border = "1px solid #e5e7eb";
  closeBtn.style.background = "#f3f4f6";
  closeBtn.style.color = "#111827";
  closeBtn.style.borderRadius = "8px";
  closeBtn.style.padding = "6px 10px";
  closeBtn.style.cursor = "pointer";
  closeBtn.style.fontWeight = "600";
  closeBtn.onclick = () => document.body.removeChild(overlay);

  titleBar.appendChild(h2);
  titleBar.appendChild(closeBtn);

  // Content
  const content = document.createElement("div");
  content.style.overflow = "auto";
  content.style.minHeight = "0";
  content.style.display = "grid";
  content.style.gap = "12px";

  const mapWrap = document.createElement("div");
  mapWrap.style.border = "1px solid #eee";
  mapWrap.style.borderRadius = "10px";
  mapWrap.style.padding = "10px";
  mapWrap.style.overflow = "auto";

  const mapTable = document.createElement("table");
  mapTable.style.width = "100%";
  mapTable.style.borderCollapse = "collapse";

  const head = document.createElement("thead");
  head.innerHTML = `
    <tr>
      <th style="text-align:left;border-bottom:1px solid #ddd;padding:6px 8px;">Canonical</th>
      <th style="text-align:left;border-bottom:1px solid #ddd;padding:6px 8px;">CSV Header</th>
    </tr>
  `;
  mapTable.appendChild(head);

  const body = document.createElement("tbody");
  const selects: Record<CanonicalKey, HTMLSelectElement> = {} as any;
  const headerOptions = ["(not mapped)", ...headers];

  const guessBag: Partial<Record<CanonicalKey, string[]>> = {
    Name: ["Name"],
    Material: ["Material","Material Tag"],
    Length: ["Length","board length"],
    Width: ["Width","board width"],
    Qty: ["Quantity","Qty"],
    Notes: ["Notes"],
    Note1: ["Note 1"],
    Note2: ["Note 2"],
    AllowRotate: ["Can Rotate (0 = No / 1 = Yes / 2 = Same As Material)"],
    EdgeL1: ["Edging Length 1"],
    EdgeL2: ["Edging Length 2"],
    EdgeW1: ["Edging Width 1"],
    EdgeW2: ["Edging Width 2"],
  };

  for (const c of canonical) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td style="border-bottom:1px solid #eee;padding:6px 8px;font-weight:600;">${c}</td>
      <td style="border-bottom:1px solid #eee;padding:6px 8px;"></td>
    `;
    const sel = document.createElement("select");
    sel.style.minWidth = "260px";
    for (const opt of headerOptions) {
      const o = document.createElement("option");
      o.value = opt === "(not mapped)" ? "" : opt;
      o.textContent = opt;
      sel.appendChild(o);
    }
    const tdSel = tr.children[1] as HTMLTableCellElement;
    const preset = (defaults?.[c] ?? null) || preselect(headers, c, guessBag[c] ?? []);
    sel.value = preset ?? "";
    tdSel.appendChild(sel);
    body.appendChild(tr);
    selects[c] = sel;
  }

  mapTable.appendChild(body);
  mapWrap.appendChild(mapTable);
  content.appendChild(mapWrap);

  // Optional live preview (collapsible)
  if (rowsPreview.length) {
    const previewWrap = document.createElement("div");
    previewWrap.style.border = "1px solid #eee";
    previewWrap.style.borderRadius = "10px";
    previewWrap.style.padding = "10px";
    previewWrap.style.display = "flex";
    previewWrap.style.flexDirection = "column";
    previewWrap.style.gap = "6px";
    previewWrap.style.minHeight = "0";

    const topBar = document.createElement("div");
    topBar.style.display = "flex";
    topBar.style.alignItems = "center";
    topBar.style.justifyContent = "space-between";
    topBar.style.gap = "8px";

    const pTitle = document.createElement("strong");
    pTitle.textContent = "Live Preview (first 15 rows)";

    const toggleBtn = document.createElement("button");
    toggleBtn.textContent = "Show";
    toggleBtn.style.border = "1px solid #ddd";
    toggleBtn.style.background = "#fff";
    toggleBtn.style.color = "#111827";
    toggleBtn.style.borderRadius = "8px";
    toggleBtn.style.padding = "4px 10px";
    toggleBtn.style.cursor = "pointer";

    const previewArea = document.createElement("div");
    previewArea.style.overflow = "auto";
    previewArea.style.minHeight = "0";
    previewArea.style.maxHeight = "40vh";
    previewArea.style.display = "none";

    const cols: CanonicalKey[] = ["Name","Material","Length","Width","Qty","Note1","Note2"];

    function buildMappedPreview() {
      previewArea.innerHTML = "";
      const max = Math.min(15, rowsPreview.length);

      const idx: Record<string, number> = {};
      for (const c of canonical) {
        const chosen = selects[c].value || "";
        idx[c] = headers.indexOf(chosen);
      }

      const table = document.createElement("table");
      table.style.width = "100%";
      table.style.borderCollapse = "collapse";

      const thead = document.createElement("thead");
      const trh = document.createElement("tr");
      for (const col of cols) {
        const th = document.createElement("th");
        th.textContent = col;
        th.style.textAlign = "left";
        th.style.borderBottom = "1px solid #ddd";
        th.style.padding = "6px 8px";
        trh.appendChild(th);
      }
      thead.appendChild(trh);
      table.appendChild(thead);

      const tbody = document.createElement("tbody");
      for (let i = 0; i < max; i++) {
        const row = rowsPreview[i] ?? [];
        const tr = document.createElement("tr");
        for (const col of cols) {
          const j = idx[col];
          const td = document.createElement("td");
          td.textContent = j >= 0 ? (row[j] ?? "") : "";
          td.style.borderBottom = "1px solid #eee";
          td.style.padding = "6px 8px";
          tr.appendChild(td);
        }
        tbody.appendChild(tr);
      }
      table.appendChild(tbody);
      previewArea.appendChild(table);
    }

    let builtOnce = false;
    function ensureBuilt() {
      if (!builtOnce) { buildMappedPreview(); builtOnce = true; }
    }

    for (const c of canonical) {
      selects[c].addEventListener("change", () => {
        if (previewArea.style.display !== "none") buildMappedPreview();
      });
    }

    toggleBtn.onclick = () => {
      const hidden = previewArea.style.display === "none";
      previewArea.style.display = hidden ? "block" : "none";
      toggleBtn.textContent = hidden ? "Hide" : "Show";
      if (hidden) ensureBuilt();
    };

    topBar.appendChild(pTitle);
    topBar.appendChild(toggleBtn);
    previewWrap.appendChild(topBar);
    previewWrap.appendChild(previewArea);
    content.appendChild(previewWrap);
  }

  // Footer
  const footer = document.createElement("div");
  footer.style.display = "flex";
  footer.style.gap = "8px";
  footer.style.justifyContent = "space-between";
  footer.style.alignItems = "center";
  footer.style.borderTop = "1px solid #eee";
  footer.style.paddingTop = "10px";

  const hint = document.createElement("span");
  hint.textContent = "Tip: You can still see the table behind this drawer.";
  hint.style.color = "#6b7280";
  hint.style.fontSize = "12px";

  const actions = document.createElement("div");
  actions.style.display = "flex";
  actions.style.gap = "8px";

  const cancelBtn = document.createElement("button");
  cancelBtn.textContent = "Cancel";
  cancelBtn.style.border = "1px solid #d1d5db";
  cancelBtn.style.background = "#fff";
  cancelBtn.style.color = "#111827";
  cancelBtn.style.borderRadius = "8px";
  cancelBtn.style.padding = "8px 12px";
  cancelBtn.style.cursor = "pointer";
  cancelBtn.onclick = () => document.body.removeChild(overlay);

  const applyBtn = document.createElement("button");
  applyBtn.textContent = "Apply Mapping";
  applyBtn.style.background = "#0d9488";
  applyBtn.style.color = "#fff";
  applyBtn.style.border = "none";
  applyBtn.style.padding = "8px 12px";
  applyBtn.style.borderRadius = "8px";
  applyBtn.style.cursor = "pointer";
  applyBtn.onclick = () => {
    const mapping: Mapping = {} as any;
    for (const c of canonical) mapping[c] = selects[c].value || null;
    document.body.removeChild(overlay);
    onApply(mapping);
  };

  actions.appendChild(cancelBtn);
  actions.appendChild(applyBtn);
  footer.appendChild(hint);
  footer.appendChild(actions);

  panel.appendChild(titleBar);
  panel.appendChild(content);
  panel.appendChild(footer);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  // Escape to close
  const esc = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      document.body.removeChild(overlay);
      window.removeEventListener("keydown", esc);
    }
  };
  window.addEventListener("keydown", esc);
}
