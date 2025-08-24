// src/events.ts
import type { SheetLayout, PlacedPart } from "./nesting/types";

/**
 * Central app event registry + type-safe event bus.
 * - Intentionally does NOT import Settings to avoid cycles with state/settings.ts.
 * - SETTINGS_UPDATED carries no payload; listeners should call getSettings() when needed.
 */

export enum Events {
  SETTINGS_UPDATED = "SETTINGS_UPDATED",
  LAYOUTS_READY = "LAYOUTS_READY",
  MATERIALS_LOADED = "MATERIALS_LOADED",

  // part interactions / printing
  PART_CLICKED = "PART_CLICKED",
  PART_PRINT_REQUEST = "PART_PRINT_REQUEST",
  PART_UNDO_PRINT_REQUEST = "PART_UNDO_PRINT_REQUEST",
  PART_STATUS_CHANGED = "PART_STATUS_CHANGED",
}

/** Payload map for each event. Keep this cycle-free (no Settings import). */
declare global {
  interface OCEventPayloads {
    /** No payload; consumers can read current settings themselves. */
    [Events.SETTINGS_UPDATED]: undefined;

    [Events.LAYOUTS_READY]: {
      sheets: SheetLayout[];
    };

    [Events.MATERIALS_LOADED]: {
      count: number;
    };

    [Events.PART_CLICKED]: {
      pid: string;
      part: PlacedPart;
      sheetIdx: number;
    };

    [Events.PART_PRINT_REQUEST]: { pid: string };
    [Events.PART_UNDO_PRINT_REQUEST]: { pid: string };

    [Events.PART_STATUS_CHANGED]: {
      pid: string;
      printed: boolean;
      sheetIdx?: number;
    };
  }
}

export type PayloadOf<E extends Events> = OCEventPayloads[E];

type AnyHandler = (payload?: unknown) => void;
const bus = new Map<Events, Set<AnyHandler>>();

/* -------------------------------------------------------------------------- */
/*                                    on()                                    */
/* -------------------------------------------------------------------------- */

/** SETTINGS_UPDATED has no payload; allow simple no-arg handlers */
export function on(event: Events.SETTINGS_UPDATED, handler: () => void): () => void;

/** Strongly-typed handlers for all other events (payload REQUIRED) */
export function on(
  event: Events.LAYOUTS_READY,
  handler: (payload: OCEventPayloads[Events.LAYOUTS_READY]) => void
): () => void;
export function on(
  event: Events.MATERIALS_LOADED,
  handler: (payload: OCEventPayloads[Events.MATERIALS_LOADED]) => void
): () => void;
export function on(
  event: Events.PART_CLICKED,
  handler: (payload: OCEventPayloads[Events.PART_CLICKED]) => void
): () => void;
export function on(
  event: Events.PART_PRINT_REQUEST,
  handler: (payload: OCEventPayloads[Events.PART_PRINT_REQUEST]) => void
): () => void;
export function on(
  event: Events.PART_UNDO_PRINT_REQUEST,
  handler: (payload: OCEventPayloads[Events.PART_UNDO_PRINT_REQUEST]) => void
): () => void;
export function on(
  event: Events.PART_STATUS_CHANGED,
  handler: (payload: OCEventPayloads[Events.PART_STATUS_CHANGED]) => void
): () => void;

/** Generic fallback */
export function on<E extends Events>(event: E, handler: (payload: PayloadOf<E>) => void): () => void;

export function on<E extends Events>(event: E, handler: (payload?: any) => void) {
  if (!bus.has(event)) bus.set(event, new Set());
  bus.get(event)!.add(handler as AnyHandler);
  return () => off(event, handler as AnyHandler);
}

/* -------------------------------------------------------------------------- */
/*                                    off()                                   */
/* -------------------------------------------------------------------------- */

export function off<E extends Events>(event: E, handler: (payload: PayloadOf<E>) => void) {
  bus.get(event)?.delete(handler as AnyHandler);
}

/* -------------------------------------------------------------------------- */
/*                                   emit()                                   */
/* -------------------------------------------------------------------------- */

/** SETTINGS_UPDATED: emit without a payload */
export function emit(event: Events.SETTINGS_UPDATED): void;

/** All other events: payload REQUIRED */
export function emit(
  event: Events.LAYOUTS_READY,
  payload: OCEventPayloads[Events.LAYOUTS_READY]
): void;
export function emit(
  event: Events.MATERIALS_LOADED,
  payload: OCEventPayloads[Events.MATERIALS_LOADED]
): void;
export function emit(
  event: Events.PART_CLICKED,
  payload: OCEventPayloads[Events.PART_CLICKED]
): void;
export function emit(
  event: Events.PART_PRINT_REQUEST,
  payload: OCEventPayloads[Events.PART_PRINT_REQUEST]
): void;
export function emit(
  event: Events.PART_UNDO_PRINT_REQUEST,
  payload: OCEventPayloads[Events.PART_UNDO_PRINT_REQUEST]
): void;
export function emit(
  event: Events.PART_STATUS_CHANGED,
  payload: OCEventPayloads[Events.PART_STATUS_CHANGED]
): void;

/** Generic fallback */
export function emit<E extends Events>(event: E, payload: PayloadOf<E>): void;

export function emit<E extends Events>(event: E, payload?: any) {
  const subs = bus.get(event);
  if (!subs) return;
  for (const fn of subs) {
    try {
      // SETTINGS_UPDATED → call with no args; others → pass payload
      if (event === Events.SETTINGS_UPDATED) (fn as () => void)();
      else fn(payload as unknown);
    } catch (err) {
      console.error(`[events] handler for ${String(event)} threw`, err);
    }
  }
}

/* -------------------------------------------------------------------------- */
/*                                  once()                                    */
/* -------------------------------------------------------------------------- */
/** Optional helper: listen once, then auto-unsubscribe. */
export function once<E extends Events>(event: E, handler: (payload: PayloadOf<E>) => void) {
  const offFn = on(event as any, (p: any) => {
    try { handler(p); } finally { offFn(); }
  });
  return offFn;
}
