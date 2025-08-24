// src/state/partStatus.ts

const STORAGE_KEY = "oc:printedParts";

/** Load the printed set from localStorage. */
function load(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr)
      ? new Set(arr.filter((x) => typeof x === "string"))
      : new Set();
  } catch {
    return new Set();
  }
}

/** Persist the printed set to localStorage. */
function save(set: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(set)));
  } catch {
    // ignore quota or private mode errors
  }
}

const printed: Set<string> = load();

/** Check if a placed-part id is marked printed. */
export function isPrinted(pid: string): boolean {
  return printed.has(pid);
}

/** Mark a placed-part id as printed (persists). */
export function markPrinted(pid: string): void {
  printed.add(pid);
  save(printed);
}

/** Undo printed status for a placed-part id (persists). */
export function undoPrinted(pid: string): void {
  printed.delete(pid);
  save(printed);
}

/** Optional helpers */
export function getAllPrinted(): string[] {
  return Array.from(printed);
}
export function clearPrinted(): void {
  printed.clear();
  save(printed);
}
