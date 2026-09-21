# Next-agent handoff prompt

Copy the prompt below into the next Paint agent session.

---

You are continuing work on the Paint app in:

`/home/omer/DEV/ai-3-DevEx-proj/paint`

Do not start coding immediately. First inspect the current worktree and read the
required project context below. Preserve existing user changes; do not reset,
checkout, or discard unrelated work. There is intentionally no commit yet.

## Current release state

The current customer-facing patch is version **1.6.1**. Round 8 closes the
local runtime, recovery, typecheck, build, and desktop Lighthouse gates. It is
not allowed to claim full production-PWA readiness until public HTTPS,
install/update, real-device, sustained-memory, and mobile-performance evidence
passes.

Earlier delivered and verified:

- SSOT constants, SettingsStore, SettingsRegistry, DocumentContract, and the
  functional EventBus seam.
- Functional ActionMenuController, HistoryPanel, and SettingsDialog seams.
- Responsive Ribbon/menu work, nested menu placement, outside-click/Escape
  closure, keyboard focus, and compact 74px Ribbon behavior.
- Resize percentage/aspect-ratio behavior and transparent canvas semantics.
- RGBA/alpha palette behavior, independent opacity controls, source-over layer
  placement, and alpha-safe shapes.
- TextHistoryStore with bounded recent text history (20 entries).
- Separate transparent text layer and metadata-only text focus/movement.
- “Select text after draw” is enabled and reversible. It must not be treated as
  proof that unsafe editable text objects are ready.
- Empty text placement guard: clicking outside an empty editor closes it but
  keeps Text active and does not activate Select.
- Hand/Pan tool for mouse/touch viewport movement.
- PWA install/update UI, versioned service-worker cache, PNG icons, safe update
  reload behavior, and Settings → App → Prepare offline use.
- Service-worker import-graph coverage: release checks reject app modules that
  are missing from the source offline shell.
- Settings remembers the last tab and removes both `dialog` and `tab` from the
  URL when the dialog closes.
- Retro evidence was moved from tracked `.agent/retro/` to ignored
  `docs-internal/retro/`. Do not restore `.agent/retro/`.

Round 8 additions and their limits:

- Step 07 has pointer-frame coalescing, cached viewport geometry, named event
  handlers, and explicit editor/PWA/panel teardown. A browser journey proves a
  non-persisted `pagehide` blocks a later pointer stroke.
- Step 08 has image admission limits, Blob/IndexedDB recovery, URL/history
  cleanup, corrupt-record confirmation, and a quota-failure PNG-download path.
  Browser fixtures keep the open image intact while exercising those failures.
- Step 10 has a deliberately scoped `checkJs` baseline (`npm run typecheck`).
- The measured `esbuild` production output is code-split/minified. Its generated
  worker uses a content-fingerprinted cache name *and* build-specific script URL,
  giving the browser a distinct candidate on its next online load; its 12-file
  local shell controls an offline reload. A deployed two-build update is still
  an external proof gate.
- Desktop local Lighthouse is P100 / A96 / BP100 / SEO100. The local throttled
  mobile diagnostic is P76, so mobile P90+ remains an open optimization gate.
- Step 12 provider and Step 13 session/recovery foundations exist, as do Phase
  3 message-catalog and notepad-store foundations. None is yet a visible,
  end-to-end canvas/UI workflow.

Current verification:

- `npm test` passes 12/12 test files, including shortcut persistence and local-server contract tests.
- `npm run typecheck` and `npm run build` pass.
- `npm run verify:docs` passes.
- `npm run verify:release` passes version, syntax, tests, shell assets,
  import-graph coverage, docs, and `git diff --check`.
- `npm run audit:runtime` verifies Step 07/08 contracts without writing an artifact. Use `npm run audit:snapshot` only for an intentional historical JSON refresh.
- Local Chromium evidence proves empty-text behavior, Settings URL/tab behavior,
  offline preparation, recovery failure paths, teardown, and a generated-build
  offline reload. Curated Round 8 evidence is in
  `output/playwright/phase-2/local-audit-20260920/production-build-runtime.json`.
- Keep source modules readable and dependency-light. The measured production
  build now uses code splitting/minification; do not revert to a multi-module
  source-network graph without comparing real browser measurements.

