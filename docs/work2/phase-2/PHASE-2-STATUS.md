# Phase 2 — Current Status and UI Checks

Last updated: 2026-09-20

This is the short, updateable handoff for what is usable now, what is only a
foundation, and how to experience each delivered improvement in Paint. The
detailed evidence remains in each step workspace and `PROGRESS-LOG.md`.

Latest round: [`PHASE-2-STATUS_7.md`](PHASE-2-STATUS_7.md) ·
[visual HTML status](PHASE-2-STATUS_7.html)

## Status at a glance

| Step | Status | Score* | What is available now | Measurement / verification | Missing points / next gate | Quick UI/check path |
|---:|---|:---:|---|---|---|---|
| 01 | Done | 9/10 | Baseline, standards, and release safety evidence | `npm test` 5/5; baseline and `git diff --check` recorded | Community-standards traceability and release checklist can be more explicit | Run `npm test`; no separate feature surface |
| 02 | Done | 8/10 | Shared contracts, settings persistence, functional EventBus | Contract tests plus Settings reload check; remaining legacy owners are inventoried | Finish remaining legacy class/event owners and teardown assertions | Open Settings, change a preference, reload, and confirm it persists |
| 03 | Done | 8/10 | History/session UX, settings summaries, Ribbon/menu behavior, compact Settings layout | Smoke tests plus 1280px browser evidence; alternate Ribbon matrix remains | Complete alternate-layout browser matrix and keyboard menu audit | Open Settings and History; inspect Current-first history, two-column General choices, and the grid Ribbon tab |
| 04 | Done with follow-up | 8/10 | Resize percentage/ratio/selection behavior and transparent canvas foundation | `transparency.test.js` plus browser checkerboard check; file round trips remain | Add transparent PNG/import/export and resize regression fixtures | Open Resize; try 50% with ratio lock; choose General → Transparent and inspect the checkerboard viewport |
| 05 | Stabilized with browser gate | 9.5/10 | Compact checkerboard opacity menu, pointer-positioned palette context menu, shared outside-click lifecycle, persisted alpha, alpha-aware drawing, and source-over floating placement | `npm test` 5/5; direct browser pixel fixture matches `[237,219,237,255]`; focused menu checks | Broaden file/import/eyedropper alpha fixtures and keyboard context invocation | Open Colors, set 20%, right-click a palette slot, click outside, then draw/select/place |
| 06 | Separate text layer + safe focus movement | 9.8/10 | Recent text history, empty draggable toolbar when off, accurate bounds, transparent committed text layer, optional focus target, metadata-only move, outside-click clear, return to Text after placement, and empty-editor guard | Live browser: empty editor click-outside leaves Text active and Select inactive; selected text moves while `#status-selection` stays empty; source contract prevents TextTool raster writes | Edit-after-blur, range formatting, and reloadable text metadata remain deferred; normal pixel operations intentionally flatten the text layer |
| 07 | Foundation | 4/10 | Functional seams and EventBus groundwork | `npm run audit:runtime` records listener/pointer census and lifecycle seams; contract tests cover EventBus and autosave teardown | Runtime pointer trace, event coalescing, and browser teardown measurement remain | Run `npm run audit:runtime`; inspect `output/quality/step-07-08-runtime-audit.json` |
| 08 | Foundation | 4/10 | Memory-budget report and 64 MiB in-memory history cap | Runtime audit records 64 MiB/decoded/scratch budgets and separates storage quota; memory contract tests pass | Browser Blob/object-URL, quota-error, and IndexedDB recovery fixtures remain | Open About for quota; run `npm run audit:runtime` for the memory contract |
| 09 | Functional panel seams + shared menu placement | 8.7/10 | ActionMenuController, HistoryPanel, SettingsDialog, and one clamped placement contract for top-level/submenu/context menus | Live 1280px/320px bounds: representative menus have no viewport overflow; outside/Escape closure passes | Move more data callbacks behind seams after teardown coverage |
| 10 | Browser fixture gate delivered | 8.8/10 | Alpha composition, text focus/move handoff, selection nudge, toolbar, nested menus, constants, and CSS contracts | `npm test` 5/5; syntax; diff; live console errors 0 | Add transparent PNG/import, `checkJs`, coverage, and error-path fixtures |
| 11 | Accessibility/layout/PWA improved; install/update/offline flow delivered | 9.7/10 | Settings radio group, menu bounds at 1280/320, keyboard semantics, reduced-motion CSS, zoom-safe controls, 192/512 PNG icons, import-graph-covered versioned SW shell, offline preparation, offline reload, mobile Ribbon journey, and App install/update controls | Lighthouse after fixes: Accessibility 100, Best Practices 100, SEO 100, Performance 84; live Chromium confirms clean Settings URL/tab restore, 49 local JS requests, 0 Fetch/XHR requests, offline preparation ready, and offline reload with app/text layer | Performance optimization toward the 90+ target, real device matrix, and production-host HTTPS/install evidence remain |
| 12 | Planned | 0/10 | Optional lazy background-removal provider | Not available yet | Not available yet |
| 13 | Planned | 0/10 | Tabs, split panes, session/recovery | Not available yet | Not available yet |

