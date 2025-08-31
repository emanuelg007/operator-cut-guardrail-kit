// src/render/boardSvg.ts
import type { SheetLayout, PlacedPart } from "../nesting/types";
import { getSettings } from "../state/settings";
import { on, emit, Events } from "../events";
import { isPrinted } from "../state/partStatus";

/** Toolbar + one-at-a-time sheet viewer (kept for inline dev preview) */
export function createBoardPager(host: HTMLElement, sheets: SheetLayout[]) {
  host.innerHTML = "";
  let idx = 0;

  const bar = document.createElement("div");
  bar.style.cssText = "display:flex;gap:8px;align-items:center;margin-bottom:8px;flex-wrap:wrap;";

  const info = document.createElement("span");
  info.textContent = `${sheets.length} sheet(s)`;

  const select = document.createElement("select");
  sheets.forEach((_, i) => {
    const o = document.createElement("option");
    o.value = String(i);
    o.textContent = `Sheet ${i + 1}`;
    select.appendChild(o);
  });
  select.onchange = () => { idx = Number(select.value || 0); draw(); };

  bar.append(info, select);
  host.appendChild(bar);

  const mount = document.createElement("div");
  // Landscape viewing area with fixed height
  mount.style.cssText = "width:100%;height:min(78vh,820px);background:#f3f4f6;border:1px solid #cbd5e1;border-radius:10px;overflow:hidden;";
  host.appendChild(mount);

  function draw() {
    mount.innerHTML = "";
    const sheet = sheets[idx];
    if (!sheet) return;
    renderBoardSvg(mount, sheet, idx);
  }

  draw();
  on(Events.SETTINGS_UPDATED, () => draw());
}

/** Draw a single sheet (landscape, bold strokes, dims, legend, pan/zoom) */
export function renderBoardSvg(host: HTMLElement, sheet: SheetLayout, sheetIdx = 0) {
  host.innerHTML = "";
  const S = getSettings();
  const V = S.svgStyle;

  const wrap = document.createElement("div");
  wrap.style.cssText = "position:relative;width:100%;height:100%;background:#f3f4f6;";
  host.appendChild(wrap);

  const svg = svgEl();
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "100%");
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  svg.setAttribute("viewBox", `0 0 ${Math.max(1, sheet.width)} ${Math.max(1, sheet.height)}`);
  (svg.style as any).touchAction = "none";
  wrap.appendChild(svg);

  // Board outline
  const gBoard = gEl();
  const board = rect(0, 0, sheet.width, sheet.height, V.boardStroke, V.boardFill, V.boardStrokeWidth);
  gBoard.appendChild(board);
  svg.appendChild(gBoard);

  // Board dimensions outside: top & right
  const topTxt = txt(sheet.width / 2, -8, fmtLen(sheet.width, S.units), V.dimColor, S.svgFont, 1.0);
  topTxt.setAttribute("text-anchor", "middle");
  svg.appendChild(topTxt);

  const rightTxt = txt(sheet.width + 8, sheet.height / 2, fmtLen(sheet.height, S.units), V.dimColor, S.svgFont, 1.0);
  rightTxt.setAttribute("text-anchor", "start");
  rightTxt.setAttribute("transform", `rotate(90 ${sheet.width + 8} ${sheet.height / 2})`);
  svg.appendChild(rightTxt);

  // Parts
  sheet.placed.forEach((p, i) => drawPart(svg, p, sheetIdx, i));

  // Edging legend by the right side of the board
  drawLegend(svg, sheet.width + 40, 20);

  // Click board to clear selection
  board.addEventListener("click", () => {
    svg.querySelectorAll<SVGRectElement>("rect.oc-part.selected").forEach(el => {
      el.classList.remove("selected");
      el.setAttribute("stroke", V.partStroke);
      el.setAttribute("stroke-width", String(V.partStrokeWidth));
    });
  });

  enablePanZoom(svg);

  // Live re-render when settings change
  on(Events.SETTINGS_UPDATED, () => {
    if (!svg.isConnected) return;
    renderBoardSvg(host, sheet, sheetIdx);
  });
}

/* -------------------------------- helpers -------------------------------- */

