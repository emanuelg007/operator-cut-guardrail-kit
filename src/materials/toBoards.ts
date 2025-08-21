// src/materials/toBoards.ts
import type { BoardSpec, Grain } from "../nesting/types";

const num = (v: any): number => {
  const n = Number(String(v ?? "").replace(/[, ]+/g, ""));
  return Number.isFinite(n) ? n : 0;
};
const normStr = (s: any) => String(s ?? "").trim();

export function parseMaterialGrain(s: any): Grain {
  const k = String(s ?? "").toLowerCase().trim();
  if (k === "alongx" || k === "width") return "alongX";
  if (k === "alongy" || k === "length") return "alongY";
  return "none";
}

/** Convert Master Materials CSV rows into BoardSpec[] */
export function materialsRowsToBoards(rows: string[][], headers: string[]): BoardSpec[] {
  const H = headers.map(h => h.toLowerCase().trim());
  const idx = (key: string) => H.indexOf(key.toLowerCase());
  const iName = idx("name");
  const iLen = idx("boardlength");
  const iWid = idx("boardwidth");
  const iTag = idx("materialtag");
  const iCopies = idx("copies");
  const iGrain = idx("grain");

  const boards: BoardSpec[] = [];
  for (const row of rows) {
    const get = (i: number) => (i >= 0 ? row[i] : "");
    const name = normStr(get(iName));
    const length = num(get(iLen));
    const width = num(get(iWid));
    const tagRaw = normStr(get(iTag));
    const copiesRaw = normStr(get(iCopies));
    const grainRaw = normStr(get(iGrain));
    if (!length || !width) continue;

    const copies: number | "infinite" =
      copiesRaw.toLowerCase() === "infinite" ? "infinite" :
      (Number.isFinite(Number(copiesRaw)) ? Math.max(1, Number(copiesRaw)) : 1);

    boards.push({
      id: name || tagRaw || `${width}x${length}`,
      name: name || undefined,
      width,
      height: length,
      copies,
      materialTag: tagRaw || name || "",
      grain: parseMaterialGrain(grainRaw),
    });
  }
  return boards;
}
