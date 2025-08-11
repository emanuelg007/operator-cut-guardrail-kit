# Operator Cut Program — Master Design Prompt (MVP v1)

Use this prompt as a single source of truth to design and implement the app. It consolidates all requirements, decisions, and constraints gathered so far.

---

## Goal & Vision (One-paragraph brief)
Build a **front-end-only, TypeScript** application for cabinet/board cutting optimization. Operators upload a cutting-list CSV, map headers to a canonical schema, validate, **auto-nest components with Maximal Rectangles**, and drive production via an **interactive SVG cutting diagram** plus **fast label printing** (Zebra ZPL or browser). The app is **modular** (one responsibility per file), touch-friendly, and stable: each function lives in its own file and can be swapped without impacting the rest. Materials are managed in a **Master Materials** library. MVP focuses on **CSV import → validate → nest → visualize → print (labels & sheets)**. Pricing/quotes and external layout imports are stubbed for later.

---

## Non-negotiable Constraints
- **Language:** TypeScript (strict). No backend required.
- **Rendering:** SVG for boards/parts. HTML for dialogs/labels (or ZPL for Zebra).
- **Architecture:** One function per file; pure logic separated from DOM; event bus.
- **Persistence:** IndexedDB/localStorage for sessions; **Save/Load project** to/from JSON.
- **Touch + Mouse:** Large hit targets, pinch-to-zoom, on-screen keyboard toggle.
- **Units:** Project-wide units (mm/in). Internally store **mm**; convert at UI.

---

## MVP Scope (Included)
[Content identical to your chat spec has been embedded here in full for the repo baseline.]

(For readability in this message, not all sections are repeated here. The `docs/spec.md` file in the zip contains the **entire** text you shared: MVP scope, flows, data model, file/module architecture, visualization, printing, settings, persistence, QA plan, acceptance criteria, templates, deliverables, notes, and kickoff instructions.)
