// src/csv/normalize.ts
import type { NestablePart } from "../nesting/types";

const num = (v:any)=> {
  const n = Number(String(v ?? "").replace(/[, ]+/g,""));
  return Number.isFinite(n) ? n : 0;
};
const norm = (s:any)=> String(s ?? "").trim();

export interface Mapping {
  Name: string; Material: string; Length: string; Width: string; Qty: string;
  Note1?: string; Note2?: string;
}

export function autoMap(headers: string[]): Mapping | null {
  const H = headers.map(h => h.toLowerCase().trim());
  const find = (needle: string, alts: string[] = []) => {
    const want = [needle, ...alts].map(s => s.toLowerCase());
    for (const w of want) {
      const idx = H.indexOf(w);
      if (idx >= 0) return headers[idx];
    }
    return "";
  };
  const m: Mapping = {
    Name: find("name"),
    Material: find("material", ["mat","materialtag","board material"]),
    Length: find("length", ["len","boardlength","l"]),
    Width: find("width", ["wid","boardwidth","w"]),
    Qty: find("qty", ["quantity","copies","count"]),
    Note1: find("note1"),
    Note2: find("note2"),
  };
  if (!m.Name || !m.Material || !m.Length || !m.Width || !m.Qty) return null;
  return m;
}

export function normalizeRows(headers: string[], rows: string[][], mapping: Mapping): NestablePart[] {
  const H = headers;
  const idx = (h: string) => H.indexOf(h);
  const get = (row: string[], col: string) => {
    const i = idx(col);
    return i >= 0 ? row[i] : "";
  };

  const out: NestablePart[] = [];
  for (const r of rows) {
    const name = norm(get(r, mapping.Name));
    const mat  = norm(get(r, mapping.Material)).toLowerCase();
    const len  = num(get(r, mapping.Length));
    const wid  = num(get(r, mapping.Width));
    const qty  = Math.max(0, Math.trunc(num(get(r, mapping.Qty))));
    if (!name || !mat || !len || !wid || qty <= 0) continue;

    // Treat Length as Y (h), Width as X (w)
    out.push({
      id: name, name,
      w: wid, h: len,
      qty,
      canRotate: true,
      material: mat,
      materialTag: mat,
      grain: "none",
    });
  }
  return out;
}
