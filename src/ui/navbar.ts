/* -------------------------------------------------------------------------- *
 * Minimal top navbar (no framework)
 * - Import CSV (clicks an existing #fileInput if present)
 * - Settings (lazy-imports settings modal)
 * - Print Queue (opens our print modal)
 * -------------------------------------------------------------------------- */
import * as toasts from "./toasts";
import { openPrintModal } from "./modals/printModal";

function mkBtn(label: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = label;
  Object.assign(b.style, {
    padding: "8px 12px",
    border: "1px solid #cbd5e1",
    borderRadius: "12px",
    background: "#e8eefa",
    cursor: "pointer",
  } as any);
  b.onmouseenter = () => (b.style.background = "#dde7ff");
  b.onmouseleave = () => (b.style.background = "#e8eefa");
  b.onclick = onClick;
  return b;
}

function initNavbar() {
  // Avoid duplicate bars
  if (document.getElementById("oc-navbar")) return;

  const bar = document.createElement("div");
  bar.id = "oc-navbar";
  Object.assign(bar.style, {
    position: "fixed",
    top: "0",
    left: "0",
    right: "0",
    height: "48px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "6px 12px",
    gap: "8px",
    background: "rgba(248, 250, 252, 0.92)",
    backdropFilter: "saturate(180%) blur(8px)",
    borderBottom: "1px solid #e2e8f0",
    zIndex: "2400",
  } as any);

  const left = document.createElement("div");
  left.style.display = "flex";
  left.style.gap = "8px";
  const brand = document.createElement("div");
  brand.textContent = "Operator Cut";
  brand.style.fontWeight = "700";
  brand.style.letterSpacing = "0.2px";
  left.appendChild(brand);

  const right = document.createElement("div");
  right.style.display = "flex";
  right.style.gap = "8px";

  // Import CSV (click existing file input if present)
  const importBtn = mkBtn("Import CSV", () => {
    const fi = document.getElementById("fileInput") as HTMLInputElement | null;
    if (fi) {
      fi.click();
    } else {
      (toasts as any).showToast("No file input found (id=fileInput)", "warning");
    }
  });

  // Settings (lazy import)
  const settingsBtn = mkBtn("Settings", async () => {
    try {
      const m = await import("./modals/settings-modal" as any);
      const fn = (m as any).openSettingsModal || (m as any).openSettings;
      if (typeof fn === "function") fn();
      else (toasts as any).showToast("Settings modal not found", "error");
    } catch {
      (toasts as any).showToast("Failed to open Settings", "error");
    }
  });

  // Print queue
  const printBtn = mkBtn("Print Queue", () => openPrintModal());

  right.append(importBtn, settingsBtn, printBtn);
  bar.append(left, right);
  document.body.appendChild(bar);

  // push content down slightly to avoid overlap
  if (!document.body.style.paddingTop) document.body.style.paddingTop = "52px";
}

(function autoInit() {
  if (typeof window === "undefined") return;
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => initNavbar(), { once: true });
  } else {
    initNavbar();
  }
})();
