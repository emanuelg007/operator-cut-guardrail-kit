# Strict Naming & API Contract

**Files:** kebab-case (e.g., `header-map-modal.ts`), **Exports:** camelCase or PascalCase for types.

## Must-exist (baseline)
- `src/core/event-bus.ts`: `on`, `off`, `emit`
- `src/core/events.ts`: `EVENTS` (object map of event names)
- `src/core/types.ts`: `CanonicalRow`, `Material`, `Settings`, `JobState`
- `src/csv/parse-csv.ts`: `parseCsv`
- `src/ui/modals/header-map-modal.ts`: `openHeaderMapModal`
- `src/index.ts`: barrel re-exports of the above

> All imports within the app MUST go through the barrel: `import { on, EVENTS } from './src/index';`

## Filenames and Export Style
- **Files:** kebab-case only.
- **Named Exports only:** default exports are forbidden (ESLint will fail).
- **Barrel-only imports:** non-barrel imports are discouraged; CI checks export names only from whitelisted files.

## Events Map (`src/core/events.ts`)
Define **every** event string once. Example:
```ts
export const EVENTS = {
  csvUploaded: "csv:uploaded",
  csvParsed: "csv:parsed",
  headerMappingRequested: "ui:header-mapping:open"
} as const;
export type EventKey = keyof typeof EVENTS;
```

## CI / Pre-commit
- `npm run check` runs `eslint`, `tsc --noEmit`, and `check-exports`.
- Pre-commit runs the same via Husky.
- CI (`.github/workflows/ci.yml`) runs on every push/PR.

## Changing APIs
- Add the new named export to its file.
- Add it to `contracts/exports.json`.
- Re-export it from `src/index.ts`.
- Update docs/spec if the behavior is user-facing.