\* Score is a current completion/evidence score out of 10, not a subjective
product-quality rating. A score cannot reach 10 until the step’s acceptance
behavior and its relevant browser or contract evidence are both complete.

## Round 2 result — 2026-09-20

- Empty text is not a committed object. Clicking away from an empty editor closes
  only the editor and keeps Text active, so the next canvas click is ready for a
  real text placement.
- Settings keeps its last selected tab in `localStorage`, keeps the query string
  only while the dialog is open, and removes both `dialog` and `tab` on close.
- Settings → App now exposes Prepare offline use. It asks the active service
  worker to verify the complete current shell, while release verification walks
  the app import graph and rejects missing shell modules.
- Browser proof is saved in
  [`round2-offline-settings.json`](../../output/playwright/phase-2/playwright-cli/round2-offline-settings.json).
- The retro memory/report moved to ignored `docs-internal/retro/`; public status
  docs retain only the actionable summary.

## Current safety notes

- Text now renders on a separate transparent layer and is composited for save,
  copy, history, and export. The metadata `TextDocumentStore` remains an
  in-memory ownership boundary; it is not persisted as editable text yet.
- Text-object edit-after-blur, resize, range formatting, right-click Edit, and
  reveal mode remain deferred. “Select text after draw” moves metadata only;
  normal pixel operations explicitly flatten the text layer before editing.
- Before enabling those features, tests must prove that editing after partial
  paint overlap does not erase unrelated pixels, duplicate text, or make text
  vanish; undo/redo and reload must be included.
- The requested transparency/opacity control inside the Ribbon Colors group is
  Step 05 work, not Step 04 canvas-background work. The control and core alpha
  drawing path are now implemented; Step 05 still has broader file/fixture
  follow-up before its score can reach 10.
- “Select text after draw” is intentionally tracked in Step 06 and can be
  turned on or off. It focuses the committed metadata target after commit;
  clicking elsewhere clears the focus and returns the current tool to Text. It
  must not be confused with unsafe text-object editing.
- About storage uses the browser estimate API once per 24-hour cache window,
  stores raw validated bytes in local storage, and calculates free space as
  `max(0, quota - usage)` before formatting. Browser memory remains a separate
  budget.
- The full Steps 01–08 completeness audit is recorded in
  [`STEP-01-08-AUDIT.md`](STEP-01-08-AUDIT.md).
- Step 11 now has installable PNG icons, resilient versioned shell installation,
  reduced-motion support, offline reload evidence, and an App settings tab for
  browser-native installation/update checks. Lighthouse Accessibility, Best
  Practices, and SEO now measure 100; Performance measures 84 because the
  current no-build composition still has render-blocking and unused-code cost.
  Browser-level 200% visual-scale evidence is recorded, while performance
  optimization, real device-matrix, and production-host HTTPS/install evidence
  remain before calling the PWA gate fully closed.

## Professional quality snapshot

| Dimension | Score | Current gap |
|---|---:|---|
| Code design | 9/10 | Legacy class owners and the large composition root remain |
| UI design | 9/10 | RTL/PWA polish and full visual regression remain |
| Logic/data safety | 9.2/10 | Text metadata is isolated; editable text and storage recovery remain gated |
| Verification | 9.4/10 | Release verifier, import-graph shell check, 5/5 tests, clean URL/tab browser proof, and offline reload pass. Performance 84, checkJs, coverage, runtime traces, recovery fixtures, and production device matrix remain. |
| Overall | **9/10** | Strong `1.6.1` patch release candidate; final production PWA audit remains |

## Updating this file

After each meaningful step, update only the affected row, add the shortest
working UI path, and link detailed evidence from that step's `IMPLEMENTATION.md`.
