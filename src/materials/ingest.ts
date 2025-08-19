// src/materials/ingest.ts
import { materialsRowsToBoards } from "./toBoards";
import { setBoards } from "../state/materials";

/**
 * Call this with the parsed CSV rows of your Master Materials file.
 * e.g., after Papa.parse(...).data or your existing CSV normalizer.
 */
export function ingestMasterMaterials(rows: Array<Record<string, any>>): void {
  const boards = materialsRowsToBoards(rows);
  if (!boards.length) {
    throw new Error("Master Materials contained no valid rows (need BoardLength & BoardWidth in mm).");
  }
  setBoards(boards);
}
