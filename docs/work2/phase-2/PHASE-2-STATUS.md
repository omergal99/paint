# Phase 2 - Current Status and UI Checks

Last updated: 2026-09-20

This is the short, updateable handoff for what is usable now, what is only a
foundation, and how to experience each delivered improvement in Paint. The
detailed evidence remains in each step workspace and `PROGRESS-LOG.md`.

Latest round: [`PHASE-2-STATUS_8.md`](PHASE-2-STATUS_8.md) ·
[visual HTML status](PHASE-2-STATUS_8.html) ·
[short completion summary](WORK-COMPLETION-SUMMARY.html)

## Status at a glance

| Step | Status | Score* | What is available now | Measurement / verification | Missing points / next gate | Quick UI/check path |
|---:|---|:---:|---|---|---|---|
| 01 | Done | 9/10 | Baseline, standards, and release safety evidence | `npm test` 12/12; baseline and `git diff --check` recorded | Community-standards traceability and release checklist can be more explicit | Run `npm test`; no separate feature surface |
| 02 | Done | 8/10 | Shared contracts, settings persistence, functional EventBus | Contract tests plus Settings reload check; remaining legacy owners are inventoried | Finish remaining legacy class/event owners and teardown assertions | Open Settings, change a preference, reload, and confirm it persists |
| 03 | Done | 8/10 | History/session UX, settings summaries, Ribbon/menu behavior, compact Settings layout | Smoke tests plus 1280px browser evidence; alternate Ribbon matrix remains | Complete alternate-layout browser matrix and keyboard menu audit | Open Settings and History; inspect Current-first history, two-column General choices, and the grid Ribbon tab |
| 04 | Done with follow-up | 8/10 | Resize percentage/ratio/selection behavior and transparent canvas foundation | `transparency.test.js` plus browser checkerboard check; file round trips remain | Add transparent PNG/import/export and resize regression fixtures | Open Resize; try 50% with ratio lock; choose General → Transparent and inspect the checkerboard viewport |
| 05 | Stabilized with browser gate | 9.5/10 | Compact checkerboard opacity menu, pointer-positioned palette context menu, shared outside-click lifecycle, persisted alpha, alpha-aware drawing, and source-over floating placement | `npm test` 12/12; direct browser pixel fixture matches `[237,219,237,255]`; focused menu checks | Broaden file/import/eyedropper alpha fixtures and keyboard context invocation | Open Colors, set 20%, right-click a palette slot, click outside, then draw/select/place |
| 06 | Separate text layer + safe focus movement | 9.8/10 | Recent text history, empty draggable toolbar when off, accurate bounds, transparent committed text layer, optional focus target, metadata-only move, outside-click clear, return to Text after placement, and empty-editor guard | Live browser: empty editor click-outside leaves Text active and Select inactive; selected text moves while `#status-selection` stays empty; source contract prevents TextTool raster writes | Edit-after-blur, range formatting, and reloadable text metadata remain deferred; normal pixel operations intentionally flatten the text layer |
| 07 | Completed locally | 8.5/10 | Coalesced pointer/rAF work, cached viewport geometry, pointer-capture fallback, visibility-aware telemetry, and explicit editor/controller teardown | A real production-build stroke persisted; after a non-persisted `pagehide`, a later pointer input did not draw. The browser journey recorded zero console errors. | Sustained large-canvas memory growth and repeat touch/stylus stress remain. | Run `npm run audit:runtime`; inspect [`production-build-runtime.json`](../../../output/playwright/phase-2/local-audit-20260920/production-build-runtime.json) |
| 08 | Completed locally | 8.5/10 | PNG `Blob` autosave, dimension/pixel admission limits, byte-bounded history cleanup, corrupt-record recovery, and quota download escape hatch | Browser fixtures verified a versioned autosave, rejected 5000 × 7000 before allocation, displayed corrupt-autosave discard, and completed injected-quota PNG recovery. | Validate under real operating-system quota and sustained large-image pressure on user devices. | Open About for quota; inspect [`production-build-runtime.json`](../../../output/playwright/phase-2/local-audit-20260920/production-build-runtime.json) |
| 09 | Functional panel seams + shared menu placement | 8.7/10 | ActionMenuController, HistoryPanel, SettingsDialog, and one clamped placement contract for top-level/submenu/context menus | Live 1280px/320px bounds: representative menus have no viewport overflow; outside/Escape closure passes | Move more data callbacks behind seams after teardown coverage |
| 10 | Incremental type and behavior gate delivered | 8.9/10 | Alpha composition, text focus/move handoff, selection nudge, toolbar, nested menus, constants, configurable shortcuts, and a scoped `checkJs` baseline | `npm test` 12/12; `npm run typecheck` with TypeScript 7; syntax; diff; live console errors 0 | Add transparent PNG/import, expand `checkJs` through the DOM-heavy composition/UI modules, coverage, and more error-path fixtures |
| 11 | Local desktop gate met; public launch gate open | 8.5/10 | Production `dist/` build, content-fingerprinted shell cache, PWA lifecycle cleanup, accessibility/layout work, and desktop CI budget | Local production-build desktop Lighthouse: **P100 / A96 / BP100 / SEO100**; the service worker controlled the local audit. | Public HTTPS install/update, deployed-host behavior, real-device matrix, and mobile Performance 90+ remain. The slow-mobile diagnostic is P76. | Run `npm run build`; inspect the Round 8 production-build evidence. |
| 12 | Foundation delivered | 3/10 | Provider boundary, local color-key provider, optional loader, and size/memory limits | Isolated provider tests pass. | No visible background-removal UI or advanced-provider integration. | Run the background-provider test; no user-facing control yet. |
| 13 | Foundation delivered | 3/10 | Bounded session/recovery services and document state | Isolated session/recovery tests pass. | No visible tabs, split view, or canvas/IndexedDB UI integration. | Run the session test; no user-facing tabs yet. |

