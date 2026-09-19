# Phase 2 Progress Log

## 2026-09-19 — planning pass

- Read `init/initIstructions.txt` completely.
- Read `paint/AGENTS.md`, local architecture/coding/UI/performance/SEO/
  validation skills, `proj-work`, `retro`, and community-audit guidance.
- Inspected the repository tree, README, package metadata, workflows, source
  modules, tests, Phase 1 plan/verification documents, and audit report.
- Confirmed clean `paint` working tree before writing planning artifacts.
- Ran `npm test`: `shape-layer.test.js` passed; `smoke.test.js` failed.
- Confirmed `paint/docs/w2/PLAN-OVERVIEW.html` is absent.
- Tried the local skill CLI; npm registry access failed with `EAI_AGAIN`.
- Used web skill discovery as fallback; candidate skills are recorded in
  `init/processedData/04-skills-and-tooling.md`.
- Created this Phase 2 plan, source-processing notes, HTML overview, and step
  workspaces. No `paint/js`, `paint/css`, `paint/index.html`, test, or workflow
  implementation file was changed.

## Handoff rule

When implementation begins, append one entry per step with files changed,
commands run, test results, unresolved browser-only checks, and any decision
that changed from `DECISIONS.md`.

## 2026-09-19 — review reconciliation and skill pruning

- Corrected the plan's canonical standards path to
  `docs/work1/COMMUNITY_STANDARDS.md` and classified the old reference as
  maintenance drift.
- Added separate browser-memory budgeting, multi-layout Ribbon measurement,
  transparency fixture requirements, and deferred service-worker list
  automation.
- Revised advanced background removal to an optional lazy provider with a
  Worker, bounded resources, self-hosted/versioned assets, and a JS fallback.
- Recorded text compositing as deferrable if non-destructive overlap/editing
  cannot be proven.
- Pruned the installed Paint copies of `web-quality-audit`, `accessibility`,
  and `playwright` to relevant local workflows while preserving symlink targets
  and legal/metadata files.

## 2026-09-19 — Steps 01–04 implementation

- Step 01: corrected standards and code-of-conduct references, captured
  `step-01-baseline-and-safety/BASELINE.md`,
  and reached a green test gate.
- Step 02: added shared constants, functional EventBus, document contract, SettingsStore,
  service-worker entries, and contract tests.
- Step 03: added current/newest-first session history with stable deletion IDs,
  accessible tabs, choice summaries, stable Ribbon group ordering, and shape
  gallery propagation protection.
- Step 04: added percentage/ratio/selection resize behavior and transparent
  background semantics with alpha-safe clear/fill paths and tests.
- Browser verification used the installed Playwright CLI; evidence is recorded
  in the Step 03/04 implementation notes and `output/playwright/phase-2/`.
- Final Step 01–04 gate: `npm test` passed all 4 top-level test files; changed-file
  syntax checks and `git diff --check` passed. Full alpha file round trips and
  all Ribbon layout measurements remain later browser-matrix work.

## 2026-09-19 — UI refinement and Steps 05–08 foundations

- Settings refinement: reduced `.settings-shell` height/max-height to 470px,
  set `#settings-dialog` padding to 10px, added the requested area dividers,
  removed obsolete plan wording, and removed `.history-preferences` padding.
- Resize refinement: added vertically aligned Scale controls, closer/wider
  dimension inputs, and visible pixel dimensions under every quick preset.
- General settings: added persisted custom default canvas dimensions, custom
  initial zoom, and a persisted initial solid-background color.
- Functional style: converted `EventBus` to a closure factory and documented
  the incremental no-new-class rule in the project architecture skill. Existing
  class owners are being migrated at dependency seams, not rewritten blindly;
  low-risk UI/tool controllers now use closure factories too. The inventory is
  recorded in `FUNCTIONAL-MIGRATION.md`.
- Step 05 foundation: added a normalized RGBA contract and migration-compatible
  color helpers.
- Step 06 foundation: added a bounded `TextDocumentStore`; TextTool commits now
  register normalized editable metadata while raster behavior remains unchanged.
  Full overlap-safe editing stays gated until compositor/hit-test proofs exist.
- Step 08 foundation: added explicit memory-budget reporting and a 64 MiB
  byte cap for in-memory undo/redo data URLs, separate from storage quota.
- Added contract tests and service-worker entries for the new modules.

## 2026-09-19 — Step 06 narrowed to the safe text slice

