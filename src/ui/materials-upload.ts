// src/ui/materials-upload.ts
import { ingestMaterialsCsvText } from "../materials/ingest";
import { emit, Events } from "../events";

function setStatus(el: HTMLElement | null, type: "ok" | "err" | "neutral", msg: string) {
  if (!el) return;
  el.className = "status " + (type === "ok" ? "ok" : type === "err" ? "err" : "");
  el.textContent = msg;
}

export function wireMaterialsUploadUI() {
  const input = document.getElementById("materialsFileInput") as HTMLInputElement | null;
  const btn = document.getElementById("uploadMaterialsBtn") as HTMLButtonElement | null;
  const status = document.getElementById("materialsStatus") as HTMLElement | null;

  if (!input || !btn || !status) return;

  // Clicking the button opens the file chooser
  btn.addEventListener("click", () => input.click());

  // When a file is selected, parse & load it
  input.addEventListener("change", async () => {
    const file = input.files?.[0] ?? null;
    if (!file) {
      setStatus(status, "err", "No file selected.");
      return;
    }
    setStatus(status, "neutral", `Selected: ${file.name}`);

    try {
      const text = await file.text();
      const res = ingestMaterialsCsvText(text);
      setStatus(status, "ok", `Loaded ${res.count} board(s) from ${file.name} (delimiter "${res.delimiter}")`);
      emit(Events.MATERIALS_LOADED, { count: res.count });
    } catch (e: any) {
      setStatus(status, "err", `Failed to load: ${e?.message ?? e}`);
    } finally {
      // reset input so re-selecting same file will still fire change
      input.value = "";
    }
  });
}

// Auto-wire on module import
try { wireMaterialsUploadUI(); } catch {}
