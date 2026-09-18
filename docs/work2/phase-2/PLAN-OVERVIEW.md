# Paint Online — Phase 2 Plan Overview

## Outcome

Deliver a lighter, safer, more maintainable Paint Online application while
shipping the requested UX fixes. The plan preserves the current vanilla ES
module approach and canvas-pixel SSOT, then adds explicit contracts for
settings, events, storage, editable text, and future multi-document sessions.

## Current evidence baseline

| Area | Current evidence | Planning consequence |
|---|---|---|
| Test gate | `npm test` currently fails in `tests/smoke.test.js`; `shape-layer.test.js` passes | Make the gate green before feature expansion |
| Composition root | `js/main.js` is 1,867 lines | Establish seams first; split incrementally |
| Sidebar | `js/ui/Sidebar.js` is 827 lines and owns history, AI, and group settings | Extract panels without changing behavior in one large rewrite |
| CSS | `css/styles.css` is 2,344 lines | Component split is a later mechanical/polish task |
| Pointer path | `ToolManager` has separate move listeners and repeated coordinate conversion | Measure and coalesce before optimizing further |
| Undo memory | `HistoryManager` keeps full PNG data URLs in RAM | Byte-cap and Blob strategy is a safety priority |
| PWA | Manifest has one SVG icon; Lighthouse workflow is manual | Add installable PNG icons and repeatable budgets |
| Text | `TextTool` rasterizes text on blur | Editable text requires a real object/layer contract |
| Phase 1 carry-over | #8 quota/thumbs exists in current code; #7 tabs/split remains planned | Verify/harden #8 early; reserve tabs/split for the final step |

## Priority sequence

| Priority | Step | Result | Depends on |
|---|---:|---|---|
| P0 | 01 | Green baseline, evidence, safe release gate | — |
| P0 | 02 | SSOT contracts for events, settings, documents, and storage | 01 |
| P0 | 03 | History/session, settings, ribbon, menu, and alignment fixes | 02 |
| P0 | 04 | Resize percentage/ratio/selection behavior and transparent PNG foundation | 02 |
| P1 | 05 | Palette editing, alpha/transparent colors, migration | 02, 04 |
| P1 | 06 | Editable/movable text, text formatting, text history, edit/reveal UX | 02, 04, 05 |
| P1 | 07 | Pointer performance, listener hygiene, EventBus adoption, telemetry lifecycle | 02, 03 |
| P1 | 08 | Byte-bounded history, import limits, quota and IndexedDB recovery | 02, 03, 04 |
| P1 | 09 | Incremental `main.js`/`Sidebar.js` modularization | 02, 03, 07, 08 |
| P1 | 10 | Behavioral tests, `checkJs`, coverage, contract checks | 03–09 |
| P2 | 11 | PWA, accessibility, CSS organization, Lighthouse budgets | 07–10 |
| P2 | 12 | Optional advanced Python background-removal adapter | 04, 08, 11 |
| P2 | 13 | Multi-tab/split session service and crash recovery | 02, 08, 09, 10 |

## Milestones

1. **M0 — trusted baseline:** tests green, evidence captured, no hidden red gate.
2. **M1 — daily-use UX:** history/session and ribbon/settings requests work.
3. **M2 — safe canvas:** resize selection, alpha, PNG export, and memory limits work.
4. **M3 — editable content:** text is a durable object, not an unrecoverable raster.
5. **M4 — maintainable runtime:** event/listener and module boundaries are explicit.
6. **M5 — launch-ready:** browser QA, Lighthouse, PWA, and accessibility gates pass.
7. **M6 — future workspace:** tabs/split/recovery can be added without another rewrite.

## Working rule

Each implementation task should be small enough to verify independently. A
step may be split into multiple PR-sized tasks; no step should be implemented
as a single broad rewrite.

