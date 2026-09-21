# Phase 2 Progress Log

## 2026-09-19 - planning pass

- Read the private initialization brief completely; the source brief and
  processed working notes are intentionally excluded from the public tree.
- Read `paint/AGENTS.md`, local architecture/coding/UI/performance/SEO/
  validation skills, `proj-work`, `retro`, and community-audit guidance.
- Inspected the repository tree, README, package metadata, workflows, source
  modules, tests, Phase 1 plan/verification documents, and audit report.
- Confirmed clean `paint` working tree before writing planning artifacts.
- Ran `npm test`: `shape-layer.test.js` passed; `smoke.test.js` failed.
- Confirmed `paint/docs/w2/PLAN-OVERVIEW.html` is absent.
- Tried the local skill CLI; npm registry access failed with `EAI_AGAIN`.
- Used web skill discovery as fallback and reviewed the local skills/tooling
  inventory during planning.
- Created this Phase 2 plan, source-processing notes, HTML overview, and step
  workspaces. No `paint/js`, `paint/css`, `paint/index.html`, test, or workflow
  implementation file was changed.

## 2026-09-21 - Round 9 RTL matrix and cross-surface audit

- Added the reusable `.skills/rtl-browser-audit.md` checklist and linked it
  from `AGENTS.md` and the local skills index. The checklist requires a whole-
  app inventory of physical coordinates, logical CSS, pointer math, keyboard
  behavior, responsive layouts, persistence, and teardown before shared UI
  changes are considered complete.
- Added `NEXT-PLAN-STATUS.md` as the short execution queue for the remaining
  launch gates and Steps 12–13; the existing numbered status files remain
  historical evidence.
- Ran Chrome 151 against the production build at LTR 1280×900, RTL 1280×900,
  RTL 375×812, and a RTL 200%-zoom layout emulation (640×450 CSS pixels at
  device scale 2). Image More, nested Crop, and Shapes menus stayed within the
  viewport; RTL submenu fallback and canvas-handle reachability passed.
- Evidence: `output/playwright/phase-2/local-audit-20260920/rtl-browser-matrix-20260921.json`.
- Verification: `npm run verify:docs`, `npm test` (12/12), TypeScript check,
  i18n check, production build, `npm run verify:release`, and `git diff --check`.
- Real-device, HTTPS deployment, 200% zoom, and mobile performance evidence
  remain open and are not claimed by this local matrix.

## 2026-09-22 - Toolbar icon and optional workspace-shell polish

- Refined the Copy, Resize canvas, and Fill SVGs to use consistent
  `currentColor` line geometry with clearer document, resize, and paint-fill
  affordances. The dynamic More Tools menu continues to clone these source
  icons after localization.
- The workspace strip is no longer required in the static `index.html` shell;
  `main.js` mounts the tagged strip and tab bar after the editor graph loads,
  preserving the hidden-by-default persisted preference and keeping first paint
  compact. Legacy shells that already include the nodes remain supported.
- Added smoke assertions for the icon geometry and dynamic workspace mount.

The next agent should continue from the existing Step 12/13 gates in
`NEXT-AGENT-HANDOFF.md`; no advanced background-removal model is silently
enabled. The self-hosted worker/model, migration, cancellation, memory, and
real-device proofs remain explicit follow-up work.

## 2026-09-21 - Step 12 visible local workflow

- Replaced the direct synchronous Remove Background transform with a reusable
  `BackgroundRemovalController`. Crop → Remove Background now prepares a
  bounded local-provider preview, reports phase/progress, supports Escape/
  Cancel, and applies only after explicit confirmation.
- Whole-canvas and active-selection inputs are supported. Apply takes a forced
  history snapshot, flattens composite layers only after confirmation, persists
  the result, and releases the preview object URL. Advanced providers remain
  unloaded and opt-in only.
- Added controller contract coverage to `background-provider.test.js` and ran
  a Chrome 151 preview/cancel/apply smoke journey. Evidence is recorded in
  `output/playwright/phase-2/local-audit-20260920/background-removal-browser-20260921.json`.

## 2026-09-22 - About loading state and startup preview control

- Removed four static `Loading...` About values. About now has one localized,
  reusable loading status, fills version/activity synchronously, resolves
  storage/free-space values with a `finally` cleanup, and reports unavailable
  storage instead of leaving an indefinite placeholder.
- Added a development-only startup-mask preview: use
  `?debugLoading=1&loadingMs=1500` locally to hold the ribbon mask for 1.5s
  after `paint:ready`. The flag is explicit and capped at 10 seconds; normal
  production startup adds no artificial delay.
