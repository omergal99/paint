# Phase 2 — Current Status and UI Checks

Last updated: 2026-09-19

This is the short, updateable handoff for what is usable now, what is only a
foundation, and how to experience each delivered improvement in Paint. The
detailed evidence remains in each step workspace and `PROGRESS-LOG.md`.

Latest round: [`PHASE-2-STATUS_3.md`](PHASE-2-STATUS_3.md) ·
[visual HTML status](PHASE-2-STATUS_3.html)

## Status at a glance

| Step | Status | Score* | What is available now | Measurement / verification | Missing points / next gate | Quick UI/check path |
|---:|---|:---:|---|---|---|---|
| 01 | Done | 9/10 | Baseline, standards, and release safety evidence | `npm test` 4/4; baseline and `git diff --check` recorded | Community-standards traceability and release checklist can be more explicit | Run `npm test`; no separate feature surface |
| 02 | Done | 8/10 | Shared contracts, settings persistence, functional EventBus | Contract tests plus Settings reload check; remaining legacy owners are inventoried | Finish remaining legacy class/event owners and teardown assertions | Open Settings, change a preference, reload, and confirm it persists |
| 03 | Done | 8/10 | History/session UX, settings summaries, Ribbon/menu behavior, compact Settings layout | Smoke tests plus 1280px browser evidence; alternate Ribbon matrix remains | Complete alternate-layout browser matrix and keyboard menu audit | Open Settings and History; inspect Current-first history, two-column General choices, and the grid Ribbon tab |
| 04 | Done with follow-up | 8/10 | Resize percentage/ratio/selection behavior and transparent canvas foundation | `transparency.test.js` plus browser checkerboard check; file round trips remain | Add transparent PNG/import/export and resize regression fixtures | Open Resize; try 50% with ratio lock; choose General → Transparent and inspect the checkerboard viewport |
| 05 | Stabilized with browser gate | 9.5/10 | Compact checkerboard opacity menu, pointer-positioned palette context menu, shared outside-click lifecycle, persisted alpha, alpha-aware drawing, and source-over floating placement | `npm test` 4/4; direct browser pixel fixture matches `[237,219,237,255]`; focused menu checks | Broaden file/import/eyedropper alpha fixtures and keyboard context invocation | Open Colors, set 20%, right-click a palette slot, click outside, then draw/select/place |
| 06 | Safe focus slice done; editing gated | 8.5/10 | Recent text history, empty draggable toolbar when off, text commit exits to Select, and visible optional metadata focus target | Browser shows `hidden=false`, `aria-hidden=true`, drag movement, labeled `Focus text` target, and Select mode | Keep move/resize/edit-after-blur, compositor, hit-testing, reveal, and range formatting behind overlap/undo/reload proof |
| 07 | Foundation | 4/10 | Functional seams and EventBus groundwork | Static listener inventory and contract tests; repeatable pointer trace, coalescing, and teardown measurements are still missing | No new visible performance claim yet; browser trace and listener audit remain |
| 08 | Foundation | 4/10 | Memory-budget report and 64 MiB in-memory history cap | Memory contract tests; browser Blob/object-URL, quota-error, and IndexedDB recovery fixtures remain | Open About to see cached storage quota separately from memory; recovery flows are not complete |
| 09 | Functional panel seams delivered | 8/10 | ActionMenuController, HistoryPanel, and SettingsDialog own menu/tab/panel semantics without new class owners | Node suite plus live tab roles, keyboard navigation, focus restoration, outside/Escape closure | Move more data callbacks behind seams after teardown coverage |
| 10 | Browser fixture gate delivered | 8.5/10 | Alpha composition, text focus, selection nudge, toolbar, nested menu, and CSS contracts | `npm test` 4/4; syntax; diff; direct source-over pixel fixture; browser matrix | Add transparent PNG/import, `checkJs`, coverage, and error-path fixtures |
| 11 | Keyboard/layout matrix delivered | 8/10 | Accessible menu/dialog/tab semantics, 1280 top/left/bottom/floating, 320px overflow, Enter/Escape paths | Live Chromium measurements saved in `round3-browser-fixtures.json`; app console errors 0 | 200% zoom, reduced motion, Lighthouse, offline shell/update checks |
| 12 | Planned | 0/10 | Optional lazy background-removal provider | Not available yet | Not available yet |
| 13 | Planned | 0/10 | Tabs, split panes, session/recovery | Not available yet | Not available yet |

\* Score is a current completion/evidence score out of 10, not a subjective
product-quality rating. A score cannot reach 10 until the step’s acceptance
behavior and its relevant browser or contract evidence are both complete.

## Current safety notes

- Text is still rasterized on commit. The metadata `TextDocumentStore` is a
  future ownership boundary, not proof that text objects can be edited safely.
- Text-object compositor, hit-testing, move/resize/edit-after-blur, range
  formatting, right-click Edit, and reveal mode remain deferred. “Select text
  after draw” is now enabled only as a metadata-bound focus affordance; it does
  not edit or repaint pixels.
- Before enabling those features, tests must prove that editing after partial
  paint overlap does not erase unrelated pixels, duplicate text, or make text
  vanish; undo/redo and reload must be included.
- The requested transparency/opacity control inside the Ribbon Colors group is
  Step 05 work, not Step 04 canvas-background work. The control and core alpha
  drawing path are now implemented; Step 05 still has broader file/fixture
  follow-up before its score can reach 10.
- “Select text after draw” is intentionally tracked in Step 06 and can be
  turned on or off. It focuses the committed metadata target and leaves the
  current tool in Select after the editor commits; it must not be confused with
  unsafe text-object editing.
- About storage uses the browser estimate API once per 24-hour cache window,
  stores raw validated bytes in local storage, and calculates free space as
  `max(0, quota - usage)` before formatting. Browser memory remains a separate
  budget.
- The full Steps 01–08 completeness audit is recorded in
  [`STEP-01-08-AUDIT.md`](STEP-01-08-AUDIT.md).

## Professional quality snapshot

| Dimension | Score | Current gap |
|---|---:|---|
| Code design | 7.5/10 | Legacy class owners and the large composition root remain |
| UI design | 8/10 | Alternate Ribbon layouts and keyboard traversal need a matrix |
| Logic/data safety | 7.5/10 | Text editing and storage recovery are still gated |
| Verification | 7/10 | Trace, coverage, Lighthouse, and full browser matrix remain |
| Overall | **7.5/10** | Stabilized but not yet a complete Step 09–11 release gate |

## Updating this file

After each meaningful step, update only the affected row, add the shortest
working UI path, and link detailed evidence from that step's `IMPLEMENTATION.md`.
