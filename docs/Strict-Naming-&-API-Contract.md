# Strict Naming & API Contract

**Files are named exactly as below (camelCase).**
**Each file exports a single function with the same base name (camelCase).**

Example: `src/core/eventBus.ts` must export `eventBus`, not `EventBus`, not default.

## Core
- `src/core/eventBus.ts` → `export const eventBus`
- `src/core/events.ts` → `export const Events`
- `src/core/store.ts` → `export const store`
- `src/core/persist.ts` → `export function saveProject`, `export function loadProject`
- `src/core/types.ts` → interfaces only

## CSV
- `src/csv/detectDialect.ts` → `export function detectDialect`
- `src/csv/parseCsv.ts` → `export async function parseCsv`
- `src/csv/mapHeaders.ts` → `export function mapHeaders`
- `src/csv/validateRows.ts` → `export function validateRows`
- `src/csv/normalize.ts` → `export function normalize`

## Materials
- `src/materials/library.ts` → `export function library`
- `src/materials/io.ts` → `export function io`
- `src/materials/rules.ts` → `export function rules`

## Nesting
- `src/nesting/maxRects.ts` → `export function maxRects`
- `src/nesting/constraints.ts` → `export function constraints`
- `src/nesting/packJob.ts` → `export function packJob`
- `src/nesting/metrics.ts` → `export function metrics`

## Render
- `src/render/boardSvg.ts` → `export function boardSvg`
- `src/render/edgingGlyphs.ts` → `export function edgingGlyphs`
- `src/render/dims.ts` → `export function dims`
- `src/render/viewport.ts` → `export function viewport`

## UI
- `src/ui/navbar.ts` → `export function navbar`
- `src/ui/tabs.ts` → `export function tabs`
- `src/ui/sheetNav.ts` → `export function sheetNav`
- `src/ui/componentList.ts` → `export function componentList`
- `src/ui/modals/headerMapModal.ts` → `export function headerMapModal`
- `src/ui/modals/componentModal.ts` → `export function componentModal`
- `src/ui/modals/materialsModal.ts` → `export function materialsModal`
- `src/ui/modals/settingsModal.ts` → `export function settingsModal`
- `src/ui/modals/printModal.ts` → `export function printModal`
- `src/ui/toasts.ts` → `export function toasts`
- `src/ui/keyboard.ts` → `export function keyboard`

## Printing
- `src/printing/labels.ts` → `export function labels`
- `src/printing/zebra.ts` → `export function zebra`
- `src/printing/sheetsPdf.ts` → `export function sheetsPdf`
- `src/printing/tracker.ts` → `export function tracker`

## Pricing (placeholder)
- `src/pricing/engine.ts` → `export function engine`

## IO
- `src/io/projectIO.ts` → `export function projectIO`

## Utils
- `src/utils/units.ts` → `export function toMm`
- `src/utils/geom.ts` → `export function rects`
- `src/utils/id.ts` → `export function id`
- `src/utils/format.ts` → `export function format`

**No default exports.** CI will later fail builds if these names change.
