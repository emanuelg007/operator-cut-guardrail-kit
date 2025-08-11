export const events = {
  csv: {
    importRequested: "csv:import-requested",
    headersMapped: "csv:headers-mapped",
    validated: "csv:validated"
  },
  materials: {
    opened: "materials:opened",
    updated: "materials:updated"
  },
  nesting: {
    requested: "nesting:requested",
    completed: "nesting:completed"
  },
  printing: {
    labelsRequested: "printing:labels-requested",
    sheetPdfRequested: "printing:sheet-pdf-requested"
  }
} as const;

type Handler = (payload?: unknown) => void;

const listeners = new Map<string, Set<Handler>>();

export function on(eventName: string, handler: Handler) {
  if (!listeners.has(eventName)) listeners.set(eventName, new Set());
  listeners.get(eventName)!.add(handler);
  return () => off(eventName, handler);
}

export function off(eventName: string, handler: Handler) {
  listeners.get(eventName)?.delete(handler);
}

export function emit(eventName: string, payload?: unknown) {
  listeners.get(eventName)?.forEach((h) => h(payload));
}
