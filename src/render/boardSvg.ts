// src/render/boardSvg.ts
import type { SheetLayout, PlacedPart } from "../nesting/types";
import { fmtLen } from "./dimensions";
import { getSettings } from "../state/settings";
import { on, emit, Events } from "../events";
import { isPrinted } from "../state/partStatus";
import { exportSvgElement, exportSvgToPng, exportAllSheetsZIP } from "./export";

/* -------------------------------------------------------------------------- */
/*                              Public interface                               */
/* -------------------------------------------------------------------------- */

/** Legacy pager for inline view; keeps working alongside fullscreen modal */
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
  sel.addEventListener("change", () => {
    selectedIndex = Number(sel.value || 0);
    draw();
  });

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
  expZip.addEventListener("click", async () => {
    await exportAllSheetsZIP(currentSheets, "sheets.zip");
  });

  pager.append(info, sel, expSvg, expPng, expZip);
  host.appendChild(pager);

  svgWrap = document.createElement("div");
  svgWrap.style.width = "100%";
  svgWrap.style.height = "70vh";
  svgWrap.style.border = "1px solid #e5e7eb";
  svgWrap.style.borderRadius = "10px";
  svgWrap.style.overflow = "hidden";
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
    renderBoardSvg(svgWrap, sheet, idx);
  }

  refillSelect();
  if (currentSheets.length) {
    sel.value = "0";
    selectedIndex = 0;
    draw();
  }

  on(Events.SETTINGS_UPDATED, () => draw());

  // recolor one rect on status changes without full re-render
  on(Events.PART_STATUS_CHANGED, ({ pid, printed }) => {
    if (!svgWrap) return;
    const el = svgWrap.querySelector<SVGRectElement>(`rect.oc-part[data-pid="${cssEscape(pid)}"]`);
    if (!el) return;
    const S = getSettings();
    el.classList.toggle("printed", !!printed);
    el.setAttribute("fill", printed ? S.svgStyle.partPrintedFill : S.svgStyle.partFill);
    el.classList.remove("selected");
    el.setAttribute("stroke", S.svgStyle.partStroke);
    el.setAttribute("stroke-width", String(S.svgStyle.partStrokeWidth));
  });
}

/**
 * Render a single sheet into host. Landscape-first viewport; if the board is
 * portrait we rotate it so the viewport stays landscape, while the whole board
 * remains visible. Touch-friendly pan/zoom; labels inside parts.
 */
export function renderBoardSvg(host: HTMLElement, sheet: SheetLayout, sheetIdx = 0) {
  host.innerHTML = "";
  const S = getSettings();

  // Keep a landscape viewport by rotating tall boards
  const rotate = sheet.width < sheet.height;
  const viewW = rotate ? sheet.height : sheet.width;
  const viewH = rotate ? sheet.width : sheet.height;

  const svg = createSVG(viewW, viewH);
  svg.classList.add("board");
  svg.setAttribute("viewBox", `0 0 ${viewW} ${viewH}`);
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "100%");
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  svg.style.background = "#ffffff";

  // Root <g> for optional rotation — cast to SVGGElement for TS
  const gRoot = document.createElementNS(svg.namespaceURI, "g") as SVGGElement;
  if (rotate) {
    gRoot.setAttribute("transform", `rotate(90) translate(0 ${-sheet.width})`);
  }
  svg.appendChild(gRoot);

  // Board outline
  const border = rect(0, 0, sheet.width, sheet.height, S.svgStyle.boardStroke, S.svgStyle.boardFill);
  border.setAttribute("stroke-width", String(S.svgStyle.boardStrokeWidth));
  border.addEventListener("click", () => clearSelection(svg, S));
  gRoot.appendChild(border);

  // Board dimensions (outside the board)
  drawBoardDimensions(gRoot, sheet, S);

  // Parts
  sheet.placed.forEach((p, idx) => {
    drawPart(gRoot, p, sheetIdx, idx, S);
  });

  host.appendChild(svg);
  enablePanZoom(svg);
}

