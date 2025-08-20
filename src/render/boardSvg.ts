// src/render/boardSvg.ts
import type { SheetLayout } from "../nesting/types";

interface Pager {
  go(idx: number): void;
  next(): void;
  prev(): void;
  currentIndex(): number;
}

export function createBoardPager(container: HTMLElement, layouts: SheetLayout[]): Pager {
  container.innerHTML = `
    <div style="display:flex; align-items:center; justify-content:space-between; gap:.5rem; margin-bottom:.5rem;">
      <button id="prevBtn" type="button">◀</button>
      <div id="pageLabel" style="font-weight:600;"></div>
      <button id="nextBtn" type="button">▶</button>
    </div>
    <div id="svgWrap" style="border:1px solid #ccc; position:relative; height:60vh; overflow:hidden;"></div>
  `;

  const prevBtn = container.querySelector<HTMLButtonElement>("#prevBtn")!;
  const nextBtn = container.querySelector<HTMLButtonElement>("#nextBtn")!;
  const pageLabel = container.querySelector<HTMLDivElement>("#pageLabel")!;
  const svgWrap = container.querySelector<HTMLDivElement>("#svgWrap")!;

  let idx = 0;

  function render(i: number) {
    if (!layouts.length) {
      svgWrap.innerHTML = `<div class="empty-state">No sheets to display.</div>`;
      pageLabel.textContent = `Sheets: 0`;
      return;
    }

    const sheet = layouts[i];
    pageLabel.textContent = `Sheet ${i + 1} / ${layouts.length} — ${sheet.boardId ?? ""} ${sheet.boardIdx != null ? `#${sheet.boardIdx + 1}` : ""}`;

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");
    svg.setAttribute("viewBox", `0 0 ${sheet.width} ${sheet.height}`);

    const bg = document.createElementNS(svg.namespaceURI, "rect");
    bg.setAttribute("x", "0");
    bg.setAttribute("y", "0");
    bg.setAttribute("width", String(sheet.width));
    bg.setAttribute("height", String(sheet.height));
    bg.setAttribute("fill", "#f7f7f7");
    bg.setAttribute("stroke", "#999");
    svg.appendChild(bg);

    for (const p of sheet.placed ?? []) {
      const r = document.createElementNS(svg.namespaceURI, "rect");
      r.setAttribute("x", String(p.x));
      r.setAttribute("y", String(p.y));
      r.setAttribute("width", String(p.w));
      r.setAttribute("height", String(p.h));
      r.setAttribute("fill", "#e2ecff");
      r.setAttribute("stroke", "#3561d1");
      r.setAttribute("stroke-width", "0.6");
      svg.appendChild(r);

      const label = document.createElementNS(svg.namespaceURI, "text");
      label.setAttribute("x", String(p.x + p.w / 2));
      label.setAttribute("y", String(p.y + p.h / 2));
      label.setAttribute("dominant-baseline", "middle");
      label.setAttribute("text-anchor", "middle");
      label.setAttribute("font-size", "8");
      label.textContent = (p as any).name || (p as any).id || "";
      svg.appendChild(label);
    }

    enableZoomPan(svg);
    svgWrap.replaceChildren(svg);
  }

  function enableZoomPan(svg: SVGSVGElement) {
    let scale = 1;
    let originX = 0, originY = 0;
    let panning = false;
    let startX = 0, startY = 0;

    const apply = () => {
      let g = svg.querySelector("g[data-root]") as SVGGElement | null;
      if (!g) {
        g = document.createElementNS(svg.namespaceURI, "g") as SVGGElement;
        g.setAttribute("data-root", "1");
        const children = Array.from(svg.childNodes);
        for (const c of children) g.appendChild(c);
        svg.appendChild(g);
      }
      g.setAttribute("transform", `translate(${originX} ${originY}) scale(${scale})`);
    };

    svg.addEventListener("wheel", (e) => {
      e.preventDefault();
      const delta = Math.sign((e as WheelEvent).deltaY);
      const factor = delta > 0 ? 0.9 : 1.1;
      scale = Math.max(0.1, Math.min(10, scale * factor));
      apply();
    }, { passive: false });

    svg.addEventListener("pointerdown", (e) => {
      const ev = e as PointerEvent;
      panning = true; startX = ev.clientX; startY = ev.clientY; svg.setPointerCapture(ev.pointerId);
    });
    svg.addEventListener("pointermove", (e) => {
      if (!panning) return;
      const ev = e as PointerEvent;
      originX += (ev.clientX - startX) / scale;
      originY += (ev.clientY - startY) / scale;
      startX = ev.clientX; startY = ev.clientY;
      apply();
    });
    svg.addEventListener("pointerup", (e) => {
      const ev = e as PointerEvent;
      panning = false;
      svg.releasePointerCapture?.(ev.pointerId);
    });
    apply();
  }

  function go(n: number) { idx = Math.max(0, Math.min(layouts.length - 1, n)); render(idx); }
  prevBtn.onclick = () => go(idx - 1);
  nextBtn.onclick = () => go(idx + 1);

  go(0);
  return { go, next: () => go(idx + 1), prev: () => go(idx - 1), currentIndex: () => idx };
}

export { createBoardPager as default };
