# Paint Online — Phase 2 Plan Overview

## Outcome

Deliver a lighter, safer, more maintainable Paint Online application while
shipping the requested UX fixes. The plan preserves the current vanilla ES
module approach and canvas-pixel SSOT, then adds explicit contracts for
settings, events, storage, editable text, and future multi-document sessions.

## Current evidence baseline

| Area | Current evidence | Planning consequence |
|---|---|---|
| Test gate | Initial gate was red; after Step 01 corrections and Steps 02–04 tests, `npm test` passes all 4 top-level test files | Keep the green gate for each implementation step |
| Composition root | `js/main.js` is 1,867 lines | Establish seams first; split incrementally |
| Sidebar | `js/ui/Sidebar.js` is 827 lines and owns history, AI, and group settings | Extract panels without changing behavior in one large rewrite |
| CSS | Initial `css/styles.css` count was 2,344 lines | Component split is a later mechanical/polish task |
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
| P1 | 06 | Safe textarea text history plus verified select-after-draw; editable text objects deferred | 02, 04, 05 |
| P1 | 07 | Pointer performance, listener hygiene, EventBus adoption, telemetry lifecycle | 02, 03 |
| P1 | 08 | Byte-bounded history, import limits, quota and IndexedDB recovery | 02, 03, 04 |
| P1 | 09 | Incremental `main.js`/`Sidebar.js` modularization | 02, 03, 07, 08 |
| P1 | 10 | Behavioral tests, `checkJs`, coverage, contract checks | 03–09 |
| P2 | 11 | PWA, accessibility, CSS organization, Lighthouse budgets | 07–10 |
| P2 | 12 | Optional advanced background-removal adapter, lazy-loaded and isolated | 04, 08, 11 |
| P2 | 13 | Multi-tab/split session service and crash recovery | 02, 08, 09, 10 |

## Milestones

1. **M0 — trusted baseline:** tests green, evidence captured, no hidden red gate.
2. **M1 — daily-use UX:** history/session and ribbon/settings requests work.
3. **M2 — safe canvas:** resize selection, alpha, PNG export, and memory limits work.
4. **M3 — safe text workflow:** textarea history is bounded and reusable;
   durable editable text remains gated by overlap proof.
5. **M4 — maintainable runtime:** event/listener and module boundaries are explicit.
6. **M5 — launch-ready:** browser QA, Lighthouse, PWA, and accessibility gates pass.
7. **M6 — future workspace:** tabs/split/recovery can be added without another rewrite.

## Working rule

Each implementation task should be small enough to verify independently. A
step may be split into multiple PR-sized tasks; no step should be implemented
as a single broad rewrite.

## Re-planned continuation after the Steps 01–08 review

Steps 09–11 now proceed as a gated sequence rather than three broad rewrites:

1. Close the measurable Step 07 pointer/listener and Step 08 recovery gaps that
   affect module ownership and storage boundaries.
2. Execute Step 09 in small composition-root and controller extraction slices;
   the shared `ActionMenuController` is the first delivered slice.
3. Run Step 10 behavior/type/coverage checks after each Step 09 slice and as a
   complete pre-launch gate.
4. Execute Step 11 in accessibility-first, then PWA, CSS, and Lighthouse order.

The scorecard and UI verification paths are maintained in
`PHASE-2-STATUS.md`; the processed review decisions are in
`init/processedData/06-current-gaps-and-next-plan.md`.

## Scope adjustments from review

- Editable text compositing remains a design and proof obligation. If overlap,
  selection, and later editing cannot be made reliable, defer the full feature
  rather than ship a coordinate-only cache.
- Step 06 is intentionally limited to textarea history and the verified
  select-after-draw slice. Full text-object editing is a future-gated feature,
  not a claim of the current raster path.
- Python background removal is an optional provider, not a first-load runtime.
  Prefer tree-shakeable/lazy loading, a dedicated Worker, bounded inputs, and a
  self-hosted/versioned optional asset. Keep the JavaScript fallback usable.
- Browser memory is tracked separately from storage quota: decoded images,
  ImageBitmaps, scratch canvases, backing stores, Blobs, object URLs, and undo
  entries need their own limits and release checks.
- Ribbon height is measured across the actual compact, expanded, and alternate
  layouts; the 50px control band plus title band is a target, not a blind fixed
  height.
- Service-worker asset-list automation is useful maintenance work but is
  deferred within Step 11 until the higher-risk runtime and accessibility work
  is complete.
