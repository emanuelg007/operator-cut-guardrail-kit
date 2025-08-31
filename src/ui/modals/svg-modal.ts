/* Dark SVG preview modal (used right after Optimize)
 * Fix: emit Events.PART_CLICKED on click/dblclick of parts so it behaves
 * like the main Nesting Viewer (details/print work, selection updates).
 */
import { renderBoardSvg } from "../../render/boardSvg";
import { emit, Events } from "../../events";
import type { SheetLayout, PlacedPart } from "../../nesting/types";

export function openSvgModal(sheets: SheetLayout[], startIndex = 0) {
  const ov = document.createElement("div");
  ov.setAttribute("role", "dialog");
  ov.setAttribute("aria-modal", "true");
  Object.assign(ov.style, {
    position: "fixed",
    inset: "0",
    background: "rgba(0,0,0,0.55)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: "2600",
  } as Partial<CSSStyleDeclaration>);

  const card = document.createElement("div");
  Object.assign(card.style, {
    width: "min(92vw, 1200px)",
    maxHeight: "90vh",
    background: "#0b1220",
    border: "1px solid #1f2937",
    borderRadius: "14px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    padding: "10px",
    color: "#cbd5e1",
  } as Partial<CSSStyleDeclaration>);

  const header = document.createElement("div");
  header.style.display = "flex";
  header.style.justifyContent = "space-between";
  header.style.alignItems = "center";

  const back = button("← Close", () => close());
  header.appendChild(back);

  const host = document.createElement("div");
  Object.assign(host.style, {
    background: "#0f172a",
    border: "1px solid #1e293b",
    borderRadius: "12px",
    padding: "8px",
    overflow: "auto",
    maxHeight: "78vh",
  } as Partial<CSSStyleDeclaration>);

  card.append(header, host);
  ov.appendChild(card);
  document.body.appendChild(ov);

  let idx = Math.max(0, Math.min(startIndex | 0, (sheets?.length ?? 1) - 1));
  render();

  // Close on outside click / ESC
  ov.addEventListener("click", (e) => { if (e.target === ov) close(); });
  const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
  window.addEventListener("keydown", onEsc);

  function close() {
    window.removeEventListener("keydown", onEsc);
    ov.remove();
  }

  function render() {
    host.innerHTML = "";
    const sheet: SheetLayout = sheets[idx];
    // Use the real type; your renderBoardSvg signature expects this type
    renderBoardSvg(host, sheet, idx);

    // Delegate click + dblclick from the rendered SVG to .oc-part elements
    const svg = host.querySelector("svg");
    if (!svg) return;

    const activate = (e: Event) => {
      const t = e.target as Element | null;
      const el = t && (t.closest ? t.closest(".oc-part") : null) as Element | null;
      if (!el) return;
      const pid = el.getAttribute("data-pid") || "";
      if (!pid) return;
      const part = findPartByPid(sheet, pid);
      // Emit with strongly-typed PlacedPart so downstream listeners work
      emit(Events.PART_CLICKED, { pid, part, sheetIdx: idx });
    };

    svg.addEventListener("click", activate);
    svg.addEventListener("dblclick", activate);
  }
}

function findPartByPid(sheet: SheetLayout, pid: string): PlacedPart {
  // Prefer id match; fall back to name
  const byId = sheet.placed.find(p => (p.id ?? "") === pid);
  if (byId) return byId;
  const byName = sheet.placed.find(p => (p.name ?? "") === pid);
  return (byName ?? sheet.placed[0]) as PlacedPart;
}

function button(label: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = label;
  Object.assign(b.style, {
    padding: "8px 12px",
    border: "1px solid #334155",
    borderRadius: "10px",
    background: "#111827",
    color: "#e5e7eb",
    cursor: "pointer",
  } as Partial<CSSStyleDeclaration>);
  b.onmouseenter = () => (b.style.background = "#1f2937");
  b.onmouseleave = () => (b.style.background = "#111827");
  b.onclick = onClick;
  return b;
}
