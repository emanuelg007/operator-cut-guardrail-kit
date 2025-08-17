// src/nesting/constraints.ts
export type GrainMode = "lengthwise" | "none";

export function canRotatePart(
  allowRotateCell: unknown,
  materialAllowsRotate = true
) {
  const raw = String(allowRotateCell ?? "").trim();
  if (raw === "0") return false;
  if (raw === "1") return true;
  if (raw === "2") return !!materialAllowsRotate; // "same as material"
  // default: allow
  return true;
}

// If grain is lengthwise (board height direction), enforce L→boardH, W→boardW unless rotation is allowed
export function orientationsFor(
  partL: number, partW: number,
  grain: GrainMode,
  rotationAllowed: boolean
): Array<{ w: number; h: number; rotated: boolean }> {
  if (grain === "none") {
    return rotationAllowed
      ? [{ w: partW, h: partL, rotated: false }, { w: partL, h: partW, rotated: true }]
      : [{ w: partW, h: partL, rotated: false }];
  }
  // grain lengthwise -> prefer L vertical; only allow swap if rotation is allowed
  if (rotationAllowed) {
    return [
      { w: partW, h: partL, rotated: false }, // length vertical
      { w: partL, h: partW, rotated: true },  // swapped
    ];
  }
  return [{ w: partW, h: partL, rotated: false }];
}