- Kept select-after-draw within the verified shape-layer boundary.
- Added a bounded, closure-based `TextHistoryStore` with newest-first
  persistence, de-duplication, clear support, and a 20-entry maximum.
- Added Recent text restore/clear controls inside the active text textarea;
  restoring history changes only the textarea value and preserves the existing
  raster commit path.
- Explicitly postponed text-object move/resize/edit-after-blur, compositor,
  hit-testing, range formatting, right-click Edit, reveal mode, and the
  T/chevron split until the partial-overlap acceptance case has dedicated
  tests proving no unrelated pixel loss, duplicate text, or vanished text.
- Verification: `npm test`, changed-file `node --check`, `git diff --check`,
  and a local headless Chrome smoke flow all passed.

## 2026-09-19 — UI refinement and arrow-function consistency

- Added the requested Settings layout refinements: a left footer divider box,
  6px dialog-heading spacing, two-column General checkboxes, grid Ribbon rows,
  and a same-row Ribbon position label/select.
- Added a split Text button with an options arrow. The menu owns the Recent text
  toolbar toggle, clearly exposes the deferred text select-after-draw option,
  and contains the existing text-style controls.
- Kept the text anchor stable by placing the textarea before the toolbar with no
  wrapper padding/border offset. Added `id`/`name`, pointer dragging, and Arrow/
  Shift+Arrow keyboard movement through the toolbar.
- Converted all standalone named functions to arrow constants and documented
  the rule. Existing class methods remain explicit migration seams.
- Browser verification at 1280×900 passed: settings rendered at 470px, the
  split text menu opened, toolbar stayed below the textarea, the shell dragged,
  and text history persisted/restored. Node tests, syntax checks, and diff
  checks remained green.

## 2026-09-19 — Steps 01–08 completeness audit

- Confirmed that the requested transparency/opacity control in
  `.ribbon-group-colors` belongs to Step 05, while Step 04 owns transparent
  canvas/background semantics and PNG behavior.
- Found that the Step 05 implementation is still foundation-only: alpha values
  are normalized and persisted, but the Ribbon has no visible alpha/transparent
  control and the Freehand, Shape, Fill, and Text raster paths do not yet apply
  those alpha values.
- Added `STEP-01-08-AUDIT.md`, made the Step 05 status explicit, and corrected
  the traceability row for the delivered text-history slice from the old max-30
  wording to the implemented max-20 behavior.
- No feature implementation was claimed in this audit; the next Step 05 gate
  is the complete control → RGBA drawing/composition → persistence/pixel/export
  test path.

## 2026-09-19 — Step 05 alpha controls and Steps 01–08 scorecard

- Implemented the missing Ribbon Colors alpha path: independent foreground and
  background sliders, explicit `0%` transparent actions, checkerboard swatches,
  persisted alpha state, a keyboard-reachable palette context menu, and alpha
  propagation through Freehand, Shape, Fill, Text, and Eyedropper.
- Fixed the Text options behavior so changing “Show Recent text toolbar” hides
  or reveals an already-open editor immediately; the split now has a 16px arrow
  and visible outer/divider borders.
- Changed Ribbon settings to a responsive two-column grid when the available
  width supports it. About storage now caches one validated raw browser estimate
  per 24-hour window and calculates free space from raw `quota - usage` bytes.
- Browser verification at 1280×900 passed the controls, persistence, menu
  focus, live toolbar toggle, two-column Ribbon settings, storage display, and
  non-opaque canvas pixel checks. The measured test pixel was `26/255` alpha.
- A follow-up Ribbon layout check confirmed the alpha controls remain visible
  while `#ribbon` stays at the requested `74px` height.
- Added completion/evidence scores and measurement descriptions for every Phase
  2 row in `PHASE-2-STATUS.md`. Steps 09–11 are re-sequenced as modular slices
  after the remaining Step 07/08 gates, then quality gates, then PWA/accessibility.

## 2026-09-19 — Stabilization pass and first Steps 09–11 slices

- Replaced the visible alpha sliders in the Colors ribbon with a compact
  checkerboard transparency icon and arrow menu. Foreground/background options
  remain independent and keyboard-labeled inside the popover.
- Fixed the palette context menu’s transparent background by using the defined
  Ribbon surface color, and moved it onto the shared action-menu lifecycle so
  outside clicks and Escape close it consistently.
- Fixed per-tool alpha carry-over by storing alpha alongside remembered tool
  colors. Switching Brush → Shape and changing 20% → 100% now updates the
  active shape style instead of restoring stale opacity. Tool switching no
  longer silently restores a remembered color; only an explicit recent-style
  action may change the global picker color.
