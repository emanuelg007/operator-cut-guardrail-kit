// src/ui/modals/part-modal.ts
import { emit, Events } from "../../events";
import type { PlacedPart } from "../../nesting/types";

export function openPartModal(part: PlacedPart, pid: string) {
  const overlay = document.createElement("div");
  overlay.style.position = "fixed";
  overlay.style.inset = "0";
  overlay.style.background = "rgba(0,0,0,0.45)";
  overlay.style.zIndex = "10050";
  overlay.style.display = "flex";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";

  const card = document.createElement("div");
  card.style.width = "min(640px, 92vw)";
  card.style.maxHeight = "84vh";
  card.style.overflow = "auto";
  card.style.background = "#fff";
  card.style.borderRadius = "12px";
  card.style.boxShadow = "0 24px 70px rgba(0,0,0,0.35)";
  card.style.padding = "14px";
  overlay.appendChild(card);

  const title = document.createElement("h3");
  title.textContent = `Component — ${part.name ?? part.id ?? pid}`;
  title.style.marginTop = "0";
  title.style.marginBottom = "8px";
  card.appendChild(title);

  const table = document.createElement("table");
  table.style.width = "100%";
  table.style.borderCollapse = "collapse";
  const tbody = document.createElement("tbody");
  const rows: Array<[string, string | number | boolean | undefined]> = [
    ["ID", pid],
    ["Name", part.name],
    ["Material", part.material],
    ["Length (mm)", Math.round(part.h)],
    ["Width (mm)", Math.round(part.w)],
    ["Rotated", part.rotated ? "Yes" : "No"],
    ["Board #", (part as any).boardIdx ?? ""],
    ["X (mm)", Math.round(part.x)],
    ["Y (mm)", Math.round(part.y)],
  ];
  for (const [k, v] of rows) {
    const tr = document.createElement("tr");
    const ktd = document.createElement("td");
    const vtd = document.createElement("td");
    ktd.textContent = k;
    vtd.textContent = String(v ?? "");
    ktd.style.fontWeight = "600";
    ktd.style.width = "40%";
    for (const td of [ktd, vtd]) {
      td.style.borderBottom = "1px solid #eee";
      td.style.padding = "6px 8px";
    }
    tr.append(ktd, vtd);
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  card.appendChild(table);

  const bar = document.createElement("div");
  bar.style.display = "flex";
  bar.style.justifyContent = "flex-end";
  bar.style.gap = "8px";
  bar.style.marginTop = "12px";

  const btn = (t: string) => {
    const b = document.createElement("button");
    b.textContent = t;
    b.style.padding = "8px 12px";
    b.style.border = "1px solid #d1d5db";
    b.style.borderRadius = "10px";
    b.style.background = "#fff";
    b.style.cursor = "pointer";
    return b;
  };

  const printBtn = btn("Print");
  printBtn.onclick = () => {
    emit(Events.PART_PRINT_REQUEST, { pid });
    close();
  };
  const undoBtn = btn("Undo");
  undoBtn.onclick = () => {
    emit(Events.PART_UNDO_PRINT_REQUEST, { pid });
    close();
  };
  const closeBtn = btn("Close");
  closeBtn.onclick = () => close();

  bar.append(printBtn, undoBtn, closeBtn);
  card.appendChild(bar);

  const close = () => {
    try { document.body.removeChild(overlay); } catch {}
    window.removeEventListener("keydown", onEsc);
  };

  const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
  window.addEventListener("keydown", onEsc);
  document.body.appendChild(overlay);
}
