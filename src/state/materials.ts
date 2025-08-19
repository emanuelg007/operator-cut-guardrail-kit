// src/state/materials.ts
import type { BoardSpec } from "../nesting/types";

let _boards: BoardSpec[] = [];

export function setBoards(boards: BoardSpec[]) {
  _boards = Array.isArray(boards) ? boards : [];
  // optional: log first board so you can verify dims quickly
  if (_boards.length) {
    const b = _boards[0];
    console.log(`[materials] loaded ${_boards.length} board spec(s). First: ${b.width}×${b.height} mm (id=${b.id})`);
  } else {
    console.warn("[materials] setBoards called with empty list");
  }
}

export function getBoards(): BoardSpec[] {
  return _boards;
}

export function clearBoards() {
  _boards = [];
}