\* Score is a current completion/evidence score out of 10, not a subjective
product-quality rating. A score cannot reach 10 until the step’s acceptance
behavior and its relevant browser or contract evidence are both complete.

## Round 8 result - 2026-09-20

- The local runtime gate now includes an explicit disposal path: a real pointer
  stroke still saves normally, while a pointer event sent after a non-persisted
  `pagehide` does not draw. The audited production-build journey had no console
  errors.
- The local recovery gate now includes a versioned PNG `Blob` autosave, a
  5000 × 7000 image rejection before allocation, corrupt-autosave discard, and
  an injected quota failure that offers and completes a PNG download path.
- `npm run build` now produces a code-split `dist/` build with a
  content-fingerprinted service-worker shell and a build-specific worker URL.
  Local desktop Lighthouse measured
  **Performance 100, Accessibility 96, Best Practices 100, SEO 100**.
- The local slow-mobile diagnostic is **Performance 76**, so the desktop result
  must not be used to close the mobile 90+ target.
- Settings → Shortcuts is now a single source of truth: users can record a
  custom key combination, conflicts are rejected, the binding is stored in
  the settings record, and the action works immediately and after reload.
- Startup now begins with a blank canvas by default. History → “Load last image
  on startup” opts into working-image restoration; the default palette and
  color inspector render in the first shell frame.
- Settings has a reusable search field. It searches hidden panels, marks the
  matching controls, highlights matching tabs, and Enter cycles results with a
  `1/N` status.
- TypeScript 7 is a development-only checker (`npm run typecheck`); the
  production build does not invoke it. `npm run audit:runtime` verifies
  contracts without rewriting the historical JSON; use `npm run audit:snapshot`
  only when intentionally capturing a new snapshot.
- Production HTTPS/install/update proof and a real desktop/mobile-device matrix
  are still external launch gates. Step 12, Step 13, and Phase 3 are foundations
  only; they do not yet add their promised visible UI.

## Round 2 result - 2026-09-20

- Empty text is not a committed object. Clicking away from an empty editor closes
  only the editor and keeps Text active, so the next canvas click is ready for a
  real text placement.
- Settings keeps its last selected tab in `localStorage`, keeps the query string
  only while the dialog is open, and removes both `dialog` and `tab` on close.
- Settings → App now exposes Prepare offline use. It asks the active service
  worker to verify the complete current shell, while release verification walks
  the app import graph and rejects missing shell modules.
- Browser proof is saved in
  [`round2-offline-settings.json`](../../../output/playwright/phase-2/playwright-cli/round2-offline-settings.json).
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
- About storage reads the browser estimate API whenever the About tab opens,
  validates raw bytes, and calculates `max(0, quota - usage)` before showing
  `free of total (browser estimate)`. Browser memory remains a separate budget.
- Working-canvas autosave is now versioned PNG `Blob` data in IndexedDB. If a
  saved record is malformed, the app explains the recovery choice before it is
  removed; if storage reports quota exhaustion, it offers a recovery download
  instead of silently discarding the open canvas.
- Import, paste, resize, and canvas-load paths reject images above the configured
  dimension/pixel admission limits before allocating a dangerous canvas. These
  checks are locally browser-tested, but sustained device memory pressure and
  native operating-system quota behavior still need field validation.
- The full Steps 01–08 completeness audit is recorded in
  [`STEP-01-08-AUDIT.md`](STEP-01-08-AUDIT.md).
- Step 11 now has installable PNG icons, explicit PWA listener cleanup, a local
  production `dist/` build, and a content-fingerprinted shell cache with a
  build-specific worker URL. Local
  desktop Lighthouse measured P100/A96/BP100/SEO100. This is repeatable
  localhost desktop evidence, not public-host, HTTPS-install, or field
  performance proof; the local slow-mobile diagnostic remains P76.

## Professional quality snapshot

| Dimension | Score | Current gap |
|---|---:|---|
| Code design | 9/10 | Legacy class owners and the large composition root remain |
| UI design | 9/10 | RTL/PWA polish and full visual regression remain |
| Logic/data safety | 9.4/10 | Local storage-recovery fixtures now pass; editable text and real-device quota/memory pressure remain gated. |
| Verification | 9.6/10 | Release verifier, production-build audit, runtime teardown/recovery journeys, current 13/13 tests, TypeScript 7 `checkJs`, and local desktop P100/A96/BP100/SEO100 pass. Mobile P76 and public device/deployment proof remain. |
| Overall | **9/10** | Strong `1.6.1` local release candidate; final public PWA and device audit remains. |

## Updating this file

After each meaningful step, update only the affected row, add the shortest
working UI path, and link detailed evidence from that step's `IMPLEMENTATION.md`.
