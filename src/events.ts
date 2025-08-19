// src/events.ts
// Lightweight app-wide event bus with typed payloads.

export const Events = {
  SETTINGS_UPDATED: "settings/UPDATED",
  LAYOUTS_READY: "layouts/READY",
  MATERIALS_LOADED: "materials/LOADED",
} as const;

type EventName = (typeof Events)[keyof typeof Events];

type LayoutsReadyPayload = { sheets: any[] };       // Use your concrete type if you have one
type MaterialsLoadedPayload = { count: number };    // Emitted after Master Materials ingest

interface EventPayloads {
  "settings/UPDATED": any;
  "layouts/READY": LayoutsReadyPayload;
  "materials/LOADED": MaterialsLoadedPayload;
}

type Handler<E extends EventName = EventName> = (payload: EventPayloads[E]) => void;

const bus = new Map<EventName, Set<Handler>>();

export function on<E extends EventName>(event: E, handler: Handler<E>): () => void {
  let set = bus.get(event);
  if (!set) { set = new Set(); bus.set(event, set); }
  // @ts-expect-error – generic variance for storage
  set.add(handler);
  return () => off(event, handler);
}

export function once<E extends EventName>(event: E, handler: Handler<E>): () => void {
  const offFn = on(event, (payload: any) => {
    offFn();
    // @ts-expect-error – generic variance for call
    handler(payload);
  });
  return offFn;
}

export function off<E extends EventName>(event: E, handler: Handler<E>): void {
  const set = bus.get(event);
  if (set) {
    // @ts-expect-error – generic variance for storage
    set.delete(handler);
    if (set.size === 0) bus.delete(event);
  }
}

export function emit<E extends EventName>(event: E, payload: EventPayloads[E]): void {
  const set = bus.get(event);
  if (!set || set.size === 0) return;
  for (const fn of Array.from(set)) {
    // @ts-expect-error – generic variance for call
    fn(payload);
  }
}
