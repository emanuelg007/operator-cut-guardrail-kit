// src/ui/modals/svg-modal.ts
import type { SheetLayout, PlacedPart } from "../../nesting/types";
import { renderBoardSvg } from "../../render/boardSvg";
import { emit, Events } from "../../events";

export function openSvgModal(sheets: SheetLayout[]) {
  // group sheets by board/material type
  const groups = groupByType(sheets);
  const types = Object.keys(groups);
  let curType = types[0] ?? "";
  let curIndex = 0;

  const ov = document.createElement("div");
  ov.id = "oc-svg-overlay";
  ov.style.cssText = "position:fixed;inset:0;background:#0b1220;z-index:2147483400;display:flex;flex-direction:column;color:#e5e7eb;";

  // top bar
  const top = document.createElement("div");
  top.style.cssText = "display:flex;align-items:center;gap:10px;padding:8px 12px;background:#111827;border-bottom:1px solid #1f2937;";

  const back = button("← Back", () => { ov.remove(); });
  top.appendChild(back);

  // type tabs
  const tabs = document.createElement("div");
  tabs.style.cssText = "display:flex;gap:6px;margin-left:6px;flex-wrap:wrap;";
  top.appendChild(tabs);

  // sheet selector
  const sheetBar = document.createElement("div");
  sheetBar.style.cssText = "margin-left:auto;display:flex;gap:6px;flex-wrap:wrap;";
  top.appendChild(sheetBar);

  // main content
  const main = document.createElement("div");
  main.style.cssText = "flex:1;display:grid;grid-template-columns: 1fr min(340px,28vw);gap:10px;overflow:hidden;";

  const left = document.createElement("div");
  left.style.cssText = "background:#f3f4f6; position:relative;";
  const svgMount = document.createElement("div");
  svgMount.style.cssText = "position:absolute; inset:0;";
  left.appendChild(svgMount);

  const right = document.createElement("div");
  right.style.cssText = "background:#111827;border-left:1px solid #1f2937;overflow:auto;padding:8px;";

  main.append(left, right);

  ov.append(top, main);
  document.body.appendChild(ov);

  // build tabs
  function refreshTabs() {
    tabs.innerHTML = "";
    for (const t of types) {
      const b = tag(t, t === curType, () => {
        curType = t; curIndex = 0;
        refreshSheetBar(); draw();
      });
      tabs.appendChild(b);
    }
  }
  function refreshSheetBar() {
    sheetBar.innerHTML = "";
    const list = groups[curType] || [];
    list.forEach((_, i) => {
      const b = pill(String(i + 1), i === curIndex, () => { curIndex = i; draw(); });
      sheetBar.appendChild(b);
    });
  }
  function draw() {
    svgMount.innerHTML = "";
    const s = (groups[curType] || [])[curIndex];
    if (!s) return;
    renderBoardSvg(svgMount, s, curIndex);

    // right list of components on this sheet
    right.innerHTML = "";
    const title = document.createElement("div");
    title.textContent = `Sheet ${curIndex + 1} — Components`;
    title.style.cssText = "font-weight:800;margin:4px 0 8px;";
    right.appendChild(title);

    const ul = document.createElement("div");
    ul.style.cssText = "display:flex;flex-direction:column;gap:6px;";
    s.placed.forEach((p, i) => {
      const row = document.createElement("div");
      row.style.cssText = "display:flex;gap:8px;align-items:center;padding:6px 8px;border:1px solid #1f2937;border-radius:8px;background:#0f172a;";
      const name = document.createElement("div");
      name.textContent = (p.name || (p as any).id || `#${i+1}`).toString();
      name.style.flex = "1";
      const btn = document.createElement("button");
      btn.textContent = "Details";
      btn.style.cssText = "padding:4px 10px;border:1px solid #334155;border-radius:8px;background:#111827;color:#e5e7eb;cursor:pointer;";
      btn.onclick = () => emit(Events.PART_CLICKED, { pid: `s${curIndex}-i${i}-${(p as any).id || p.name || ""}`, part: p, sheetIdx: curIndex });
      row.append(name, btn);
      ul.appendChild(row);
    });
    right.appendChild(ul);
  }

  refreshTabs();
  refreshSheetBar();
  draw();

  function groupByType(sheets: SheetLayout[]): Record<string, SheetLayout[]> {
    const out: Record<string, SheetLayout[]> = {};
    for (const sh of sheets) {
      const t = (sh as any).materialTag || (sh as any).board?.materialTag || (sh as any).boardType || "Unknown";
      (out[t] ||= []).push(sh);
    }
    return out;
  }

  function tag(label: string, active: boolean, onClick: () => void) {
    const b = document.createElement("button");
    b.type = "button"; b.textContent = label;
    b.style.cssText = `
      padding:6px 10px;border-radius:999px;cursor:pointer;
      border:1px solid ${active ? "#60a5fa" : "#1f2937"};
      background:${active ? "#1d4ed8" : "#0f172a"}; color:#fff; font-weight:${active ? "700" : "500"};
    `;
    b.onclick = onClick;
    return b;
  }
  function pill(label: string, active: boolean, onClick: () => void) {
    const b = document.createElement("button");
    b.type = "button"; b.textContent = label;
    b.style.cssText = `
      padding:6px 10px;border-radius:8px;cursor:pointer;
      border:1px solid ${active ? "#60a5fa" : "#334155"};
      background:${active ? "#1d4ed8" : "#111827"}; color:#fff; font-weight:${active ? "700" : "500"};
    `;
    b.onclick = onClick;
    return b;
  }
}