- Normalized About’s displayed browser budget to a stable 10,240 MiB cap while
  retaining the validated raw browser estimate in the once-per-day cache.
- Enabled the safe text “Select text after draw” option. It persists on/off,
  selects a metadata-bound focus target after commit, and exposes a text cursor
  without enabling unsafe raster editing.
- Started Step 09 by extracting `ActionMenuController`; Step 10 now records
  direct alpha/text/storage/menu contracts, and Step 11 records the focused
  accessibility pass. Added both new modules to the service-worker shell so
  the offline app can boot the same path. Unit tests and browser verification
  passed.

## 2026-09-19 — Round 2 stabilization and Steps 09–11 continuation

- Applied the requested alpha sizing: `.swatch-alpha-trigger` is horizontal at
  `30px × 16px`, `.swatch-stack` is `32px × 32px`, and the unused
  `swatch-alpha-transparent` class was removed.
- Fixed double-composited shape opacity during Select after draw. Floating
  layers now commit with `globalAlpha = 1` and `source-over`, preserving the
  alpha already stored in the layer.
- Fixed Text canvas-click commit: clicking a real point outside the textarea
  commits the entry, leaves Text mode, and enters Select. Enabled Select text
  after draw remains metadata-only and exposes the labeled focus target.
- Fixed the Recent text toolbar toggle’s visible state. Author CSS previously
  overrode the native hidden behavior; the live toolbar now uses `hidden`,
  `aria-hidden`, and `.text-editor-toolbar[hidden] { display: none !important; }`.
- Reworked Image actions into Resize plus More → Crop/Rotate/Flip nested
  submenus. The shared functional menu controller keeps ancestors open while a
  child opens and closes the entire tree on outside click or Escape. A bug in
  the shared document listener was found by the browser check and corrected.
- Added Round 2 Markdown/HTML status, professional quality scores, a missing-
  point table, UI walkthrough, and Playwright evidence under the Phase 2
  workspace.
- Verification: `npm test` passed all 4 top-level files; changed-file
  `node --check` passed; `git diff --check` passed; focused Playwright checks
  passed with clean final console output.
- Step 11 quick win: nested action menus now support ArrowDown/Enter/ArrowLeft
  movement and Escape/outside closure through the same controller. The full
  focus-restoration and alternate-layout matrix remains a later gate.
- Step 10 quick win: extracted `commitLayerWithSourceOver()` into the canvas
  seam and added a fake-context behavior test proving a floating layer is drawn
  at alpha `1` with `source-over`, then the caller state is restored.

## 2026-09-19 — Round 3 fixes and Steps 09.1–11.1

- Fixed the palette context menu lifecycle: it now uses the shared functional
  action-menu controller, opens beside the right-clicked swatch, clamps to the
  viewport, and closes on outside click/Escape. The item container is explicitly
  `action-menu-items color-palette-context-menu-items`.
- Changed the Recent text toolbar toggle to preserve an empty, draggable shell;
  the controls become hidden children while the toolbar remains in the DOM.
  Select text after draw now exposes a stronger selected focus target with a
  visible move glyph, `aria-pressed`, and the Select tool remains active after
  commit. Text-object pixel editing is still intentionally gated.
- Added arrow/Shift+arrow nudging for ordinary marquee selections. The first
  nudge lifts the selected pixels once, clamps movement to the canvas, and does
  not steal arrow events already consumed by menus.
- Added functional `HistoryPanel` and `SettingsDialog` seams. History/Session
  tabs, action wording, settings tab roles, panel visibility, keyboard traversal,
  and close-focus restoration now have one owner each.
- Added 10.1 direct browser alpha evidence: a 20% foreground shape with Select
  after draw commits once and matches the expected source-over pixel. Added the
  11.1 1280/320 Ribbon matrix plus Enter/Escape and settings-arrow checks.
- Added `PHASE-2-STATUS_3.md` and white-theme `PHASE-2-STATUS_3.html`, updated
  the current status links/scorecard, added the Round 3 JSON fixture report,
  precached both new seam modules, and converted Round 2 HTML to the requested
  white-only theme.
- Verification at this checkpoint: `npm test` 4/4 top-level files, changed-file
  syntax checks, live Playwright UI journeys, direct alpha pixel match, and
  keyboard/layout matrix passed. Remaining quality gates are analyzer output,
  `git diff --check`, checkJs/coverage, Lighthouse, and offline update checks.
