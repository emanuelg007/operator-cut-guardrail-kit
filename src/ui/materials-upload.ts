// src/ui/materials-upload.ts
import { parseCsv } from "../csv/parseCsv";
import { ingestMasterMaterials } from "../materials/ingest";

/**
 * Wires the "Master Materials" uploader controls.
 * - Shows selected filename
 * - Parses CSV
 * - Ingests boards into state
 * - Emits MATERIALS_LOADED (inside ingest)
 */
export function wireMaterialsUpload(
  fileInput: HTMLInputElement,
  uploadBtn: HTMLButtonElement,
  statusEl: HTMLSpanElement
) {
  let pending: File | null = null;

  fileInput.addEventListener("change", () => {
    pending = fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;
    statusEl.className = "status";
    statusEl.textContent = pending ? `Selected: ${pending.name}` : "";
    console.debug("[materials] file selected:", pending?.name);
  });

  uploadBtn.addEventListener("click", async () => {
    const file = pending ?? (fileInput.files?.[0] ?? null);
    if (!file) {
      statusEl.className = "status err";
      statusEl.textContent = "Choose a Master Materials CSV first.";
      return;
    }

    try {
      const text = await file.text();
      const { headers, rows, delimiter } = parseCsv(text);
      if (!headers || headers.length === 0) {
        statusEl.className = "status err";
        statusEl.textContent = "Could not detect a header row.";
        return;
      }

      console.debug("[materials] parsed CSV", { headers, rows: rows.length, delimiter });
      ingestMasterMaterials(headers, rows); // updates state + emits MATERIALS_LOADED

      statusEl.className = "status ok";
      statusEl.textContent = `Loaded ${rows.length} material row(s).`;
    } catch (e: any) {
      console.error(e);
      statusEl.className = "status err";
      statusEl.textContent = `Failed: ${e?.message ?? e}`;
    }
  });
}
