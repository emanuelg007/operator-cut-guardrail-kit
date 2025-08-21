// src/materials/toBoards.ts
import type { BoardSpec, Grain } from "../nesting/types";

const slug = (s: string) => String(s ?? "").toLowerCase().trim();

const toNumber = (raw: string): number => {
  let s = String(raw ?? "").trim();
  if (!s) return NaN;
  s = s.replace(/[^\d.,\-]/g, "").replace(/\s+/g, "");
  if (s.includes(",") && s.includes(".")) s = s.replace(/,/g, "");
  else if (s.includes(",") && !s.includes(".")) s = s.replace(",", ".");
  const v = Number(s);
  return Number.isFinite(v) ? v : NaN;
};

function toGrain(s: string | undefined): Grain {
  const n = slug(s || "");
  if (n === "alongx" || n === "width") return "alongX";
  if (n === "alongy" || n === "length") return "alongY";
  return "none";
}

export function materialsRowsToBoards(headers: string[], rows: string[][]): BoardSpec[] {
  const get = (row: string[], key: string) => {
    const idx = headers.indexOf(key);
    return idx >= 0 ? row[idx] ?? "" : "";
  };

  const boards: BoardSpec[] = [];
  for (const row of rows) {
    const materialTag  = slug(get(row, "MaterialTag") || get(row, "Material Tag"));
    const name         = String(get(row, "Name") || materialTag || "Board").trim();
    const boardLength  = toNumber(get(row, "BoardLength"));
    const boardWidth   = toNumber(get(row, "BoardWidth"));
    const thickness    = toNumber(get(row, "Thickness"));
    const copiesRaw    = get(row, "Copies");
    const kerf         = toNumber(get(row, "Kerf"));
    const margin       = toNumber(get(row, "Margin"));
    const grain        = toGrain(get(row, "Grain"));

    const width  = Math.max(0, boardWidth);
    const height = Math.max(0, boardLength);
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) continue;

    let copies: number | "infinite" | undefined = undefined;
    if (String(copiesRaw).toLowerCase().trim() === "infinite") copies = "infinite";
    else {
      const c = toNumber(copiesRaw);
      if (Number.isFinite(c)) copies = Math.max(0, Math.floor(c));
    }

    boards.push({
      id: name,
      width,
      height,
      thickness: Number.isFinite(thickness) ? thickness : undefined,
      copies,
      kerf: Number.isFinite(kerf) ? kerf : undefined,
      margin: Number.isFinite(margin) ? margin : undefined,
      grain,
      materialTag: materialTag || undefined,
    });
  }
  return boards;
}
