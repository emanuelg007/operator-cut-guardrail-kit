import { parseCsv } from "../utils/csv";
import { materialsRowsToBoards } from "../materials/toBoards";
import { setBoards } from "../state/materials";
import { emit, Events } from "../events";

function ensureButton(container: HTMLElement): HTMLButtonElement {
  let btn = container.querySelector<HTMLButtonElement>("#materialsUploadBtn");
  if (btn) return btn;
  btn = document.createElement("button");
  btn.id = "materialsUploadBtn";
  btn.type = "button";
  btn.textContent = "Upload Master Materials (CSV)";
  btn.style.marginRight = "8px";
  container.prepend(btn);
  return btn;
}

function ensureFileInput(): HTMLInputElement {
  let inp = document.getElementById("materialsFile") as HTMLInputElement | null;
  if (inp) return inp;
  inp = document.createElement("input");
  inp.type = "file"; inp.accept = ".csv,text/csv"; inp.id = "materialsFile";
  inp.style.display = "none";
  document.body.appendChild(inp);
  return inp;
}

async function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(fr.error);
    fr.onload = () => resolve(String(fr.result ?? ""));
    fr.readAsText(file);
  });
}

export function initMaterialsUpload() {
  const settings = document.getElementById("settings");
  if (!settings) {
    console.warn("[materials-upload] #settings not found; deferring init.");
    return;
  }
  const btn = ensureButton(settings);
  const input = ensureFileInput();

  btn.onclick = () => input.click();

  input.onchange = async () => {
    const f = input.files?.[0];
    if (!f) return;
    try {
      const text = await readFileAsText(f);
      const rows = parseCsv(text);
      const boards = materialsRowsToBoards(rows);
      if (!boards.length) {
        alert("No valid boards found. Check headers: MaterialTag, BoardLength, BoardWidth, Thickness.");
        return;
      }
      setBoards(boards);
      emit(Events.MATERIALS_LOADED, { count: boards.length });
      console.log(`[materials-upload] Ingested ${boards.length} board spec(s) from ${f.name}`);
    } catch (e) {
      console.error("[materials-upload] failed:", e);
      alert("Failed to load Master Materials CSV. See console for details.");
    } finally {
      input.value = ""; // allow re-selecting the same file
    }
  };
}

// auto-init after DOM is ready
window.addEventListener("DOMContentLoaded", () => {
  try { initMaterialsUpload(); } catch (e) { console.error(e); }
});