/* -------------------------------------------------------------------------- */
/*                                   helpers                                  */
/* -------------------------------------------------------------------------- */

function drawPart(root: SVGGElement, p: PlacedPart, sheetIdx: number, idx: number, S: ReturnType<typeof getSettings>) {
  const ns = root.namespaceURI!;
  const svg = root.ownerSVGElement!;
  const pid = partIdFor(p, sheetIdx, idx);
  const printed = isPrinted(pid);

  const g = document.createElementNS(ns, "g") as SVGGElement;
  g.classList.add("oc-part-wrap");

  // main rectangle
  const r = rect(p.x, p.y, p.w, p.h, S.svgStyle.partStroke, printed ? S.svgStyle.partPrintedFill : S.svgStyle.partFill);
  r.classList.add("oc-part");
  r.setAttribute("data-pid", pid);
  r.setAttribute("fill-opacity", "1.0");
  r.setAttribute("stroke-width", String(S.svgStyle.partStrokeWidth));

  if (S.svgStyle.showTooltips) {
    const titleEl = document.createElementNS(ns, "title");
    titleEl.textContent = `${p.name || p.id || ""} — ${fmtLen(p.w, S.units)} × ${fmtLen(p.h, S.units)}`;
    r.appendChild(titleEl);
  }

  // Touch target "aura"
  if (S.svgStyle.touchTargetPadding > 0) {
    const pad = S.svgStyle.touchTargetPadding;
    const aura = rect(p.x - pad, p.y - pad, p.w + pad * 2, p.h + pad * 2, "transparent", "transparent");
    aura.setAttribute("pointer-events", "fill");
    aura.addEventListener("mouseenter", () => {
      svg.style.cursor = "pointer";
      if (!r.classList.contains("selected")) {
        r.setAttribute("stroke", "#1d4ed8");
        r.setAttribute("stroke-width", String(S.svgStyle.partStrokeWidth + 1));
      }
    });
    aura.addEventListener("mouseleave", () => {
      svg.style.cursor = "default";
      if (!r.classList.contains("selected")) {
        r.setAttribute("stroke", S.svgStyle.partStroke);
        r.setAttribute("stroke-width", String(S.svgStyle.partStrokeWidth));
      }
    });
    aura.addEventListener("click", (ev) => {
      ev.stopPropagation();
      selectPart(svg, r, S);
    });
    aura.addEventListener("dblclick", (ev) => {
      ev.stopPropagation();
      emit(Events.PART_CLICKED, { pid, part: p, sheetIdx });
    });
    g.appendChild(aura);
  }

  // Hover / click on rect too
  r.addEventListener("mouseenter", () => {
    svg.style.cursor = "pointer";
    if (!r.classList.contains("selected")) {
      r.setAttribute("stroke", "#1d4ed8");
      r.setAttribute("stroke-width", String(S.svgStyle.partStrokeWidth + 1));
    }
  });
  r.addEventListener("mouseleave", () => {
    svg.style.cursor = "default";
    if (!r.classList.contains("selected")) {
      r.setAttribute("stroke", S.svgStyle.partStroke);
      r.setAttribute("stroke-width", String(S.svgStyle.partStrokeWidth));
    }
  });
  r.addEventListener("click", (ev) => {
    ev.stopPropagation();
    selectPart(svg, r, S);
  });
  r.addEventListener("dblclick", (ev) => {
    ev.stopPropagation();
    emit(Events.PART_CLICKED, { pid, part: p, sheetIdx });
  });

  g.appendChild(r);

  // Dashed "cut line" inset by kerf/2
  const inset = Math.max(0, (S.kerf ?? 0) / 2);
  if (inset > 0 && p.w - inset * 2 > 0 && p.h - inset * 2 > 0) {
    const dashed = rect(p.x + inset, p.y + inset, p.w - inset * 2, p.h - inset * 2, S.svgStyle.cutLineColor, "none");
    dashed.setAttribute("stroke-dasharray", "6 4");
    dashed.setAttribute("stroke-width", String(S.svgStyle.cutLineWidth));
    dashed.setAttribute("pointer-events", "none");
    g.appendChild(dashed);
  }

  // Labels inside the part
  const longIsX = p.w >= p.h;
  const midX = p.x + p.w / 2;
  const midY = p.y + p.h / 2;

  // Name centered along long axis
  const name = text(midX, midY, p.name || p.id || "");
  name.setAttribute("font-family", S.svgFont.family);
  name.setAttribute("font-size", String(Math.max(10, S.svgFont.size)));
  name.setAttribute("fill", S.svgStyle.labelColor);
  name.setAttribute("font-weight", "700");
  name.setAttribute("text-anchor", "middle");
  name.setAttribute("dominant-baseline", "middle");
  if (!longIsX) name.setAttribute("transform", `rotate(-90 ${midX} ${midY})`);
  g.appendChild(name);

  // Dimensions (inside)
  const dimLong = `${fmtLen(longIsX ? p.w : p.h, S.units)}`;
  const dimShort = `${fmtLen(longIsX ? p.h : p.w, S.units)}`;

  // Long side label
  const longLabel = text(midX, midY + (longIsX ? p.h * 0.18 : 0), dimLong);
  longLabel.setAttribute("font-family", S.svgFont.family);
  longLabel.setAttribute("font-size", String(Math.max(9, S.svgFont.size - 1)));
  longLabel.setAttribute("fill", S.svgStyle.dimColor);
  longLabel.setAttribute("text-anchor", "middle");
  longLabel.setAttribute("dominant-baseline", "middle");
  if (!longIsX) longLabel.setAttribute("transform", `rotate(-90 ${midX} ${midY + p.w * 0.18})`);
  g.appendChild(longLabel);

  // Short side label
  const shortLabel = text(midX + (longIsX ? 0 : p.h * 0.18), midY, dimShort);
  shortLabel.setAttribute("font-family", S.svgFont.family);
  shortLabel.setAttribute("font-size", String(Math.max(9, S.svgFont.size - 1)));
  shortLabel.setAttribute("fill", S.svgStyle.dimColor);
  shortLabel.setAttribute("text-anchor", "middle");
  shortLabel.setAttribute("dominant-baseline", "middle");
  if (longIsX) shortLabel.setAttribute("transform", `rotate(-90 ${midX} ${midY})`);
  g.appendChild(shortLabel);

  root.appendChild(g);
}

