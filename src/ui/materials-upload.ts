// src/ui/materials-upload.ts
import { parseCsv } from "../csv/parseCsv";
import { ingestMaterials } from "../materials/ingest";

export function wireMaterialsUpload(
  inputEl: HTMLInputElement, btnEl: HTMLButtonElement, statusEl: HTMLElement
) {
  let pending: File | null = null;

  const setStatus = (kind: "ok" | "err" | "neutral", msg: string) => {
    statusEl.className = "status " + (kind === "ok" ? "ok" : kind === "err" ? "err" : "");
    statusEl.textContent = msg;
  };

  inputEl.addEventListener("change", () => {
    pending = inputEl.files && inputEl.files[0] ? inputEl.files[0] : null;
    setStatus("neutral", pending ? `Selected: ${pending.name}` : "");
    console.debug("[materials] file selected:", pending?.name);
  });

  btnEl.addEventListener("click", async () => {
    const file = pending ?? (inputEl.files?.[0] ?? null);
    if (!file) {
      setStatus("err", "Choose a Master Materials CSV first.");
      console.debug("[materials] no file chosen");
      return;
    }
    try {
      setStatus("neutral", "Parsing materials CSV…");
      const text = await file.text();
      const { headers, rows, delimiter } = parseCsv(text);
      console.debug("[materials] parsed CSV", { headers, rows: rows.length, delimiter });

      if (!headers.length) {
        setStatus("err", "Could not detect header row.");
        return;
      }

      const count = ingestMaterials(headers, rows);
      if (count > 0) {
        setStatus("ok", `Loaded ${count} board row(s). Delimiter: "${delimiter}"`);
      } else {
        setStatus("err", "No valid boards found in CSV (need BoardLength & BoardWidth).");
      }
    } catch (e: any) {
      console.error("[materials] failed:", e);
      setStatus("err", `Failed: ${e?.message || e}`);
    }
  });
}
