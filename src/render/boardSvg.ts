// src/render/boardSvg.ts
import type { Sheet } from "../nesting/packJob";

export interface RenderOptions {
  hostWidthPx?: number; // if set, we'll scale to this width (keeps aspect)
  showDims?: boolean;
}

export function renderBoardSvg(host: HTMLElement, sheet: Sheet, opts: RenderOptions = {}) {
  host.innerHTML = "";
  const { hostWidthPx = 900, showDims = true } = opts;

  const vbW = sheet.width;
  const vbH = sheet.height;

  const svg = el("svg", {
    viewBox: `0 0 ${vbW} ${vbH}`,
    width: String(hostWidthPx),
    style: "max-width:100%;height:auto;display:block;border-radius:8px"
  });

  // Board outline
  svg.appendChild(el("rect", {
    x: "0", y: "0",
    width: String(vbW),
    height: String(vbH),
    fill: "#fff",
    stroke: "#111827",
    "stroke-width": "2"
  }));

  // Parts
  for (const p of sheet.parts) {
    const g = el("g", {});
    g.appendChild(el("rect", {
      x: String(p.x),
      y: String(p.y),
      width: String(p.w),
      height: String(p.h),
      fill: "#e5f3ff",
      stroke: "#2563eb",
      "stroke-width": "1"
    }));
    // name centered
    const cx = p.x + p.w / 2;
    const cy = p.y + p.h / 2;
    g.appendChild(el("text", {
      x: String(cx), y: String(cy),
      "text-anchor": "middle",
      "dominant-baseline": "middle",
      "font-size": "16",
      "font-family": "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
      fill: "#111827"
    }, p.name));

    if (showDims) {
      g.appendChild(el("text", {
        x: String(p.x + 4), y: String(p.y + 16),
        "font-size": "12", fill: "#374151"
      }, `${p.w} × ${p.h} mm`));
    }

    svg.appendChild(g);
  }

  // Footer label
  svg.appendChild(el("text", {
    x: "8", y: String(vbH - 8),
    "font-size": "12",
    fill: "#6b7280"
  }, `Material: ${sheet.material} • Sheet ${sheet.index}`));

  host.appendChild(svg);
}

function el<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string>,
  text?: string
): SVGElementTagNameMap[K] {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text != null) node.appendChild(document.createTextNode(text));
  return node as any;
}
