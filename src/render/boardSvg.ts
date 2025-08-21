// src/render/boardSvg.ts
import type { SheetLayout } from "../nesting/types";
import { fmtLen } from "./dimensions";
import { getSettings } from "../state/settings";
import { on, Events } from "../events";
import { exportSvgElement, exportSvgToPng, exportAllSheetsZIP } from "./export";

export function createBoardPager(host: HTMLElement, sheets: SheetLayout[]) {
  host.innerHTML = "";
  let currentSheets: SheetLayout[] = sheets.slice();
  let selectedIndex = 0;
  let svgWrap: HTMLDivElement | null = null;

  const pager = document.createElement("div");
  pager.className = "pager";

  const info = document.createElement("span");
  info.className = "pill";

  const sel = document.createElement("select");
  sel.addEventListener("change", () => { selectedIndex = Number(sel.value || 0); draw(); });

  const expSvg = document.createElement("button");
  expSvg.textContent = "Export SVG";
  expSvg.addEventListener("click", () => {
    const svg = svgWrap?.querySelector("svg") as SVGSVGElement | null;
    if (svg) exportSvgElement(svg, `sheet-${selectedIndex + 1}.svg`);
  });

  const expPng = document.createElement("button");
  expPng.textContent = "Export PNG";
  expPng.addEventListener("click", () => {
    const svg = svgWrap?.querySelector("svg") as SVGSVGElement | null;
    if (svg) exportSvgToPng(svg, `sheet-${selectedIndex + 1}.png`);
  });

  const expZip = document.createElement("button");
  expZip.textContent = "Export All (ZIP)";
  expZip.addEventListener("click", async () => { await exportAllSheetsZIP(currentSheets, "sheets.zip"); });

  pager.append(info, sel, expSvg, expPng, expZip);
  host.appendChild(pager);

  svgWrap = document.createElement("div");
  host.appendChild(svgWrap);

  function refillSelect() {
    sel.innerHTML = "";
    currentSheets.forEach((_, i) => {
      const o = document.createElement("option");
      o.value = String(i);
      o.textContent = `Sheet ${i + 1} / ${currentSheets.length}`;
      sel.appendChild(o);
    });
    info.textContent = `${currentSheets.length} sheet(s)`;
  }

  function draw() {
    if (!svgWrap) return;
    svgWrap.innerHTML = "";
    const idx = Math.min(Math.max(0, selectedIndex), Math.max(0, currentSheets.length - 1));
    const sheet = currentSheets[idx];
    if (!sheet) return;
    renderBoardSvg(svgWrap, sheet);
  }

  refillSelect();
  if (currentSheets.length) { sel.value = "0"; selectedIndex = 0; draw(); }

  on(Events.SETTINGS_UPDATED, () => draw());
}

export function renderBoardSvg(host: HTMLElement, sheet: SheetLayout) {
  host.innerHTML = "";
  const s = getSettings();
  const svg = createSVG(sheet.width, sheet.height);
  svg.classList.add("board");

  const border = rect(0, 0, sheet.width, sheet.height, "#d1d5db", "none");
  border.setAttribute("stroke-width", "1");
  svg.appendChild(border);

  for (const p of sheet.placed) {
    const g = document.createElementNS(svg.namespaceURI, "g");
    const r = rect(p.x, p.y, p.w, p.h, "#111827", "#ffffff");
    r.setAttribute("fill-opacity", "0.85");
    g.appendChild(r);

    if (s.showLabels) {
      const label = text(p.x + 4, p.y + 14, p.name || p.id || "");
      label.setAttribute("font-size", "10");
      label.setAttribute("fill", "#111827");
      g.appendChild(label);
    }
    if (s.showDims) {
      const dim = `${fmtLen(p.w, s.units)} × ${fmtLen(p.h, s.units)}`;
      const tl = text(p.x + p.w - 4, p.y + p.h - 4, dim);
      tl.setAttribute("text-anchor", "end");
      tl.setAttribute("font-size", "9");
      tl.setAttribute("fill", "#374151");
      g.appendChild(tl);
    }

    g.addEventListener("mouseenter", () => {
      svg.style.cursor = "pointer";
      r.setAttribute("stroke", "#2563eb");
      r.setAttribute("stroke-width", "2");
    });
    g.addEventListener("mouseleave", () => {
      svg.style.cursor = "default";
      r.setAttribute("stroke", "#111827");
      r.setAttribute("stroke-width", "1");
    });

    svg.appendChild(g);
  }

  svg.setAttribute("viewBox", `0 0 ${sheet.width} ${sheet.height}`);
  host.appendChild(svg);
  enablePanZoom(svg);
}

/* helpers */
function createSVG(w: number, h: number, ns = "http://www.w3.org/2000/svg"): SVGSVGElement {
  const svg = document.createElementNS(ns, "svg") as unknown as SVGSVGElement;
  svg.setAttribute("width", String(w));
  svg.setAttribute("height", String(h));
  return svg;
}
function rect(x:number,y:number,w:number,h:number,stroke="#000",fill="none") {
  const ns = "http://www.w3.org/2000/svg";
  const r = document.createElementNS(ns, "rect");
  r.setAttribute("x", String(x)); r.setAttribute("y", String(y));
  r.setAttribute("width", String(w)); r.setAttribute("height", String(h));
  r.setAttribute("stroke", stroke); r.setAttribute("fill", fill);
  return r;
}
function text(x:number,y:number,content:string) {
  const ns = "http://www.w3.org/2000/svg";
  const t = document.createElementNS(ns, "text");
  t.setAttribute("x", String(x)); t.setAttribute("y", String(y));
  t.textContent = content; return t;
}
function enablePanZoom(svg: SVGSVGElement) {
  let panning = false, lx = 0, ly = 0;
  let vb = svg.getAttribute("viewBox")?.split(" ").map(Number) || [0,0,svg.clientWidth, svg.clientHeight];
  svg.addEventListener("mousedown", e => { panning = true; lx = e.clientX; ly = e.clientY; });
  window.addEventListener("mouseup", () => { panning = false; });
  window.addEventListener("mousemove", e => {
    if (!panning) return;
    const dx = e.clientX - lx, dy = e.clientY - ly; lx = e.clientX; ly = e.clientY;
    vb[0] -= dx; vb[1] -= dy; svg.setAttribute("viewBox", vb.join(" "));
  });
  svg.addEventListener("wheel", e => {
    e.preventDefault();
    const scale = e.deltaY < 0 ? 0.9 : 1.1;
    const cx = vb[0] + vb[2]/2, cy = vb[1] + vb[3]/2;
    vb[2] *= scale; vb[3] *= scale; vb[0] = cx - vb[2]/2; vb[1] = cy - vb[3]/2;
    svg.setAttribute("viewBox", vb.join(" "));
  }, { passive: false });
}
