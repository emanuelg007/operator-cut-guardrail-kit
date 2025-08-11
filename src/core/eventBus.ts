type Handler<T = any> = (payload: T) => void

const listeners = new Map<string, Set<Handler>>()


export const eventBus = {
  on<T = any>(event: string, handler: Handler<T>) {
    if (!listeners.has(event)) listeners.set(event, new Set())
    listeners.get(event)!.add(handler as Handler)
  },
  off<T = any>(event: string, handler: Handler<T>) {
    listeners.get(event)?.delete(handler as Handler)
  },
  emit<T = any>(event: string, payload?: T) {
    const set = listeners.get(event)
    if (!set) return
    for (const fn of set) {
      try { fn(payload as T) } catch (e) { console.error(`handler error for ${event}`, e) }
    }
  }
}
