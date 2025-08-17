// src/core/eventBus.ts
type Handler<T = any> = (payload: T) => void;

const listeners = new Map<string, Set<Handler>>();

export function on<T = any>(event: string, handler: Handler<T>): () => void {
  let set = listeners.get(event);
  if (!set) { set = new Set(); listeners.set(event, set); }
  set.add(handler);
  return () => off(event, handler);
}

export function off<T = any>(event: string, handler: Handler<T>): void {
  const set = listeners.get(event);
  if (set) set.delete(handler);
}

export function once<T = any>(event: string, handler: Handler<T>): () => void {
  const wrap: Handler<T> = (payload) => {
    try { handler(payload); } finally { off(event, wrap); }
  };
  return on(event, wrap);
}

export function emit<T = any>(event: string, payload: T): void {
  const set = listeners.get(event);
  if (!set) return;
  // clone to avoid mutation during iteration
  for (const handler of [...set]) {
    try { handler(payload); } catch (e) { console.error(e); }
  }
}
