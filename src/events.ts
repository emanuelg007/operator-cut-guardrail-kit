// src/events.ts
export enum Events {
  SETTINGS_UPDATED = "SETTINGS_UPDATED",
  LAYOUTS_READY = "LAYOUTS_READY",
  MATERIALS_LOADED = "MATERIALS_LOADED",
}
type Handler = (payload?: any) => void;
const bus = new Map<Events, Set<Handler>>();

export function on(e: Events, fn: Handler) {
  if (!bus.has(e)) bus.set(e, new Set());
  bus.get(e)!.add(fn);
  return () => off(e, fn);
}
export function off(e: Events, fn: Handler) { bus.get(e)?.delete(fn); }
export function emit(e: Events, payload?: any) { bus.get(e)?.forEach(fn => fn(payload)); }