function drawBoardDimensions(root: SVGGElement, sheet: SheetLayout, S: ReturnType<typeof getSettings>) {
  // Board size labels outside the board
  const topCenterX = sheet.width / 2;
  const topY = -8;
  const rightX = sheet.width + 8;
  const rightCenterY = sheet.height / 2;

  const wTxt = text(topCenterX, topY, `${fmtLen(sheet.width, S.units)}`);
  wTxt.setAttribute("font-family", S.svgFont.family);
  wTxt.setAttribute("font-size", String(Math.max(11, S.svgFont.size)));
  wTxt.setAttribute("fill", S.svgStyle.dimColor);
  wTxt.setAttribute("text-anchor", "middle");
  wTxt.setAttribute("dominant-baseline", "baseline");

  const hTxt = text(rightX, rightCenterY, `${fmtLen(sheet.height, S.units)}`);
  hTxt.setAttribute("font-family", S.svgFont.family);
  hTxt.setAttribute("font-size", String(Math.max(11, S.svgFont.size)));
  hTxt.setAttribute("fill", S.svgStyle.dimColor);
  hTxt.setAttribute("text-anchor", "start");
  hTxt.setAttribute("dominant-baseline", "middle");
  hTxt.setAttribute("transform", `rotate(-90 ${rightX} ${rightCenterY})`);

  root.appendChild(wTxt);
  root.appendChild(hTxt);
}

