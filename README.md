# Operator Cut — Guardrail Kit (MVP Scaffold)

This is a **from-scratch** Vite + TypeScript scaffold that matches your **Master Design Prompt (MVP v1)**.  
All files follow the **strict naming/API contract** and are grouped exactly by responsibility.

## Quick start (Windows, PowerShell)

```pwsh
cd C:\operator-cut-guardrail-kit
git init
npm install
npm run dev
```
Open http://localhost:5173

If `git` isn't recognized, install **Git for Windows** and reopen your terminal.

## Husky pre-commit
We enable a pre-commit that runs **type checking**:
- `prepare` script runs `husky install` during `npm install`
- Hook: `.husky/pre-commit` → `npm run typecheck`

If you ever need to re-create the hook:
```pwsh
npx husky add .husky/pre-commit "npm run typecheck"
```

## What’s included
- Minimal UI with **Import CSV** button wired through the **event bus**
- Event name constants (`src/core/events.ts`) to avoid typos
- Strict folder layout and stub modules for every area in the spec
- A one-page **Strict Naming & API Contract** in `/docs`

## Why the zip is small
This is a lightweight skeleton with just enough code to boot the app and enforce naming + structure. Dependencies are fetched by `npm install`, so the zip stays tiny.