- Added smoke coverage for the single About loading state, completion cleanup,
  and delay guard.

- App-tab status paragraphs now start hidden and are revealed only by the PWA
  manager with a resolved state. Offline status no longer leaves a permanent
  “Checking…” placeholder when no registration exists.
- About free-space output now uses a fresh raw browser quota estimate and keeps
  the familiar `free of total (browser estimate)` format. The previous fixed
  10 GB presentation was removed because it is not device-disk truth.
- Reconciled the supplied offline-first segmentation blueprint into the Step
  12 future plan: lazy self-hosted Worker/model assets, exact model-graph
  validation, positive/negative prompts, cancellation, memory limits, and
  history-safe Apply. No AI runtime or model was added to this release.
- Added a project-wide localization rule to `AGENTS.md` and `.skills/coding.md`:
  every visible text change must update the shared catalog/mapping contract and
  all ready locales, with `check:i18n` required before handoff.
- Added line icons to Crop, Crop-to-selection, Rotate (90/180/270/free), Flip
  (horizontal/vertical), and improved Select with explicit translated labels.

## Handoff rule

When implementation begins, append one entry per step with files changed,
commands run, test results, unresolved browser-only checks, and any decision
that changed from `DECISIONS.md`.

## 2026-09-19 - review reconciliation and skill pruning

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

## 2026-09-19 - Round 6 customer handoff hardening

- Added the functional Hand/Pan tool, H shortcut, viewport cursor states, and
  a More Tools menu entry for mouse/touch panning.
- Fixed Select text after draw so clicking outside a moved text focus target
  clears the focus, avoids a pixel marquee, and restores the Text tool.
- Added Settings → App install/update controls, manual iOS guidance, immediate
  service-worker update checks, version-keyed worker registration, and
  idempotent cache-version synchronization.
- Added 192px Apple touch icon metadata and a stable manifest id.
- Removed raw .playwright-cli snapshots and Phase-2 initialization inputs from
  Git tracking while preserving them locally through ignore rules. Curated
  browser evidence remains under output/playwright/phase-2/playwright-cli/.
- Browser evidence is recorded in
  output/playwright/phase-2/playwright-cli/round6-browser-fixtures.json.
- Verification: npm run version:sync, npm test (5/5), syntax checks,
  git diff --check, live PWA update check, and focused interaction journeys.

## 2026-09-19 - Steps 01–04 implementation

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

## 2026-09-19 - UI refinement and Steps 05–08 foundations

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

## 2026-09-19 - Step 06 narrowed to the safe text slice

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

## 2026-09-19 - UI refinement and arrow-function consistency

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

## 2026-09-19 - Steps 01–08 completeness audit

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

## 2026-09-19 - Step 05 alpha controls and Steps 01–08 scorecard

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

## 2026-09-19 - Stabilization pass and first Steps 09–11 slices

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

## 2026-09-19 - Round 2 stabilization and Steps 09–11 continuation

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

## 2026-09-19 - Round 3 fixes and Steps 09.1–11.1

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

## 2026-09-19 - Round 4 shared contracts, text handoff, and release planning

- Unified normal, submenu, and pointer-positioned menus behind one measured,
  viewport-clamped placement contract. Representative Size, Text, Image More,
  Rotate, and narrow-viewport checks stayed inside the viewport; outside click
  and Escape still close the complete menu tree.
- Fixed palette Edit color losing its slot context when the menu closed. The
  selected index now survives until the native color input emits its change;
  `showPicker()` is used when supported with a click fallback.
- Replaced the Ribbon position select with native radio buttons and arrow-key
  activation while keeping `PanelLayoutManager` as the state owner. Replaced
  the settings light-like icon with an explicit gear.
- Measured text bounds while the active font is still applied, added minimum
  interactive padding, and handed an enabled text target to normal pixel
  selection handles. A live drag moved the selection by `+24,+12` and the
  metadata target followed. This remains raster selection, not safe text-only
  editing.
- Added shared keyboard/history constants and the project `paint-architecture`
  skill with SSOT, functional-seam, and destructured-options guidance.
- Added Phase 2 Round 4 Markdown/white HTML status, Settings release-note
  highlights, and the Phase 3 plan for localization/RTL plus a persistent
  tabbed notepad. Step 11 is explicitly partial until PWA icons, offline,
  Lighthouse, zoom, reduced-motion, and mobile evidence close.
