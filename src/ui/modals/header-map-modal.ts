// src/ui/modals/header-map-modal.ts
import type { Mapping } from "../../csv/normalize";
import { autoMap } from "../../csv/normalize";

export function openHeaderMapModal(
  headers: string[],
  onApply: (mapping: Mapping) => void,
  _savedDefaults?: Partial<Mapping>,
  _rowsForPreview?: string[][]
) {
  const m = autoMap(headers);
  onApply(m);
}
