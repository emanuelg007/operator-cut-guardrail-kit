// src/main.ts
import { emit } from "./core/eventBus";
import { validateRequiredColumns } from "./csv/validateRows";

const fileInput =
  (document.getElementById("csv-file") as HTMLInputElement) ||
  (document.querySelector('input[type="file"]') as HTMLInputElement);

const statusEl = document.getElementById("status"); // <div id="status"></div>
const nameEl = document.getElementById("file-name"); // <span id="file-name"></span>

function setStatusOk(msg: string) {
  if (statusEl) {
    statusEl.textContent = `✅ ${msg}`;
    statusEl.className = "status ok";
  }
}
function setStatusErr(msg: string) {
  if (statusEl) {
    statusEl.textContent = `❌ ${msg}`;
    statusEl.className = "status err";
  }
}

if (fileInput) {
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) return;

    if (nameEl) nameEl.textContent = file.name;

    try {
      const text = await file.text();

      // First line = headers. Handle BOM, allow ; or , just in case.
      const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
      if (lines.length === 0) throw new Error("CSV appears empty.");
      const headerLine = lines[0].replace(/^\uFEFF/, "");
      const delimiter = headerLine.includes(";") ? ";" : ",";
      const headers = headerLine.split(delimiter).map((h) => h.trim());

      // Validate your required columns
      validateRequiredColumns(headers);

      const rowCount = Math.max(0, lines.length - 1);

      // Let the rest of the app know (future steps hook into this)
      emit("csv:uploaded:validated", {
        name: file.name,
        size: file.size,
        headers,
        rows: rowCount,
        delimiter,
        text,
      });

      setStatusOk(`Loaded ${rowCount} rows from ${file.name}`);
    } catch (err: any) {
      setStatusErr(err?.message || String(err));
      console.error(err);
    }
  });
}