- Verification: `npm test` 4/4, changed-module syntax, `git diff --check`,
  analyzer 0 issues/0 warnings, live browser console errors 0.

## 2026-09-19 - Round 5 text-layer boundary, release 1.6.0, and PWA quick wins

- Replaced the text commit’s direct paint-canvas write with a transparent
  `TextLayerService` and shared `TextLayerRenderer`. Text selection targets now
  drag and nudge metadata only; the normal pixel-selection status remains
  empty, and outside click clears the focus affordance.
- Added CanvasManager composition for storage, history, copy, and export. A
  normal pixel operation explicitly flattens auxiliary text layers before it
  begins, preserving a clear ownership boundary.
- Versioned the customer release as `1.6.0`, removed internal “Phase 2” labels
  from customer release notes, added 192/512/maskable PNG PWA icons, resilient
  service-worker shell installation, manifest precaching, and reduced-motion
  CSS.
- Browser evidence: text focus movement and outside-clear pass; service worker
  is activated and controls an offline reload; manifest/icon fetches pass;
  reduced-motion is detected; 320px Ribbon is 74px and internally scrollable.
- Added the historical Round 5 status and its white-theme HTML; those superseded
  artifacts now live in the ignored internal archive. Steps 12–13 remain planned
  until the 1.6.0 release boundary and
  remaining Step 11 audit gates are approved.

## 2026-09-19 - Retro Round 1: repeatable gates and evidence discipline

- Confirmed the clean `1.6.0` baseline: `npm test` passes all 5 test files and
  the current numbered status is Round 6.
- Added `npm run verify:docs` to detect stale status links, missing HTML
  companions, missing round-log entries, and outdated test-count evidence.
- Added `npm run verify:release` to check version synchronization, PWA icons,
  service-worker shell assets, JavaScript syntax, tests, documentation
  consistency, and `git diff --check` in one command.
- Added `npm run audit:runtime` to record the Step 07/08 static listener census,
  pointer registration count, memory budgets, IndexedDB/quota contracts, and
  known measurement limitations under `output/quality/`.
- Lighthouse mobile was run before and after accessibility fixes: Accessibility
  improved from 68 to 100; Best Practices and SEO stayed at 100; Performance
  measured 84 with 4.4s LCP and CLS 0. The remaining performance gap is kept
  explicit instead of being hidden behind a category exclusion.
- Fresh browser checks recorded 200% visual scale, reduced motion, 320px
  Ribbon scrolling, Escape menu closure, service-worker control, and Settings
  → App update status. PWA reload now waits if text editing or a floating
  selection is active.
- Persisted the four-hat retrospective as local-only engineering evidence in
  `docs-internal/retro/` with a white-theme report and reusable release-gate
  guidance. Step 12, Step 13, and unsafe full text editing remain explicitly
  deferred.

## 2026-09-20 - Round 7 hardening round: empty-text guard, clean Settings URL, and offline preparation

- Fixed the empty-editor edge case: an empty text placement is discarded without
  activating Select, so the Text tool remains ready for the next placement.
- Settings now remembers the last selected tab in local storage and removes both
  dialog query parameters on close. The URL is still useful while the dialog is
  open for refresh/recovery, but it never remains as stale navigation state.
- Added Settings → App → Prepare offline use. The active service worker verifies
  every current shell asset, and release verification traverses the app import
  graph so a newly imported module cannot silently be omitted from offline use.
- Browser evidence recorded 49 local JavaScript requests, 0 Fetch/XHR requests,
  clean Settings URL/tab restoration, a ready offline status, and a successful
  offline reload containing Paint, `#app`, and the text layer.
- Moved retro memory/report artifacts to ignored `docs-internal/retro/` and
  released these customer-facing fixes as version `1.6.1`.

## 2026-09-20 - Round 8 local release-candidate evidence

- Step 07 now has explicit runtime ownership and teardown: coalesced pointer
  work, cached viewport geometry, pointer-capture fallback, visibility-aware
  telemetry, and editor/controller disposal. A production-build browser journey
  drew normally, then confirmed that a later pointer event could not draw after
  a non-persisted `pagehide`, with zero console errors.
- Step 08 now stores the working canvas as a versioned PNG `Blob` and protects
  import/resize/load paths with dimension and pixel admission limits. Local
  browser fixtures rejected a 5000 × 7000 request before allocation, presented
  corrupt-autosave discard, and completed an injected-quota recovery download.
- Added the production build path and deployed-artifact workflow: `npm run
  build` produces a code-split `dist/` tree and a content-fingerprinted service
  worker shell. The local production build was served and audited rather than
  treating the source-development server as release evidence.
