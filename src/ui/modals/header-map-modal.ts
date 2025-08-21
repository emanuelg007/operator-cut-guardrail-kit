// src/ui/modals/header-map-modal.ts
import type { Mapping } from "../../csv/normalize";
import { autoMap } from "../../csv/normalize";

/**
 * For now, we auto-map. If mapping is missing, we still fall back to autoMap,
 * and call onApply immediately. Drawer UI can be added later without changing the signature.
 */
export function openHeaderMapModal(
  headers: string[],
  onApply: (mapping: Mapping) => void,
  savedDefaults?: Partial<Mapping>,
  _rowsForPreview?: string[][]
) {
  const a = autoMap(headers);
  const mapping: Mapping = {
    Name: savedDefaults?.Name || a?.Name || headers[0] || "",
    Material: savedDefaults?.Material || a?.Material || "",
    Length: savedDefaults?.Length || a?.Length || "",
    Width: savedDefaults?.Width || a?.Width || "",
    Qty: savedDefaults?.Qty || a?.Qty || "",
    Note1: savedDefaults?.Note1 || a?.Note1 || "",
    Note2: savedDefaults?.Note2 || a?.Note2 || "",
  };
  onApply(mapping);
}
