// src/render/boardSvg.ts
export interface SvgBoard {
  width: number;  // mm
  height: number; // mm
}

export interface SvgPart {
  id: string;
  x: number; y: number;
  w: number; h: number;
  label: string;
}

export function renderBoardSvg(host: HTMLElement, board: SvgBoard, parts: SvgPart[]) {
  host.innerHTML = "";
  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("viewBox", `0 0 ${board.width} ${board.height}`);
  svg.style.width = "100%";
  svg.style.maxWidth = "1200px";
  svg.style.border = "1px solid #ddd";
  svg.style.background = "#fafafa";

  const outline = document.createElementNS(svgNS, "rect");
  outline.setAttribute("x", "0");
  outline.setAttribute("y", "0");
  outline.setAttribute("width", String(board.width));
  outline.setAttribute("height", String(board.height));
  outline.setAttribute("fill", "#fff");
  outline.setAttribute("stroke", "#333");
  svg.appendChild(outline);

  for (const p of parts) {
    const r = document.createElementNS(svgNS, "rect");
    r.setAttribute("x", String(p.x));
    r.setAttribute("y", String(p.y));
    r.setAttribute("width", String(p.w));
    r.setAttribute("height", String(p.h));
    r.setAttribute("fill", "#e5f3ff");
    r.setAttribute("stroke", "#1e3a8a");
    svg.appendChild(r);

    const t = document.createElementNS(svgNS, "text");
    t.setAttribute("x", String(p.x + p.w / 2));
    t.setAttribute("y", String(p.y + p.h / 2));
    t.setAttribute("dominant-baseline", "middle");
    t.setAttribute("text-anchor", "middle");
    t.setAttribute("font-size", "10");
    t.textContent = p.label;
    svg.appendChild(t);
  }

  host.appendChild(svg);
}
