# Next-agent handoff prompt

Copy the prompt below into the next Paint agent session.

---

You are continuing work on the Paint app in:

`/home/omer/DEV/ai-3-DevEx-proj/paint`

Do not start coding immediately. First inspect the current worktree and read the
required project context below. Preserve existing user changes; do not reset,
checkout, or discard unrelated work. There is intentionally no commit yet.

## Current release state

The current customer-facing patch is version **1.6.1**. Phase 2 is a strong
release candidate, but it is not allowed to claim full production-PWA readiness
until the remaining evidence gates pass.

Already delivered and verified:

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
  are missing from the offline shell. The current shell contains 60 assets.
- Settings remembers the last tab and removes both `dialog` and `tab` from the
  URL when the dialog closes.
- Retro evidence was moved from tracked `.agent/retro/` to ignored
  `docs-internal/retro/`. Do not restore `.agent/retro/`.

Current verification:

- `npm test` passes 5/5 test files.
- `npm run verify:docs` passes.
- `npm run verify:release` passes version, syntax, tests, shell assets,
  import-graph coverage, docs, and `git diff --check`.
- `npm run audit:runtime` writes the Step 07/08 runtime audit.
- Local Chromium evidence proves empty-text behavior, Settings URL/tab
  behavior, offline preparation, and offline reload. Curated evidence is in
  `output/playwright/phase-2/playwright-cli/round2-offline-settings.json`.
- Browser evidence recorded 49 local JavaScript module requests and 0
  Fetch/XHR requests in the measured journey. Keep the dependency-free native
  ES-module architecture unless a measured performance experiment proves a
  bundler is worthwhile.

## Read these files before planning

Required product/plan context:

1. `docs/work2/phase-2/PHASE-2-STATUS.md`
2. `docs/work2/phase-2/PHASE-2-STATUS_7.md`
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
  `scripts/runtime-audit.mjs`
- `tests/contracts.test.js`, `tests/smoke.test.js`, `tests/text-layer.test.js`,
  `tests/transparency.test.js`, `tests/shape-layer.test.js`

## Recommended continuation order

### Gate A — close remaining Phase 2 release gaps first

Do not begin a broad new feature until the following gaps are measured or
explicitly accepted by the user:

1. Step 07: pointermove/rAF coalescing, cached viewport geometry, telemetry
   pause/resume and destroy, broader EventBus adoption, and runtime teardown
   evidence.
2. Step 08: Blob/object-URL history, object-URL revocation, import/paste pixel
   limits, quota-exceeded “Download now” recovery, IndexedDB corruption/open
   recovery, and large-canvas browser fixtures.
3. Step 10: `checkJs`, subsystem coverage, transparent PNG/import fixtures, and
   storage recovery/error-path fixtures.
4. Step 11: improve Lighthouse Performance from 84 toward 90 without hiding
   categories, then run production-host HTTPS/install/update evidence and a
   real desktop/mobile device matrix. Localhost evidence is useful but is not
   production PWA proof.

Keep the current 64 MiB in-memory history cap separate from browser storage
quota. Never use a larger browser quota estimate as permission to raise the
memory budget.

### Gate B — Step 12: optional advanced background removal

Implement this as a spike and provider boundary, not as a mandatory Python
dependency:

1. Define a small cancellable provider contract, for example:

   `remove(imageBlob, options, signal) -> result`

2. Keep the existing local JavaScript color-key/alpha removal as the default
   and safe fallback.
3. Compare Pyodide/WebAssembly, a separately deployed/local Python service,
   and a remote API for bundle/model size, memory, latency, privacy, offline
   behavior, deployment, and cancellation. Record the decision before adding
   a runtime.
4. Load the advanced provider only after explicit user choice. In this current
   no-build app, use native `dynamic import()` plus a dedicated Worker; if a
   bundler is later introduced, make it a separate tree-shaken chunk.
5. Add progress, cancellation, timeout, max input pixels, memory/wall-time
   limits, worker termination, failure messaging, and no-image-upload-without-
   consent behavior.
6. Self-host and version any runtime/model assets, or clearly identify a local
   service. Do not silently download a large model on first page load.
7. Decide how the Settings offline preparation feature handles this optional
   runtime. The base editor must remain fully offline; the advanced provider
   may require an explicit separate download/preparation step and must say so.
8. If budgets or privacy are poor, ship the JS fallback and postpone Python.

Step 12 is complete only when the provider can be disabled without affecting
normal drawing, PNG export, undo/redo, or offline base-app behavior.

### Gate C — Step 13: tabs, split, and recovery

Build this only after document/storage ownership is stable:

1. Add `SessionService` with `Map<docId, PaintDocument>`, active document,
   tab order, and active pane state.
2. Add `TabStore` with per-document keys and a migration path from the current
   single-canvas storage. Preserve old records and test v1 compatibility.
3. Add `RecoveryService` with session snapshot, crash flag, TTL trash/recovery,
   safe restore prompt, malformed-record handling, and explicit reset path.
4. Add a keyboard-accessible `TabBar`: maximum 10 tabs, at least one tab,
   create/close/switch, dirty indicators, focus restoration, and undo-close
   toast.
5. Add a reusable `SplitView` with mouse/touch/keyboard divider support,
   minimum pane sizes, responsive narrow/mobile behavior, and visible focus.
6. Compress inactive-document snapshots and keep per-document history bounded.
   Release canvases, ImageBitmaps, Blobs, object URLs, listeners, and workers
   when documents close or are evicted.
7. Do not build tabs/recovery around fragile text coordinates. Text object
   editing remains gated by partial-overlap, undo/redo, and reload proofs.

Step 13 is complete only when two documents can be edited independently,
recovered after a simulated crash/reload, and closed without listener,
object-URL, worker, or canvas-memory leaks.

### Gate D — Phase 3 after the Phase 2 gates

Follow this order from `docs/work2/phase-3/`:

1. **3.1 catalog:** one English fallback catalog in `js/i18n/messages.js`,
   stable `t(key, variables)`, interpolation, markup annotations, and a
   missing-key coverage check.
2. **3.2 language/RTL:** language preference, `html.lang` and `html.dir` set
   together, logical CSS properties, unchanged canvas/image coordinates, and
   LTR/RTL browser checks at desktop, 320px, and 200% zoom.
3. **3.3 notepad core:** a functional right-panel seam, plain-text textarea,
   dedicated versioned storage, bounded payload, safe normalization, debounced
   persistence, pagehide/visibility flush, and recovery/quota status.
4. **3.4 notepad tabs:** add/rename/switch/delete, active-tab persistence,
   native tab semantics, roving focus, Delete confirmation, Escape cancel,
   focus restoration, and a named maximum tab limit.
5. **3.5 release hardening:** integrate catalog and notepad with settings,
   PWA shell, offline preparation, reduced motion, mobile/200% zoom evidence,
   Lighthouse, and release notes.

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