## Read these files before planning

Required product/plan context:

1. `docs/work2/phase-2/PHASE-2-STATUS.md`
2. `docs/work2/phase-2/PHASE-2-STATUS_8.md`
3. `docs/work2/phase-2/PLAN-OVERVIEW.md`
4. `docs/work2/phase-2/PLAN-DETAILS.md`
5. `docs/work2/phase-2/DECISIONS.md`
6. `docs/work2/phase-2/QUALITY-GATES.md`
7. `docs/work2/phase-2/TARGET-ARCHITECTURE.md`
8. `docs/work2/phase-2/PROGRESS-LOG.md`
9. `docs/work2/phase-2/STEP-01-08-AUDIT.md`
10. `docs/work2/phase-2/step-07-performance-and-events/README.md` and
    `IMPLEMENTATION.md`
11. `docs/work2/phase-2/step-08-storage-memory-recovery/README.md` and
    `IMPLEMENTATION.md`
12. `docs/work2/phase-2/step-11-pwa-a11y-lighthouse/README.md`
13. `docs/work2/phase-2/step-12-optional-python-background-removal/README.md`
14. `docs/work2/phase-2/step-13-tabs-split-and-recovery/README.md`

Next-phase context:

15. `docs/work2/phase-3/README.md`
16. `docs/work2/phase-3/PLAN-OVERVIEW.md`
17. `docs/work2/phase-3/PLAN-DETAILS.md`
18. `docs/work2/phase-3/DECISIONS.md`

Retro/process context, when present locally:

19. `docs-internal/retro/index.json`
20. `docs-internal/retro/memory/user_feedback.json`
21. `docs-internal/retro/memory/agent_learnings.json`
22. `docs-internal/retro/memory/workspace_context.json`
23. `docs-internal/retro/skills/retro.md`
24. `docs-internal/retro/skills/release-gate.md`
25. `.skills/architecture.md` and `.skills/validation.md`

Relevant implementation surfaces:

- `js/core/constants.js`, `js/core/EventBus.js`, `js/settings/SettingsStore.js`,
  `js/settings/SettingsRegistry.js`
- `js/main.js`
- `js/tools/TextTool.js`, `js/ui/TextSelectionOverlay.js`,
  `js/document/TextLayerService.js`, `js/document/TextDocumentStore.js`
- `js/canvas/CanvasManager.js`, `js/history/HistoryManager.js`, `js/storage.js`
- `js/pwa/PwaInstallManager.js`, `js/app.js`, `sw.js`, `manifest.json`
- `scripts/release-check.mjs`, `scripts/docs-consistency.mjs`,
  `scripts/runtime-audit.mjs`, `scripts/build.mjs`,
  `scripts/lighthouse-budget.mjs`
- `js/background/BackgroundRemovalProvider.js`,
  `js/session/SessionService.js`, `js/session/RecoveryService.js`,
  `js/i18n/messages.js`, `js/notepad/NotepadStore.js`
- `tests/contracts.test.js`, `tests/smoke.test.js`, `tests/text-layer.test.js`,
  `tests/transparency.test.js`, `tests/shape-layer.test.js`

## Recommended continuation order

### Gate A - finish the external Phase 2 launch evidence

The local implementation gates are closed. Before claiming release-ready PWA
status, measure or explicitly accept these remaining gaps:

1. Repeat touch/stylus and sustained large-canvas memory/teardown stress on
   real hardware. The current teardown proof is a useful browser fixture, not a
   long-run memory benchmark.
2. Deploy the generated `dist/` folder to public HTTPS and prove native
   install, offline launch, an update from an older deployed worker, and safe
   update behavior with real user data.
3. Run a real desktop/mobile-device matrix, including touch input and an
   install/update journey. Localhost/headless Chromium is not that proof.
4. Improve and remeasure the local throttled mobile Lighthouse P76 diagnostic
   toward the agreed P90+ target. The desktop P100 budget is already enforced
   in CI; do not relabel it as a mobile result.
5. Expand the deliberately scoped Step 10 `checkJs` boundary only when the
   next subsystem is ready to be typed. Do not convert the current passing
   scoped baseline into a claim that the whole application is checked.

