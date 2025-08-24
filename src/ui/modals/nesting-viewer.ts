// src/ui/modals/nesting-viewer.ts
import type { SheetLayout, PlacedPart } from "../../nesting/types";
import { renderBoardSvg } from "../../render/boardSvg";
import { on, emit, Events } from "../../events";

export function openNestingViewer(sheets: SheetLayout[]): void {
  if (!sheets || !sheets.length) return;

  const groups = buildGroups(sheets);

  const overlay = document.createElement("div");
  overlay.id = "oc-nesting-viewer";
  overlay.style.position = "fixed";
  overlay.style.inset = "0";
  overlay.style.background = "#ffffff";
  overlay.style.zIndex = "100001";
  overlay.style.display = "flex";
  overlay.style.flexDirection = "column";

  // Top bars
  const top = document.createElement("div");
  top.style.display = "flex";
  top.style.flexDirection = "column";
  top.style.borderBottom = "1px solid #e5e7eb";

  const row1 = document.createElement("div");
  row1.style.display = "flex";
  row1.style.alignItems = "center";
  row1.style.gap = "8px";
  row1.style.padding = "8px 12px";

  const title = document.createElement("div");
  title.textContent = "Nesting Viewer";
  title.style.fontWeight = "700";
  title.style.fontSize = "16px";
  row1.appendChild(title);

  const spacer = document.createElement("div");
  spacer.style.flex = "1 1 auto";
  row1.appendChild(spacer);

  const backBtn = smallBtn("Back");
  row1.append(backBtn);

  const row2 = document.createElement("div");
  row2.style.display = "flex";
  row2.style.alignItems = "center";
  row2.style.gap = "10px";
  row2.style.padding = "8px 12px";
  row2.style.flexWrap = "wrap";
  row2.style.borderTop = "1px solid #f1f5f9";

  // material tabs (board types) left → right with counts
  const tabBar = document.createElement("div");
  tabBar.style.display = "flex";
  tabBar.style.gap = "6px";
  tabBar.style.flexWrap = "wrap";

  const pagesBar = document.createElement("div");
  pagesBar.style.display = "flex";
  pagesBar.style.gap = "4px";
  pagesBar.style.flexWrap = "wrap";

  row2.append(tabBar, pagesBar);
  top.append(row1, row2);

  // Main area: SVG left (auto-fit), list right
  const body = document.createElement("div");
  body.style.flex = "1 1 auto";
  body.style.display = "flex";
  body.style.minHeight = "0"; // allow children to size
  body.style.gap = "0";

  const svgHostWrap = document.createElement("div");
  svgHostWrap.style.flex = "1 1 auto";
  svgHostWrap.style.minWidth = "0";
  svgHostWrap.style.display = "flex";
  svgHostWrap.style.alignItems = "center";
  svgHostWrap.style.justifyContent = "center";
  svgHostWrap.style.background = "#f8fafc";

  const svgHost = document.createElement("div");
  svgHost.style.width = "95vw";
  svgHost.style.height = "75vh";
  svgHost.style.maxWidth = "100%";
  svgHost.style.maxHeight = "100%";
  svgHostWrap.appendChild(svgHost);

  const side = document.createElement("div");
  side.style.width = "320px";
  side.style.borderLeft = "1px solid #e5e7eb";
  side.style.padding = "10px";
  side.style.overflow = "auto";
  side.style.background = "#ffffff";
  side.style.display = "flex";
  side.style.flexDirection = "column";

  const sideTitle = document.createElement("div");
  sideTitle.textContent = "Sheet Parts";
  sideTitle.style.fontWeight = "600";
  sideTitle.style.marginBottom = "8px";
  const sideList = document.createElement("div");
  sideList.style.display = "grid";
  sideList.style.rowGap = "6px";

  const sideFooter = document.createElement("div");
  sideFooter.style.marginTop = "8px";
  sideFooter.style.display = "flex";
  sideFooter.style.gap = "8px";

  const toggleListBtn = smallBtn("Hide Components");
  let sideHidden = false;
  toggleListBtn.onclick = () => {
    sideHidden = !sideHidden;
    sideList.style.display = sideHidden ? "none" : "grid";
    toggleListBtn.textContent = sideHidden ? "Show Components" : "Hide Components";
  };

  sideFooter.append(toggleListBtn);
  side.append(sideTitle, sideList, sideFooter);

  body.append(svgHostWrap, side);

  overlay.append(top, body);
  document.body.appendChild(overlay);

  backBtn.onclick = () => {
    cleanup();
    document.body.removeChild(overlay);
  };

  // selection state so the “Open Selected Details” could be added later if needed
  let lastSelected: { pid: string; part: PlacedPart; sheetIdx: number } | null = null;
  const offSel = on(Events.PART_CLICKED, (p) => { if (p) lastSelected = p; });

  let currentGroupKey = groups.order[0];

  function bindTabs() {
    tabBar.innerHTML = "";
    groups.order.forEach((key) => {
      const count = (groups.map.get(key) || []).length;
      const label = `${key || "Unknown"} (${count})`;
      const b = pillBtn(label);
      b.dataset.groupKey = key;
      if (key === currentGroupKey) selectPill(b, true);
      b.onclick = () => {
        currentGroupKey = key;
        for (const el of tabBar.querySelectorAll("button")) selectPill(el as HTMLButtonElement, false);
        selectPill(b, true);
        renderPageButtons();
        const first = groupSheets()[0];
        if (first !== undefined) showSheet(first);
      };
      tabBar.appendChild(b);
    });
  }

  function groupSheets(): number[] {
    return groups.map.get(currentGroupKey) ?? [];
  }

  function renderPageButtons() {
    pagesBar.innerHTML = "";
    const indices = groupSheets();
    indices.forEach((globalIdx, i) => {
      const b = smallBtn(String(i + 1));
      b.onclick = () => showSheet(globalIdx);
      pagesBar.appendChild(b);
    });
  }

  function showSheet(globalIndex: number) {
    svgHost.innerHTML = "";
    const sheet = sheets[globalIndex];
    if (!sheet) return;

    renderBoardSvg(svgHost, sheet, globalIndex);

    // Force responsive full-board view
    const svg = svgHost.querySelector("svg") as SVGSVGElement | null;
    if (svg) {
      svg.style.width = "100%";
      svg.style.height = "100%";
      svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    }

    // right list
    sideList.innerHTML = "";
    (sheet.placed || []).forEach((p, i) => {
      const row = document.createElement("button");
      row.style.textAlign = "left";
      row.style.border = "1px solid #e5e7eb";
      row.style.background = "#fff";
      row.style.borderRadius = "8px";
      row.style.padding = "8px";
      row.style.cursor = "pointer";
      row.style.display = "grid";
      row.style.rowGap = "2px";
      const name = (p.name || p.id || "part").toString();
      const size = `${Math.round(p.w)} × ${Math.round(p.h)} mm`;
      row.innerHTML = `<strong style="font-weight:600">${escapeHtml(name)}</strong><span style="color:#334155">${escapeHtml(
        size
      )}</span>`;
      row.onclick = () => {
        const pid = partIdFor(p, globalIndex, i);
        emit(Events.PART_CLICKED, { pid, part: p, sheetIdx: globalIndex });
      };
      sideList.appendChild(row);
    });
  }

  bindTabs();
  renderPageButtons();
  const first = groupSheets()[0];
  if (first !== undefined) showSheet(first);

  // Live recolor when printing status changes while viewer is open
  const offColor = on(Events.PART_STATUS_CHANGED, ({ pid, printed }) => {
    const el = svgHost.querySelector<SVGRectElement>(`rect.oc-part[data-pid="${cssEscape(pid)}"]`);
    if (!el) return;
    el.classList.toggle("printed", !!printed);
    el.setAttribute("fill", printed ? "#2563eb" : "#e5e7eb");
    el.classList.remove("selected");
    el.setAttribute("stroke", "#111827");
    el.setAttribute("stroke-width", "1.5");
  });

  function cleanup() { try { offColor(); offSel(); } catch {} }
}

