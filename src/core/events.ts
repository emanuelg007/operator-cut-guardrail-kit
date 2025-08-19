// Events constants & simple event bus (typed)
export const Events = {
  SETTINGS_UPDATED: "settings/UPDATED",
  LAYOUTS_READY: "layouts/READY",
} as const;

type Handler<T> = (payload: T) => void;

const listeners = new Map<string, Set<Handler<any>>>();

export function on<T = unknown>(evt: string, handler: Handler<T>): () => void {
  if (!listeners.has(evt)) listeners.set(evt, new Set());
  listeners.get(evt)!.add(handler as Handler<any>);
  return () => listeners.get(evt)!.delete(handler as Handler<any>);
}

export function emit<T = unknown>(evt: string, payload: T): void {
  const set = listeners.get(evt);
  if (!set) return;
  for (const fn of set) fn(payload);
}
