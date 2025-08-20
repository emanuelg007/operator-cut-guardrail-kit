import type { BoardSpec, Grain } from "../nesting/types";

function normStr(v: any): string { return String(v ?? "").trim(); }
function normLower(v: any): string { return normStr(v).toLowerCase(); }

function grainFrom(v: any): Grain {
  const s = normLower(v);
  if (s === "alongx" || s === "width" || s === "x" || s === "horizontal" || s === "lengthwise") return "alongX";
  if (s === "alongy" || s === "length" || s === "y" || s === "vertical" || s === "crosswise") return "alongY";
  return "none";
}

function copiesFrom(v: any): number | "infinite" | undefined {
  const s = normLower(v);
  if (!s) return undefined;
  if (s === "inf" || s === "infinite" || s === "∞") return "infinite";
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : undefined;
}

/** Convert a generic CSV row object into a BoardSpec. */
export function rowToBoard(row: Record<string, any>): BoardSpec | null {
  const width =
    Number(row.BoardWidth ?? row.Width ?? row.W ?? row.boardW ?? row.Board_W) || 0;
  const height =
    Number(row.BoardLength ?? row.Length ?? row.H ?? row.boardH ?? row.Board_H) || 0;

  if (width <= 0 || height <= 0) return null;

  const thickness =
    Number(row.Thickness ?? row.thickness ?? row.BoardThickness ?? row.T) || undefined;

  const materialTag = normStr(row.MaterialTag ?? row.Material ?? row.Name ?? row.materialTag ?? row.material);
  const grain = grainFrom(row.Grain ?? row.GrainDirection ?? row.grain ?? row.Direction);

  const copies = copiesFrom(row.Copies ?? row.Sheets ?? row.copies);

  const idBase = row.ID ?? row.Id ?? row.Name ?? materialTag;
  const id = normStr((idBase ?? "") || "");
  const nameBase = row.Name ?? materialTag ?? id;
  const name = normStr((nameBase ?? "") || "Board");

  return {
    id: id || undefined,
    name,
    width,
    height,
    thickness,
    materialTag: materialTag || undefined,
    grain,
    copies,
    units: "mm",
  };
}

/** Convert an array of generic CSV row objects into BoardSpecs. */
export function rowsToBoards(rows: Array<Record<string, any>>): BoardSpec[] {
  const out: BoardSpec[] = [];
  for (const r of rows) {
    const b = rowToBoard(r);
    if (b) out.push(b);
  }
  return out;
}

/** Back-compat export name some modules import. */
export { rowsToBoards as materialsRowsToBoards };