// src/nesting/packJob.ts
import { packPartsToSheets } from "./engine";
import type { PackResult } from "./types";

/**
 * Minimal wrapper that works with both signatures:
 *  - (parts, options)
 *  - (boards, parts, options)  -> throw to force the caller to use engine directly
 */
export function packJob(parts: any[], opts: any): PackResult {
  const arity = (packPartsToSheets as any).length;
  if (arity >= 3) {
    throw new Error("packJob: 3-arg engine requires calling packPartsToSheets directly with boards.");
  }
  return (packPartsToSheets as any)(parts, opts);
}
