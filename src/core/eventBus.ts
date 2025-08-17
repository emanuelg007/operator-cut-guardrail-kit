// src/core/eventBus.ts
type Handler<T = any> = (payload: T) => void;

const listeners = new Map<string, Set<Handler>>();

export function on<T = any>(event: string, handler: Handler<T>): () => void {
  const set = listeners.get(event) ?? new Set<Handler>();
  set.add(handler);
  listeners.set(event, set);
  return () => off(event, handler);
}

export function off<T = any>(event: string, handler: Handler<T>): void {
  const set = listeners.get(event);
  if (!set) return;
  set.delete(handler);
  if (set.size === 0) listeners.delete(event);
}

export function emit<T = any>(event: string, payload: T): void {
  const set = listeners.get(event);
  if (!set) return;
  for (const handler of set) {
    try { handler(payload); } catch (err) { console.error(err); }
  }
}
