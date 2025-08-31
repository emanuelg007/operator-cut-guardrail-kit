/* -------------------------------------------------------------------------- *
 * Print Modal (MVP)
 * - Maintains an in-memory print queue of part IDs (pid strings)
 * - Listens to Events.PART_PRINT_REQUEST / PART_UNDO_PRINT_REQUEST
 * - UI: shows queued PIDs, Print (browser or ZPL), Clear, Close
 * - On print success, emits PART_STATUS_CHANGED { pid, printed: true }
 * -------------------------------------------------------------------------- */
import { on, emit, Events } from "../../events";
import { getSettings } from "../../state/settings";
import * as toasts from "../toasts";

type Queue = Set<string>;
const queue: Queue = new Set();

let modalOpen = false;
let ov: HTMLDivElement | null = null;
let listEl: HTMLUListElement | null = null;
let countEl: HTMLSpanElement | null = null;

// ---------- Event listeners (module-level; safe side-effect) ----------
on(Events.PART_PRINT_REQUEST, ({ pid }: { pid: string }) => {
  queue.add(pid);
  (toasts as any).showToast(`Queued ${pid}`, "success", { timeout: 1500 });
  refresh();
});

on(Events.PART_UNDO_PRINT_REQUEST, ({ pid }: { pid: string }) => {
  if (queue.delete(pid)) {
    (toasts as any).showToast(`Removed ${pid} from queue`, "info", { timeout: 1500 });
  }
  // also broadcast not printed
  emit(Events.PART_STATUS_CHANGED, { pid, printed: false });
  refresh();
});

// ---------- Public API ----------
export function openPrintModal() {
  if (modalOpen && ov) return;
  modalOpen = true;

  const s = getSettings();
  const { labelWidthMM, labelHeightMM, zebraDPI, includeQR, includeBarcode, mode } = s.printer;
  const dpi = (zebraDPI as 203 | 300 | 600);

  ov = document.createElement("div");
  ov.role = "dialog";
  ov.ariaModal = "true";
  Object.assign(ov.style, {
    position: "fixed",
    inset: "0",
    background: "rgba(0,0,0,0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: "2600",
  } as any);

  const card = document.createElement("div");
  Object.assign(card.style, {
    width: "min(720px, 96vw)",
    maxHeight: "86vh",
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: "14px",
    boxShadow: "0 12px 36px rgba(0,0,0,0.18)",
    display: "flex",
    flexDirection: "column",
  } as any);

  // header
  const header = row({
    padding: "10px 12px",
    borderBottom: "1px solid #e2e8f0",
    alignItems: "center",
  });
  const title = document.createElement("div");
  title.textContent = "Print Queue";
  title.style.fontWeight = "600";
  title.style.fontSize = "16px";
  countEl = document.createElement("span");
  countEl.style.marginLeft = "8px";
  countEl.style.color = "#64748b";

  const right = document.createElement("div");
  right.style.display = "flex";
  right.style.gap = "8px";
  const meta = small(`Mode: ${mode} · ${labelWidthMM}×${labelHeightMM} mm · ${zebraDPI} dpi`);
  meta.style.marginRight = "12px";
  const closeBtn = pill("Close", () => close());
  header.append(title, countEl, right);
  right.append(meta, closeBtn);

  // body
  const body = document.createElement("div");
  Object.assign(body.style, {
    padding: "10px 12px",
    overflow: "auto",
  } as any);

  listEl = document.createElement("ul");
  listEl.style.listStyle = "none";
  listEl.style.padding = "0";
  listEl.style.margin = "0";
  listEl.style.display = "grid";
  listEl.style.gridTemplateColumns = "repeat(auto-fill, minmax(160px, 1fr))";
  listEl.style.gap = "8px";
  body.appendChild(listEl);

  // footer
  const footer = row({
    padding: "10px 12px",
    borderTop: "1px solid #e2e8f0",
    justifyContent: "space-between",
    alignItems: "center",
  });
  const opts = small(`QR: ${includeQR ? "on" : "off"} · Barcode: ${includeBarcode ? "on" : "off"}`);
  const left = row({ gap: "8px" });
  const clearBtn = pill("Clear", () => {
    queue.clear();
    refresh();
  });
  clearBtn.style.borderColor = "#fecaca";
  clearBtn.style.background = "#fef2f2";
  clearBtn.style.color = "#991b1b";
  const printBtn = primary("Print", async () => {
    if (queue.size === 0) {
      (toasts as any).showToast("Queue is empty", "warning", { timeout: 1500 });
      return;
    }
    try {
      if (mode === "zebra") {
        const zpl = Array.from(queue)
          .map((pid) => zplForPid(pid, dpi, labelWidthMM, labelHeightMM, { includeQR, includeBarcode }))
          .join("\n");
        downloadText("labels.zpl", zpl);
        (toasts as any).showToast(`ZPL ready (${queue.size} labels)`, "success");
      } else {
        // Minimal browser print: open a print-sized window and call print()
        const html = htmlForBrowserPreview(Array.from(queue), { w: labelWidthMM, h: labelHeightMM });
        const w = window.open("", "_blank");
        if (!w) throw new Error("Popup blocked");
        w.document.write(html);
        w.document.close();
        w.focus();
        setTimeout(() => w.print(), 100);
      }
      // mark all as printed
      for (const pid of queue) emit(Events.PART_STATUS_CHANGED, { pid, printed: true });
      queue.clear();
      refresh();
    } catch (err) {
      console.error(err);
      (toasts as any).showToast("Print failed", "error");
    }
  });
  left.append(clearBtn, printBtn);
  footer.append(opts, left);

  card.append(header, body, footer);
  ov.appendChild(card);
  document.body.appendChild(ov);

  // click outside & ESC
  ov.addEventListener("click", (e) => {
    if (e.target === ov) close();
  });
  window.addEventListener("keydown", onEsc, { once: true });

  refresh();
}