function selectPart(svg: SVGSVGElement, r: SVGRectElement, S: ReturnType<typeof getSettings>) {
  clearSelection(svg, S);
  r.classList.add("selected");
  r.setAttribute("stroke", "#7c3aed");
  r.setAttribute("stroke-width", String(S.svgStyle.partStrokeWidth + 1.5));
}

function clearSelection(svg: SVGSVGElement, S: ReturnType<typeof getSettings>) {
  for (const other of svg.querySelectorAll<SVGRectElement>("rect.oc-part.selected")) {
    other.classList.remove("selected");
    other.setAttribute("stroke", S.svgStyle.partStroke);
    other.setAttribute("stroke-width", String(S.svgStyle.partStrokeWidth));
  }
}

function createSVG(w: number, h: number, ns = "http://www.w3.org/2000/svg"): SVGSVGElement {
  const svg = document.createElementNS(ns, "svg") as unknown as SVGSVGElement;
  svg.setAttribute("width", String(w));
  svg.setAttribute("height", String(h));
  return svg;
}
function rect(x: number, y: number, w: number, h: number, stroke = "#000", fill = "none") {
  const ns = "http://www.w3.org/2000/svg";
  const r = document.createElementNS(ns, "rect");
  r.setAttribute("x", String(x));
  r.setAttribute("y", String(y));
  r.setAttribute("width", String(w));
  r.setAttribute("height", String(h));
  r.setAttribute("stroke", stroke);
  r.setAttribute("fill", fill);
  return r as SVGRectElement;
}
function text(x: number, y: number, content: string) {
  const ns = "http://www.w3.org/2000/svg";
  const t = document.createElementNS(ns, "text");
  t.setAttribute("x", String(x));
  t.setAttribute("y", String(y));
  t.textContent = content;
  return t;
}

function partIdFor(p: PlacedPart, sheetIdx: number, i: number): string {
  const base = p.id || `${p.name ?? "part"}-${Math.round(p.w)}x${Math.round(p.h)}`;
  return `s${sheetIdx}-i${i}-${base}`;
}

function cssEscape(s: string): string {
  return s.replace(/["\\]/g, "\\$&");
}

/** Touch-friendly pan & zoom (mouse + touch) */
function enablePanZoom(svg: SVGSVGElement) {
  const vb = svg.getAttribute("viewBox")?.split(" ").map(Number) as number[] | null;
  let view: [number, number, number, number];
  if (vb && vb.length === 4) view = [vb[0], vb[1], vb[2], vb[3]];
  else view = [0, 0, svg.clientWidth || 100, svg.clientHeight || 100];

  let isPanning = false;
  let lastX = 0, lastY = 0;

  const startPan = (x: number, y: number) => { isPanning = true; lastX = x; lastY = y; };
  const movePan = (x: number, y: number) => {
    if (!isPanning) return;
    const dx = x - lastX, dy = y - lastY;
    lastX = x; lastY = y;
    view[0] -= dx;
    view[1] -= dy;
    svg.setAttribute("viewBox", view.join(" "));
  };
  const endPan = () => { isPanning = false; };

  // Mouse
  svg.addEventListener("mousedown", (e) => startPan(e.clientX, e.clientY));
  window.addEventListener("mousemove", (e) => movePan(e.clientX, e.clientY));
  window.addEventListener("mouseup", endPan);

  // Touch (single-finger pan)
  svg.addEventListener("touchstart", (e) => {
    if (e.touches.length === 1) startPan(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });
  svg.addEventListener("touchmove", (e) => {
    if (e.touches.length === 1) movePan(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });
  svg.addEventListener("touchend", endPan, { passive: true });

  // Wheel zoom around center
  svg.addEventListener("wheel", (e) => {
    e.preventDefault();
    const scale = e.deltaY < 0 ? 0.9 : 1.1;
    const cx = view[0] + view[2] / 2, cy = view[1] + view[3] / 2;
    view[2] *= scale; view[3] *= scale;
    view[0] = cx - view[2] / 2; view[1] = cy - view[3] / 2;
    svg.setAttribute("viewBox", view.join(" "));
  }, { passive: false });
}