- Local desktop Lighthouse for that build recorded **Performance 100,
  Accessibility 96, Best Practices 100, and SEO 100**. The local slow-mobile
  diagnostic recorded **Performance 76**, so mobile 90+ remains open.
- Verification at this checkpoint: `npm test` **10/10**, scoped type checking,
  runtime audit, production-build browser recovery journeys, and the desktop
  Lighthouse budget. Evidence is retained under
  `output/playwright/phase-2/local-audit-20260920/` and `output/quality/`.
- This is deliberately not a public-launch claim. Production HTTPS install and
  update behavior, a deployed-host journey, real desktop/mobile-device checks,
  sustained large-canvas memory growth, and touch/stylus stress remain open.
  Step 12, Step 13, and Phase 3 only provide tested foundations so far; their
  visible UI workflows remain later integration work.

## 2026-09-21 - Round 9: background-removal workflow and Step 13 shell

- Step 12 now has a richer local workflow: color-key and edge-connected
  flood-fill modes, bounded tolerance, explicit/sampleable background color,
  repeatable previews, and a checkerboard result that stays non-destructive
  until Apply.
- Active pasted selections no longer fail with “Place the active selection”;
  Apply commits the temporary layer only after the forced undo snapshot, then
  replaces the selected region so undo remains meaningful.
- Crop is disabled until a real selection exists and exposes the
  “No Selection Area to Crop” hint. The menu now says “Remove Background” and
  uses a dialog/options icon.
- Mounted the first Step 13 visible shell: session-driven tabs with dirty
  indicators and keyboard navigation, plus an accessible split-view control.
  Canvas ownership and per-document persistence remain the next slice.
- Verification: 13/13 tests, TypeScript 7, i18n, docs consistency, runtime
  audit, production build, release verifier, and headless Chrome startup all
  pass.

## 2026-09-21 - Round 10: controllable workspace and mask review

- File → More now contains Save, Manage multiple Paint, and a hide/show
  workspace-strip control. The strip has compact active tabs, a manager button,
  pane selectors, and an RTL-safe split divider.
- Background removal now has an isolated normalized mask editor. Keep/remove
  rectangles survive re-preview, the preview can zoom or expand, and pointer
  capture/drag suppression prevents modal gestures from changing the canvas.
- Provider output accepts keep/remove regions after local segmentation, keeping
  the provider boundary ready for a future mask-producing model/library.
- Verification remains green: 13/13 tests, TypeScript 7, i18n, docs, build,
  runtime audit, release verification, and Chrome startup smoke.

## 2026-09-22 - Round 13: tool-menu icon regression

- Restored Pencil, Fill, Eraser, Color picker, and Magnifier SVGs in More Tools
  after fixing the localization observer so translated labels no longer replace
  icon-bearing menu content.
- Refined New, Open, and Paste icons with consistent current-color line artwork
  and shared translation keys.
- Verification: 13/13 tests, 10 repeated test loops, TypeScript 7, i18n, docs,
  production build, release verification, and headless Chrome icon inspection.

## 2026-09-22 - Round 12: opt-in full-app split and clean static shell

- Removed the split-view placeholder from `index.html`; the host is created only
  after the editor starts and remains hidden until File → More → Split Paint view.
- Split view now creates a second session document and two isolated Paint app
  instances, each with its own ribbon, canvas, sidebar, and status bar. The
  divider and close controls stay inside the active split overlay.
- Read the attached SAM/SlimSAM specification. The existing provider boundary
  already matches its privacy and lazy-loading requirements; model/ONNX assets
  remain an explicit next slice rather than an accidental first-load download.
- Verification: 13/13 tests, 10 repeated test loops, TypeScript 7, i18n, docs,
  production build, release verification, and Chrome DOM/interaction checks.

## 2026-09-21 - Round 11: persisted strip and bounded split host

- Workspace-strip visibility now uses the shared `STORAGE_KEYS` contract,
  restores safely when storage is unavailable, and defaults to hidden for new
  users. File → More remains the recovery path for showing it again.
- The split host moved out of the strip into a bounded workspace-content row;
  activating split view can no longer stretch an active tab into a full-height
  panel. The current editor remains the primary raster owner while the next
  Step 13 slice assigns independent canvas state to each pane.
- Added controller persistence coverage and reran 13/13 tests, TypeScript 7,
  i18n, docs, production build, release verification, and delayed headless
  Chrome startup smoke.