/* ----------------------------- helpers ---------------------------------- */

function smallBtn(label: string): HTMLButtonElement {
  const b = document.createElement("button");
  b.textContent = label;
  b.style.padding = "6px 10px";
  b.style.border = "1px solid #d1d5db";
  b.style.borderRadius = "8px";
  b.style.background = "#fff";
  b.style.cursor = "pointer";
  return b;
}

function pillBtn(label: string): HTMLButtonElement {
  const b = smallBtn(label);
  b.style.borderRadius = "999px";
  return b;
}

function selectPill(b: HTMLButtonElement, on: boolean) {
  b.style.background = on ? "#111827" : "#fff";
  b.style.color = on ? "#fff" : "#111827";
  b.style.borderColor = on ? "#111827" : "#d1d5db";
}

function escapeHtml(s: string) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function cssEscape(s: string): string {
  return s.replace(/["\\]/g, "\\$&");
}

function partIdFor(p: PlacedPart, sheetIdx: number, i: number): string {
  const base = p.id || `${p.name ?? "part"}-${Math.round(p.w)}x${Math.round(p.h)}`;
  return `s${sheetIdx}-i${i}-${base}`;
}

function buildGroups(sheets: SheetLayout[]): {
  order: string[];
  map: Map<string, number[]>; // key -> array of sheet indices
} {
  const map = new Map<string, number[]>();
  sheets.forEach((s, idx) => {
    const first = (s.placed || [])[0] as any;
    const key = (first?.materialTag || first?.material || "").toString();
    const k = key || ""; // empty key = "Unknown"
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(idx);
  });
  const order = [...map.keys()];
  if (!order.length) { map.set("", sheets.map((_, i) => i)); return { order: [""], map }; }
  return { order, map };
}
