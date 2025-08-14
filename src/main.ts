// src/main.ts
import { on, emit } from "./core/eventBus";
import { validateRequiredColumns } from "./csv/validateRows";

const input = document.getElementById("csvInput") as HTMLInputElement | null;
const fileNameEl = document.getElementById("fileName") as HTMLElement | null;
const statusEl = document.getElementById("status") as HTMLElement | null;

function setStatus(msg: string, kind: "info" | "ok" | "err" = "info") {
  if (!statusEl) return;
  statusEl.textContent = msg;
  statusEl.style.whiteSpace = "pre-line";
  statusEl.style.color = kind === "ok" ? "green" : kind === "err" ? "crimson" : "inherit";
}

if (!input) {
  console.error("csvInput element not found in index.html");
} else {
  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    if (!file) {
      setStatus("No file uploaded");
      return;
    }

    // Immediately show the file picked (so you never see “No file uploaded” now)
    if (fileNameEl) fileNameEl.textContent = file.name;
    setStatus(`📄 File selected: "${file.name}"\nReading…`, "info");

    try {
      const text = await file.text();

      // Very simple CSV header read (semicolon or comma)
      const firstLine = text.split(/\r?\n/).find(l => l.trim().length > 0) ?? "";
      const delimiter = firstLine.includes(";") ? ";" : ",";
      const headers = firstLine.split(delimiter).map(h => h.trim());

      console.log("Detected headers from CSV:", headers);

      // Validate headers against your custom list
      validateRequiredColumns(headers);

      // If we got here, validation passed. Count rows (non-empty lines minus header)
      const rowCount = text
        .split(/\r?\n/)
        .slice(1)
        .filter(l => l.trim().length > 0).length;

      // Update UI and emit event
      setStatus(
        `📄 File: "${file.name}" (${rowCount} data rows)\n✅ All required columns found.`,
        "ok"
      );
      emit("csv:uploaded", { name: file.name, size: file.size, text, delimiter, headers, rowCount });
    } catch (err: any) {
      console.error(err);
      const msg = typeof err?.message === "string" ? err.message : String(err);
      setStatus(`📄 File: "${file.name}"\n❌ ${msg}`, "err");
    }
  });
}
