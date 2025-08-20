// src/state/materials.ts
import type { BoardSpec } from "../nesting/types";

let _boards: BoardSpec[] = [];

export function setBoards(boards: BoardSpec[]) {
  _boards = boards.slice();
}

export function getBoards(): BoardSpec[] {
  return _boards;
}

export function clearBoards() {
  _boards = [];
}
