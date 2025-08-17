// src/core/eventBus.ts
export type Handler<T = any> = (payload: T) => void;

const listeners = new Map<string, Set<Handler>>();

export function on<T = any>(event: string, handler: Handler<T>): () => void {
  let set = listeners.get(event);
  if (!set) {
    set = new Set<Handler>();
    listeners.set(event, set);
  }
  set.add(handler as Handler);
  // return an unsubscribe that uses `off`
  return () => off(event, handler as Handler);
}

export function off<T = any>(event: string, handler: Handler<T>): void {
  const set = listeners.get(event);
  if (!set) return;
  set.delete(handler as Handler);
  if (set.size === 0) listeners.delete(event);
}

export function emit<T = any>(event: string, payload: T): void {
  const set = listeners.get(event);
  if (!set) return;
  // copy to avoid mutation issues if a handler unsubscribes during emit
  for (const handler of Array.from(set)) {
    try {
      (handler as Handler<T>)(payload);
    } catch (err) {
      console.error(err);
    }
  }
}

export function once<T = any>(event: string, handler: Handler<T>): void {
  const unsubscribe = on<T>(event, (p) => {
    unsubscribe();
    handler(p);
  });
}

export function clearAll(): void {
  listeners.clear();
}
