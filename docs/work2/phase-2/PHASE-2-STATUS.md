# Phase 2 — Current Status and UI Checks

Last updated: 2026-09-19

This is the short, updateable handoff for what is usable now, what is only a
foundation, and how to experience each delivered improvement in Paint. The
detailed evidence remains in each step workspace and `PROGRESS-LOG.md`.

## Status at a glance

| Step | Status | What is available now | Quick UI/check path |
|---:|---|---|---|
| 01 | Done | Baseline, standards, and release safety evidence | Run `npm test`; no separate feature surface |
| 02 | Done | Shared contracts, settings persistence, functional EventBus | Open Settings, change a preference, reload, and confirm it persists |
| 03 | Done | History/session UX, settings summaries, ribbon/menu behavior, compact Settings layout | Open Settings and History; inspect Current-first history, two-column General choices, and the grid Ribbon tab |
| 04 | Done with follow-up | Resize percentage/ratio/selection behavior and transparent canvas foundation | Open Resize; try 50% with ratio lock; choose General → Transparent and inspect the checkerboard viewport |
| 05 | Foundation; requested Ribbon control is not implemented yet | RGBA contract and palette migration groundwork | Open Colors: swatches and palette work, but the transparent/alpha control is not present yet; this is the next Step 05 gate |
| 06 | Safe slice done | Textarea Recent text history, restore/clear, max 20; split Text options menu; shape select-after-draw remains tested | Choose Text, open its arrow, type text, blur to commit, open Text again, restore from Recent text; drag the bottom toolbar or focus it and use Arrow keys |
| 07 | Foundation | Functional seams and EventBus groundwork | No new visible performance claim yet; browser trace and listener audit remain |
| 08 | Foundation | Memory-budget report and 64 MiB in-memory history cap | No new required UI flow; storage/quota recovery remains |
| 09 | Planned | Incremental `main.js`/`Sidebar.js` modularization | Not available yet |
| 10 | Planned | Broader behavioral/type/quality gates | Not available yet |
| 11 | Planned | PWA, accessibility, CSS organization, Lighthouse matrix | Not available yet |
| 12 | Planned | Optional lazy background-removal provider | Not available yet |
| 13 | Planned | Tabs, split panes, session/recovery | Not available yet |

## Current safety notes

- Text is still rasterized on commit. The metadata `TextDocumentStore` is a
  future ownership boundary, not proof that text objects can be edited safely.
- Text-object compositor, hit-testing, move/resize/edit-after-blur, range
  formatting, right-click Edit, reveal mode, and the text select-after-draw
  behavior remain deferred.
- Before enabling those features, tests must prove that editing after partial
  paint overlap does not erase unrelated pixels, duplicate text, or make text
  vanish; undo/redo and reload must be included.
- The requested transparency/opacity control inside the Ribbon Colors group is
  Step 05 work, not Step 04 canvas-background work. `ColorPalette` persists
  alpha values as groundwork, but the visible control and alpha application in
  drawing/composition are not complete yet.
- The full Steps 01–08 completeness audit is recorded in
  [`STEP-01-08-AUDIT.md`](STEP-01-08-AUDIT.md).

## Updating this file

After each meaningful step, update only the affected row, add the shortest
working UI path, and link detailed evidence from that step's `IMPLEMENTATION.md`.
