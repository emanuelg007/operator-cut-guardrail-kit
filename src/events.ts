// src/events.ts
export const Events = {
  SETTINGS_UPDATED: "settings/UPDATED",
  LAYOUTS_READY: "layouts/READY",
  MATERIALS_LOADED: "materials/LOADED",
} as const;

export type EventName = (typeof Events)[keyof typeof Events];

type Payloads = {
  "settings/UPDATED": any;
  "layouts/READY": { sheets: any[] };
  "materials/LOADED": { count: number };
};

type Handler = (payload: unknown) => void;

const bus = new Map<EventName, Set<Handler>>();

export function on<E extends EventName>(evt: E, fn: (p: Payloads[E]) => void) {
  let set = bus.get(evt);
  if (!set) {
    set = new Set();
    bus.set(evt, set);
  }
  set.add(fn as Handler);
  return () => off(evt, fn as Handler);
}

export function off(evt: EventName, fn: Handler) {
  const set = bus.get(evt);
  if (!set) return;
  set.delete(fn);
  if (set.size === 0) bus.delete(evt);
}

export function emit<E extends EventName>(evt: E, payload: Payloads[E]) {
  const set = bus.get(evt);
  if (!set) return;
  for (const fn of set) fn(payload);
}
