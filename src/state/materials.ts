// src/state/materials.ts
import type { BoardSpec } from "../nesting/types";
let boards: BoardSpec[] = [];
export function setBoards(b: BoardSpec[]) { boards = b.slice(); }
export function getBoards() { return boards.slice(); }
