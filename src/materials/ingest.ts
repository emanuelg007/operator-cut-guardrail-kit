// src/materials/ingest.ts
import { parseCsv } from "../csv/parseCsv";
import { rowsToBoards } from "./toBoards";
import { setBoards } from "../state/materials";

export interface IngestResult {
  count: number;
  headers: string[];
  delimiter: string;
}

export function ingestMaterialsCsvText(text: string): IngestResult {
  const { headers, rows, delimiter } = parseCsv(text);
  if (!headers?.length) throw new Error("No header row found in Master Materials CSV.");

  const required = ["Name", "BoardLength", "BoardWidth", "Thickness"];
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  const H = new Set(headers.map(norm));
  const missing = required.filter(r => !H.has(norm(r)));
  if (missing.length) throw new Error(`Missing column(s): ${missing.join(", ")}`);

  // rows[] is string[][] → convert to objects keyed by header
  const objects = rows.map(r => {
    const o: Record<string, any> = {};
    headers.forEach((h, i) => { o[h] = r[i]; });
    return o;
  });

  const boards = rowsToBoards(objects);
  setBoards(boards);

  return { count: boards.length, headers, delimiter };
}