function svgEl(): SVGSVGElement {
  return document.createElementNS("http://www.w3.org/2000/svg", "svg") as SVGSVGElement;
}
function gEl(): SVGGElement {
  return document.createElementNS("http://www.w3.org/2000/svg", "g") as SVGGElement;
}
function line(x1:number,y1:number,x2:number,y2:number, stroke:string, width:number, dash?:string) {
  const ln = document.createElementNS("http://www.w3.org/2000/svg", "line");
  ln.setAttribute("x1", String(x1)); ln.setAttribute("y1", String(y1));
  ln.setAttribute("x2", String(x2)); ln.setAttribute("y2", String(y2));
  ln.setAttribute("stroke", stroke);
  ln.setAttribute("stroke-width", String(width));
  if (dash) ln.setAttribute("stroke-dasharray", dash);
  ln.setAttribute("pointer-events", "none");
  return ln as SVGLineElement;
}
function rect(x:number,y:number,w:number,h:number, stroke:string, fill:string, sw=1) {
  const r = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  r.setAttribute("x", String(x)); r.setAttribute("y", String(y));
  r.setAttribute("width", String(w)); r.setAttribute("height", String(h));
  r.setAttribute("stroke", stroke); r.setAttribute("fill", fill); r.setAttribute("stroke-width", String(sw));
  return r as SVGRectElement;
}
function txt(x:number,y:number, content:string, color:string, font:{family:string;size:number}, scale=1) {
  const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
  t.setAttribute("x", String(x)); t.setAttribute("y", String(y));
  t.textContent = content;
  t.setAttribute("fill", color);
  t.setAttribute("font-size", String(Math.max(10, Math.round(font.size * scale))));
  t.setAttribute("font-family", font.family);
  t.setAttribute("paint-order", "stroke");
  t.setAttribute("stroke", "#ffffff");
  t.setAttribute("stroke-width", "0.6");
  return t as SVGTextElement;
}
function fmtLen(mm:number, units:"mm"|"in") {
  if (units === "in") return `${(mm/25.4).toFixed(2)} in`;
  return `${Math.round(mm)} mm`;
}
function partId(p:PlacedPart, sheetIdx:number, i:number) {
  const base = (p as any).id || p.name || `${Math.round(p.w)}x${Math.round(p.h)}`;
  return `s${sheetIdx}-i${i}-${base}`;
}

function drawPart(svg: SVGSVGElement, p: PlacedPart, sheetIdx: number, i: number) {
  const S = getSettings();
  const V = S.svgStyle;
  const pid = partId(p, sheetIdx, i);

  const g = gEl();

  // Main part rect
  const fill = isPrinted(pid) ? V.partPrintedFill : V.partFill;
  const r = rect(p.x, p.y, p.w, p.h, V.partStroke, fill, Math.max(2, V.partStrokeWidth));
  r.classList.add("oc-part");
  r.setAttribute("data-pid", pid);

  // Hover/selection
  const highlight = () => {
    if (!r.classList.contains("selected")) {
      r.setAttribute("stroke", "#7c3aed");
      r.setAttribute("stroke-width", String(V.partStrokeWidth + 1));
    }
  };
  const unhighlight = () => {
    if (!r.classList.contains("selected")) {
      r.setAttribute("stroke", V.partStroke);
      r.setAttribute("stroke-width", String(V.partStrokeWidth));
    }
  };
  g.addEventListener("mouseenter", () => { svg.style.cursor = "pointer"; highlight(); });
  g.addEventListener("mouseleave", () => { svg.style.cursor = "default"; unhighlight(); });

  r.addEventListener("click", (ev) => {
    ev.stopPropagation();
    svg.querySelectorAll<SVGRectElement>("rect.oc-part.selected").forEach(el => {
      el.classList.remove("selected");
      el.setAttribute("stroke", V.partStroke);
      el.setAttribute("stroke-width", String(V.partStrokeWidth));
    });
    r.classList.add("selected");
    r.setAttribute("stroke", "#7c3aed");
    r.setAttribute("stroke-width", String(V.partStrokeWidth + 1));
  });

  const openDetails = () => emit(Events.PART_CLICKED, { pid, part: p, sheetIdx });
  r.addEventListener("dblclick", (e) => { e.stopPropagation(); openDetails(); });
  r.addEventListener("touchend", (e) => { e.stopPropagation(); openDetails(); }, { passive: true });

  // Dashed “cut line” inset
  const inset = Math.max(0.5, S.kerf / 2);
  const cut = rect(p.x + inset, p.y + inset, Math.max(0, p.w - 2*inset), Math.max(0, p.h - 2*inset), V.cutLineColor, "none", Math.max(2, V.cutLineWidth));
  cut.setAttribute("stroke-dasharray", "6 6");
  cut.setAttribute("pointer-events", "none");

  // Name centered along the long side (inside)
  const name = String(p.name ?? (p as any).id ?? "");
  const cx = p.x + p.w/2, cy = p.y + p.h/2;
  const nameTxt = txt(cx, cy, name, V.labelColor, S.svgFont, 1.15);
  nameTxt.setAttribute("text-anchor", "middle");
  if (p.h > p.w) nameTxt.setAttribute("transform", `rotate(-90 ${cx} ${cy})`);

  // Dimensions INSIDE the part (long & short)
  const longIsW = p.w >= p.h;
  const longStr = fmtLen(longIsW ? p.w : p.h, S.units);
  const shortStr = fmtLen(longIsW ? p.h : p.w, S.units);

  const longTxt = txt(cx, cy + (longIsW ? p.h/2 - 10 : 0), longStr, V.dimColor, S.svgFont, 1.0);
  longTxt.setAttribute("text-anchor", "middle");
  if (!longIsW) longTxt.setAttribute("transform", `rotate(-90 ${cx} ${cy})`);

  const shortTxt = txt(cx + (longIsW ? p.w/2 - 10 : 0), cy, shortStr, V.dimColor, S.svgFont, 1.0);
  shortTxt.setAttribute("text-anchor", "middle");
  if (longIsW) shortTxt.setAttribute("transform", `rotate(-90 ${cx} ${cy})`);

  // Tooltip
  if (S.svgStyle.showTooltips) {
    const t = document.createElementNS(svg.namespaceURI, "title");
    t.textContent = `${name} — ${fmtLen(p.w, S.units)} × ${fmtLen(p.h, S.units)}`;
    r.appendChild(t);
  }

  // Optional edging
  drawEdging(svg, p);

  g.append(r, cut, nameTxt, longTxt, shortTxt);
  svg.appendChild(g);
}

