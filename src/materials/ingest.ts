// src/materials/ingest.ts
import { materialsRowsToBoards } from "./toBoards";
import { setBoards } from "../state/materials";
import { emit, Events } from "../events";

export function ingestMaterials(headers: string[], rows: string[][]) {
  const boards = materialsRowsToBoards(rows, headers);
  setBoards(boards);
  emit(Events.MATERIALS_LOADED, { count: boards.length });
  return boards.length;
}