// ---------- helpers ----------
function refresh() {
  if (!listEl || !countEl) return;
  // header count
  countEl.textContent = `(${queue.size})`;
  // list
  listEl.innerHTML = "";
  const frag = document.createDocumentFragment();
  for (const pid of queue) {
    const li = document.createElement("li");
    li.style.border = "1px solid #cbd5e1";
    li.style.borderRadius = "10px";
    li.style.padding = "8px 10px";
    li.style.background = "#f8fafc";
    li.style.display = "flex";
    li.style.alignItems = "center";
    li.style.justifyContent = "space-between";
    const t = document.createElement("div");
    t.textContent = pid;
    t.style.fontFamily =
      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace";
    t.style.fontSize = "12px";
    const rm = mini("✕", () => {
      queue.delete(pid);
      refresh();
    });
    li.append(t, rm);
    frag.append(li);
  }
  listEl.appendChild(frag);
}

function onEsc(e: KeyboardEvent) {
  if (e.key === "Escape") close();
}
function close() {
  modalOpen = false;
  if (ov) ov.remove();
  ov = null;
  listEl = null;
  countEl = null;
}

function pill(label: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = label;
  Object.assign(b.style, {
    padding: "8px 12px",
    border: "1px solid #cbd5e1",
    borderRadius: "999px",
    background: "#eef2ff",
    cursor: "pointer",
  } as any);
  b.onmouseenter = () => (b.style.background = "#e0e7ff");
  b.onmouseleave = () => (b.style.background = "#eef2ff");
  b.onclick = onClick;
  return b;
}
function primary(label: string, onClick: () => void): HTMLButtonElement {
  const b = pill(label, onClick);
  b.style.background = "#3b82f6";
  b.style.borderColor = "#2563eb";
  b.style.color = "#fff";
  b.onmouseenter = () => (b.style.background = "#2563eb");
  b.onmouseleave = () => (b.style.background = "#3b82f6");
  return b;
}
function mini(label: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = label;
  Object.assign(b.style, {
    padding: "2px 6px",
    border: "1px solid #cbd5e1",
    borderRadius: "8px",
    background: "#fff",
    cursor: "pointer",
    fontSize: "12px",
    lineHeight: "1",
  } as any);
  b.onclick = onClick;
  return b;
}
function row(style?: Partial<CSSStyleDeclaration>) {
  const d = document.createElement("div");
  d.style.display = "flex";
  (style?.gap) && (d.style.gap = style.gap!);
  if (style) Object.assign(d.style, style as any);
  return d;
}
function small(text: string) {
  const s = document.createElement("div");
  s.textContent = text;
  s.style.fontSize = "12px";
  s.style.color = "#64748b";
  return s;
}

// --------- ZPL & browser helpers ----------
function mmToDots(mm: number, dpi: 203 | 300 | 600) {
  return Math.round((mm / 25.4) * dpi);
}
function zplForPid(
  pid: string,
  dpi: 203 | 300 | 600,
  wMM: number,
  hMM: number,
  opts: { includeQR: boolean; includeBarcode: boolean }
): string {
  const W = mmToDots(wMM, dpi);
  const H = mmToDots(hMM, dpi);
  const lines: string[] = [
    "^XA",
    `^PW${W}`,
    `^LL${H}`,
    "^CI28",
    `^FO20,20^A0N,32,32^FD${sanitize(pid)}^FS`,
  ];
  if (opts.includeQR) {
    lines.push(`^FO20,70^BQN,2,6^FDMA,${sanitize(pid)}^FS`);
  }
  if (opts.includeBarcode) {
    const y = Math.max(20, H - 80);
    lines.push(`^FO20,${y}^BY2`, "^BCN,60,Y,N,N", `^FD${sanitize(pid)}^FS`);
  }
  lines.push("^XZ");
  return lines.join("\n");
}
function sanitize(s: string) {
  return String(s).replace(/[\^\~\|]/g, "_");
}
function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function htmlForBrowserPreview(pids: string[], sz: { w: number; h: number }) {
  const mm = (n: number) => `${n}mm`;
  const labels = pids
    .map(
      (pid) => `
      <div class="label">
        <div class="pid">${escapeHtml(pid)}</div>
      </div>`
    )
    .join("");
  return `<!DOCTYPE html>
  <html><head><meta charset="utf-8">
  <title>Labels</title>
  <style>
    @page { size: ${mm(sz.w)} ${mm(sz.h)}; margin: 0; }
    body { margin: 0; }
    .label { width: ${mm(sz.w)}; height: ${mm(sz.h)}; display:flex; align-items:center; padding: 4mm; box-sizing: border-box; }
    .pid { font: 14pt ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto; }
  </style>
  </head><body>${labels}</body></html>`;
}
function escapeHtml(s: string) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]!));
}