function drawEdging(svg: SVGSVGElement, p: PlacedPart) {
  const V = getSettings().svgStyle as any;
  // Tolerate missing new edge colors in settings by defaulting to dimColor
  const fallback = (c?: string) => c || getSettings().svgStyle.dimColor;
  const styles = {
    solid: { col: fallback((V as any).edgeSolidColor),     dash: "" },
    short: { col: fallback((V as any).edgeShortDashColor), dash: "6 4" },
    long:  { col: fallback((V as any).edgeLongDashColor),  dash: "12 8" },
    dot:   { col: fallback((V as any).edgeDotColor),       dash: "1 6" },
  };
  const resolve = (s?: string) => {
    const v = (s || "").toLowerCase();
    if (v.includes("short")) return styles.short;
    if (v.includes("long"))  return styles.long;
    if (v.includes("dot"))   return styles.dot;
    return styles.solid;
  };

  const all = (p as any).edging as string | undefined;
  const top = (p as any).edgeTop ?? !!all;
  const right = (p as any).edgeRight ?? !!all;
  const bottom = (p as any).edgeBottom ?? !!all;
  const left = (p as any).edgeLeft ?? !!all;
  const st = resolve(all);

  const lw = Math.max(2, getSettings().svgStyle.partStrokeWidth);
  const x1 = p.x, y1 = p.y, x2 = p.x + p.w, y2 = p.y + p.h;

  if (top)    svg.appendChild(line(x1, y1, x2, y1, st.col, lw, st.dash));
  if (right)  svg.appendChild(line(x2, y1, x2, y2, st.col, lw, st.dash));
  if (bottom) svg.appendChild(line(x2, y2, x1, y2, st.col, lw, st.dash));
  if (left)   svg.appendChild(line(x1, y2, x1, y1, st.col, lw, st.dash));
}

function drawLegend(svg: SVGSVGElement, x: number, y: number) {
  const S = getSettings();
  const V = S.svgStyle as any;
  const items = [
    { name: "Solid",  col: (V as any).edgeSolidColor || V.dimColor,      dash: "" },
    { name: "Short",  col: (V as any).edgeShortDashColor || V.dimColor,  dash: "6 4" },
    { name: "Long",   col: (V as any).edgeLongDashColor || V.dimColor,   dash: "12 8" },
    { name: "Dotted", col: (V as any).edgeDotColor || V.dimColor,        dash: "1 6" },
  ];
  items.forEach((it, i) => {
    const yy = y + i * 24;
    svg.appendChild(line(x, yy, x + 60, yy, it.col, 3, it.dash));
    const label = txt(x + 70, yy + 4, it.name, V.dimColor, S.svgFont, 0.95);
    label.setAttribute("text-anchor", "start");
    svg.appendChild(label);
  });
}

function enablePanZoom(svg: SVGSVGElement) {
  let panning = false, lx = 0, ly = 0;
  let vb = svg.getAttribute("viewBox")?.split(" ").map(Number) || [0, 0, svg.clientWidth, svg.clientHeight];

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
    const cx = vb[0] + vb[2] / 2, cy = vb[1] + vb[3] / 2;
    vb[2] *= scale; vb[3] *= scale;
    vb[0] = cx - vb[2] / 2; vb[1] = cy - vb[3] / 2;
    svg.setAttribute("viewBox", vb.join(" "));
  }, { passive: false });
}
