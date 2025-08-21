// src/materials/ingest.ts
import { materialsRowsToBoards } from "./toBoards";
import { setBoards } from "../state/materials";
import { emit, Events } from "../events";

/** Ingest already-parsed CSV (headers + rows) into board state. */
export function ingestMasterMaterials(headers: string[], rows: string[][]) {
  const boards = materialsRowsToBoards(headers, rows); // <-- headers first
  setBoards(boards);
  emit(Events.MATERIALS_LOADED, { count: boards.length });
}
