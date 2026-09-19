# Phase 2 — Current Status and UI Checks

Last updated: 2026-09-19

This is the short, updateable handoff for what is usable now, what is only a
foundation, and how to experience each delivered improvement in Paint. The
detailed evidence remains in each step workspace and `PROGRESS-LOG.md`.

Latest round: [`PHASE-2-STATUS_4.md`](PHASE-2-STATUS_4.md) ·
[visual HTML status](PHASE-2-STATUS_4.html)

## Status at a glance

| Step | Status | Score* | What is available now | Measurement / verification | Missing points / next gate | Quick UI/check path |
|---:|---|:---:|---|---|---|---|
| 01 | Done | 9/10 | Baseline, standards, and release safety evidence | `npm test` 4/4; baseline and `git diff --check` recorded | Community-standards traceability and release checklist can be more explicit | Run `npm test`; no separate feature surface |
| 02 | Done | 8/10 | Shared contracts, settings persistence, functional EventBus | Contract tests plus Settings reload check; remaining legacy owners are inventoried | Finish remaining legacy class/event owners and teardown assertions | Open Settings, change a preference, reload, and confirm it persists |
| 03 | Done | 8/10 | History/session UX, settings summaries, Ribbon/menu behavior, compact Settings layout | Smoke tests plus 1280px browser evidence; alternate Ribbon matrix remains | Complete alternate-layout browser matrix and keyboard menu audit | Open Settings and History; inspect Current-first history, two-column General choices, and the grid Ribbon tab |
| 04 | Done with follow-up | 8/10 | Resize percentage/ratio/selection behavior and transparent canvas foundation | `transparency.test.js` plus browser checkerboard check; file round trips remain | Add transparent PNG/import/export and resize regression fixtures | Open Resize; try 50% with ratio lock; choose General → Transparent and inspect the checkerboard viewport |
| 05 | Stabilized with browser gate | 9.5/10 | Compact checkerboard opacity menu, pointer-positioned palette context menu, shared outside-click lifecycle, persisted alpha, alpha-aware drawing, and source-over floating placement | `npm test` 4/4; direct browser pixel fixture matches `[237,219,237,255]`; focused menu checks | Broaden file/import/eyedropper alpha fixtures and keyboard context invocation | Open Colors, set 20%, right-click a palette slot, click outside, then draw/select/place |
| 06 | Safe focus + raster-selection handoff | 8.8/10 | Recent text history, empty draggable toolbar when off, accurate text bounds, optional focus target, and normal selection handles/move handoff | Live browser: off keeps Text active; on shows selected target and 8 handles; drag offset follows metadata | Keep text-object edit-after-blur/compositor/range formatting behind overlap/undo/reload proof; pixel handoff is not text-only editing |
| 07 | Foundation | 4/10 | Functional seams and EventBus groundwork | Static listener inventory and contract tests; repeatable pointer trace, coalescing, and teardown measurements are still missing | No new visible performance claim yet; browser trace and listener audit remain |
| 08 | Foundation | 4/10 | Memory-budget report and 64 MiB in-memory history cap | Memory contract tests; browser Blob/object-URL, quota-error, and IndexedDB recovery fixtures remain | Open About to see cached storage quota separately from memory; recovery flows are not complete |
| 09 | Functional panel seams + shared menu placement | 8.7/10 | ActionMenuController, HistoryPanel, SettingsDialog, and one clamped placement contract for top-level/submenu/context menus | Live 1280px/320px bounds: representative menus have no viewport overflow; outside/Escape closure passes | Move more data callbacks behind seams after teardown coverage |
| 10 | Browser fixture gate delivered | 8.8/10 | Alpha composition, text focus/move handoff, selection nudge, toolbar, nested menus, constants, and CSS contracts | `npm test` 4/4; syntax; diff; analyzer 0/0; live console errors 0 | Add transparent PNG/import, `checkJs`, coverage, and error-path fixtures |
| 11 | Accessibility/layout partial; PWA gate open | 8.2/10 | Settings radio group, menu bounds at 1280/320, keyboard semantics, text focus, mobile overflow | Live Chromium checks; `manifest.json` inspection; console errors 0 | 192/512 PNG icons, offline/update, Lighthouse, 200% zoom, reduced motion, full mobile QA |
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
  after draw” now hands the selected raster bounds to the normal pixel
  selection handles; it does not claim text-only editing or overlap safety.
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
- Step 11 is partial: the PWA manifest still needs installable PNG icons and
  offline/update/Lighthouse evidence before a customer-facing release claim.

## Professional quality snapshot

| Dimension | Score | Current gap |
|---|---:|---|
| Code design | 8.5/10 | Legacy class owners and the large composition root remain |
| UI design | 8.8/10 | RTL/PWA polish and full visual regression remain |
| Logic/data safety | 8.5/10 | Text-only overlap-safe editing and storage recovery are gated |
| Verification | 8.4/10 | checkJs, coverage, Lighthouse, offline/update, and 200% zoom remain |
| Overall | **8.5/10** | Strong Phase 2 release candidate, not yet a complete PWA gate |

## Updating this file

After each meaningful step, update only the affected row, add the shortest
working UI path, and link detailed evidence from that step's `IMPLEMENTATION.md`.