Keep the current 64 MiB in-memory history cap separate from browser storage
quota. Never use a larger browser quota estimate as permission to raise the
memory budget.

### Gate B - Step 12: integrate the delivered background-removal foundation

`BackgroundRemovalProvider`, the local color-key provider, and the opt-in
advanced-loader boundary are delivered and tested. The next slice is not a
second provider abstraction; it is a small user-visible workflow:

1. Add a visible action with progress, cancellation, timeout, input-pixel
   limits, and a clear fallback/error state.
2. Keep the local JavaScript color-key provider as the default. Require an
   explicit, privacy-explained choice before loading any advanced provider.
3. Before choosing Pyodide/WASM, a self-hosted service, or a remote API,
   record bundle/model size, memory, latency, privacy, offline behavior,
   deployment, and cancellation trade-offs. Never silently download a model.
4. Verify normal drawing, PNG export, undo/redo, and base offline behavior are
   unchanged when the optional provider is unavailable or disabled.

### Gate C - Step 13: integrate the delivered session/recovery foundation

`SessionService` and `RecoveryService` now provide the bounded document model,
active pane/document state, dirty state, close/undo, and recovery shell. The
next slice should connect that model rather than replace it:

1. Add an accessible `TabBar` (maximum 10 documents, at least one document,
   create/close/switch, dirty indicators, focus restoration, and undo-close).
2. Integrate canvas ownership and IndexedDB records with a tested migration
   from the current single-canvas record. Preserve v1 records and make restore
   and reset explicit.
3. Add a responsive, keyboard/touch-operable `SplitView` only after tabs have
   independent canvas ownership.
4. Release canvases, ImageBitmaps, Blobs, object URLs, listeners, and workers
   as documents close or are evicted. Prove two-document edit/reload/close
   behavior in a browser before calling the feature complete.

### Gate D - Phase 3 integration after the external launch gate

Phase 3.1's English fallback catalog, locale registry/controller, and Phase
3.3's bounded local notepad store are delivered foundations. Follow the phase
plan for the remaining visible work:

1. **3.2 language/RTL:** add reviewed non-English catalogs, use logical CSS,
   and prove LTR/RTL at desktop, 320px, and 200% zoom without changing
   canvas/image coordinates. The preference selector and `html.lang`/`dir`
   update seam are already wired.
2. **3.3/3.4 UI:** connect the notepad store to a plain-text, accessible panel
   and tabs with focused keyboard behavior and recovery/quota messaging.
3. **3.5 hardening:** integrate settings/PWA/offline preparation, reduced
   motion, mobile/zoom evidence, Lighthouse, and release notes.

Do not add rich text, attachments, collaboration, sync, search, or encrypted
export to the first notepad version.

## Engineering rules for this session

- Use functional factories/closures for new seams; do not add new classes.
- Prefer arrow-function constants and destructured option objects.
- Keep constants, storage keys, event names, limits, and schemas in SSOT files.
- Keep `main.js` as composition root; extract small tested seams instead of a
  large rewrite.
- Preserve canvas pixels as the source of truth and use explicit layer ownership.
- Use logical CSS properties for RTL; never reverse image/canvas coordinates.
- Keep user data local-first and privacy-explicit.
- For every slice: investigate, present a small action plan, wait for approval
  when scope is material, patch minimally, run the narrow test, then run tests,
  browser evidence, docs consistency, and release verification.
- Update `PHASE-2-STATUS.md`, the numbered status round, `PROGRESS-LOG.md`, and
  the relevant step/phase implementation file with score, measurement, missing
  points, and a short UI path after each meaningful slice.
- HTML status pages must use a white/light theme.
- Save only curated browser evidence under `output/playwright/`; keep raw CLI
  snapshots and initialization/private retro material out of the public repo.
- Never claim raw listener counts prove no leaks.
- Never force a service-worker reload while text editing or a floating
  selection could lose user work.
- Do not enable full text-object edit-after-blur until overlap-safe compositor,
  partial-overlap, undo/redo, and reload tests prove that unrelated pixels are
  preserved and text is not duplicated or lost.

Start by reporting what you found, the proposed next slice, its acceptance
criteria, and the exact files/tests/browser journey you will use. Then wait for
my approval before implementing the next material feature.

---
