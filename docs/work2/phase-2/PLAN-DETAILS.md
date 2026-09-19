# Phase 2 — Detailed Implementation Plan

This is the implementation sequence behind `PLAN-OVERVIEW.md`. Each section
should become small tasks with its own tests and browser checks.

## Step 01 — Baseline and safety gate

Fix the current red gate first. The smoke test references the wrong location
for the existing canonical standards document (`docs/work1/COMMUNITY_STANDARDS.md`).
Resolve the intended behavior, do not merely weaken assertions. Record the
remaining docs/tests path drift as low-priority maintenance once corrected. Add
a baseline report with line counts, listener census, storage paths, and a real
Lighthouse run when a browser is available.

**Deliverables:** green test suite, baseline metrics, link audit, manual QA
checklist, and a CI job that blocks merges on the supported commands.

## Step 02 — Contracts and SSOT

Create the seams used by later work:

- `js/core/constants.js` for storage keys, event names, limits, and versioned
  schema identifiers.
- `js/core/EventBus.js` with `on`, `off`, `once`, and `destroy`.
- `js/settings/SettingsStore.js` with defaults, validation, persistence, and
  migrations. Keep `SettingsRegistry` as the reset/ownership layer or fold it
  into the new store deliberately.
- A document contract that can later own pixels, selection, text objects,
  history, dirty state, and metadata.

Example settings definition:

```js
settings.define('canvas.backgroundMode', {
  default: 'solid',
  validate: (value) => ['solid', 'transparent', 'checkerboard', 'grid'].includes(value),
});
```

No feature should add a new `localStorage` key after this step without adding a
schema owner and migration note.

## Step 03 — Ribbon, settings, history/session UX

### History/session

- Render saved history newest-first and session entries newest/current-first.
- Give persisted cards a delete action and session snapshot cards a matching
  action. Use stable IDs so visual order cannot delete the wrong entry.
- Keep restore/load, save/export, and delete as separate click targets.
- Make the active tab visibly light blue, not only bold; include `aria-selected`
  and keyboard focus styling.
- Publicly expose `HistoryManager.restore(entry)` and
  `removeSessionEntry(id)`; stop calling `_restore` from `Sidebar`.

### Settings

- Remove the general-panel `settings-cancel` and About-panel close button;
  retain the header/footer close paths.
- Turn General choices into compact, consistent fields with a visible selected
  summary while preserving native keyboard/select semantics.
- Define a stable `RIBBON_GROUP_ORDER` and use it to render Ribbon settings.
- Keep the settings shell at 470px height/max-height with 10px dialog padding;
  divide the navigation/body/footer using the shared border token.
- Let users enter custom default canvas width/height and initial zoom values;
  show A4 dimensions in the preset labels and persist the chosen solid
  background color for future New images.

### Ribbon and menus

- Merge image actions into one “More” menu: crop, resize, rotate, flip, and
  background actions. Keep the main Select control prominent.
- Set one control band and one title band. Target 50px controls + 12px title +
  padding/border, with a measured maximum of 74px.
- Keep quick resize buttons compact while showing exact pixel dimensions below
  each label; align Scale and dimension fields to their labels.
- Stop propagation for events inside `.shape-gallery`; outside click closes the
  menu. The gallery remains open while choosing shape/fill controls.
- Keep the text button/chevron split as a future-gated follow-up after Step 06;
  it depends on the postponed editable-text proof.

## Step 04 — Resize, selection, and transparent canvas

Introduce a shared transform target:

```js
const target = selection
  ? { kind: 'selection', region: selection, source: floatingSelection }
  : { kind: 'document', region: fullCanvasRegion, source: canvas };
```

- Add a percentage control relative to the selected target.
- Default “Maintain aspect ratio” to checked; update width/height in either
  direction without feedback loops.
- If a selection exists, scale only that selection and preserve the rest of the
  canvas. Reuse the floating-selection commit lifecycle used by rotate/flip.
- Add explicit transparent background mode. Use `clearRect`/alpha compositing
  for transparent fill and a checkerboard presentation layer; do not paint a
  white replacement into the PNG.
- Verify Open, Paste, Crop, Resize, Save, and New with alpha-bearing fixtures.

## Step 05 — Colors and palette

Upgrade the palette from hex-only state to versioned RGBA state while keeping a
readable migration from existing `paint:colors` data.

- Left click selects primary; a clear context menu on right click offers Edit,
  Set as secondary, and Reset slot.
- Add a compact checkerboard transparency icon with a down-arrow action menu;
  keep the foreground/background controls inside the menu so the Colors group
  remains within the measured 74px Ribbon height.
- Persist primary and secondary alpha independently, and make the swatch
  checkerboard visible when alpha is below 100%.
- Keep eyedropper results, text colors, shape fill, brush, eraser, and export on
  the same color contract.

## Step 06 — Safe text entry history

This step takes only the impact that can be delivered without weakening the
canvas-pixel source of truth.

1. Keep the metadata-only `TextDocumentStore` as a future ownership boundary;
   it is not an editable compositor and must not be used as proof of one.
2. Keep select-after-draw behavior for supported shape-like objects covered by
   the existing layer tests.
3. Add a bounded `TextHistoryStore`: de-duplicate committed textarea entries,
   show recent text inside the active editor, persist locally, restore text into
   the textarea, and clear the history. Store at most 20 entries.
4. Preserve the current raster commit path and verify that restoring history
   does not change the anchor or create an additional canvas commit.

The following remain explicitly postponed: text-object compositor,
move/resize/edit-after-blur, range formatting, right-click Edit, and reveal
mode. A safe metadata-bound focus overlay is allowed now; it does not paint,
erase, or imply that raster text is editable.

**Future non-negotiable acceptance:** once object editing is attempted, editing
a text object after partial overlap with paint must not erase unrelated pixels,
duplicate text, or make the text vanish. It requires dedicated overlap,
undo/redo, and reload tests before the postponed UI can be enabled.

The current text workflow includes a distinct text-focus cursor and selectable
metadata-bound regions. “Select text after draw” is persisted and can always be
turned off. It selects the committed focus target only; the edit/reveal route
stays gated until compositor and overlap proofs are complete.

Round 2 also requires a canvas click outside the textarea to commit the current
entry and leave Text mode. The Recent text toolbar toggle must use both semantic
`hidden` state and a CSS `[hidden]` rule so author layout styles cannot make a
disabled toolbar remain visible.

## Step 07 — Performance and event hygiene

- Combine ToolManager pointermove work into one listener and one rAF pipeline.
- Cache the canvas rect on pointerdown and invalidate it on resize/zoom/scroll;
  do not force layout twice per move.
- Use pointer capture where it replaces temporary window listeners.
- Adopt EventBus for `paint:*` events and make every subscriber removable.
- Pause telemetry FPS rAF when the document is hidden and return a full
  `destroy()` cleanup.
- Delegate stable Ribbon actions where it reduces listener count; do not use
  delegation that obscures keyboard semantics.

Measure before/after with a repeatable draw trace. The target is fewer handlers
and less per-move work, not a cosmetic listener count.

### Step 08.1 — composition and alpha quick wins

Before deeper memory work, keep floating-layer placement in one source-over
seam. A layer already contains its intended alpha; committing it with a stale
drawing-tool `globalAlpha` compounds opacity. The placement contract therefore
forces `globalAlpha = 1` and `globalCompositeOperation = 'source-over'`.

The shared ActionMenuController is the first low-risk Step 09 seam and is also
an 8.1 integration fixture: nested menus must keep their ancestors open while
opening, and outside click/Escape must close the complete menu tree.

### Step 08.2 — recovery and budget proof

The remaining memory work is intentionally separate from browser storage quota:
measure decoded canvases, scratch surfaces, Blobs, object URLs, and history
bytes; then add release, quota-error, and reload/recovery fixtures. Do not raise
the 64 MiB in-memory cap merely because `navigator.storage.estimate()` reports
more disk quota.

## Step 08 — Storage, memory, and recovery

- Replace undo/redo full PNG strings with Blob/object URL entries or another
  byte-bounded codec. Cap total bytes, not only entry count.
- Track browser memory separately from storage quota. Include decoded image
  surfaces, ImageBitmaps, scratch canvases, backing stores, Blobs, object URLs,
  and in-memory undo entries in the memory budget and release checks.
- Revoke object URLs on eviction/clear and avoid re-encoding the current canvas
  every time the history panel opens.
- Add maximum import/paste dimensions and a visible downscale/reject message.
- Make quota-exceeded emit a user-facing storage error with “Download now”.
- Add IndexedDB open/corruption recovery with an explicit reset path.
- Finish Phase 1 #8 with `docId` compatibility and compressed thumbs; test both
  old v1 records and new records.

## Step 09 — Modularization

Extract in low-risk seams (the shared ActionMenuController is the first slice):

1. `SettingsStore` and constants.
2. `HistoryPanel` from Sidebar.
3. `AiPanel` from Sidebar.
4. `SettingsDialog` and Ribbon settings.
5. `features/keyboard.js`, `fileMenu.js`, `resize.js`, `export.js`, and
   `dragDrop.js` from main.
6. `ui/Ribbon.js` for delegated action dispatch.

At each extraction, keep `main.js` as composition root and add a public API
instead of reaching into underscored fields.

The delivered first slice is the functional `ActionMenuController`. The next
recommended slices are `HistoryPanel` and `SettingsDialog`; each must add a
behavior contract and a browser journey before the next extraction.

## Step 10 — Tests, types, and quality

- Replace new source-regex tests with behavior tests.
- Add history byte-cap/undo/redo tests, resize-selection tests, palette/context
  menu/opacity/outside-click tests, text store/focus tests plus the future
  compositor/hit-test gate, storage migration tests,
  EventBus teardown tests, and browser smoke tests.
- Add `jsconfig.json` with `checkJs`; document the five core typedefs first.
- Use Node's test coverage support and set targets per subsystem rather than a
  misleading whole-repository number.

## Step 11 — PWA, accessibility, CSS, Lighthouse

- Add 192×192 and 512×512 PNG icons, including a maskable variant if the visual
  design supports it.
- Make Service Worker installation use resilient caching. Asset-list
  synchronization automation is useful but deferred maintenance, not a blocker
  for the first PWA/accessibility pass.
- Split CSS by component only after selectors are covered by browser checks.
- Fix history tiles, dialog focus restore, ribbon keyboard overflow, visible
  focus, tabs/roles, and drag alternatives. Measure Ribbon height in compact,
  expanded, and alternate layouts rather than assuming one fixed height.
- Promote Lighthouse from manual workflow to repeatable PR/nightly budgets.

## Step 12 — Optional advanced background removal

Define a provider interface first:

```js
const provider = {
  id: 'python-background-removal',
  async remove(imageBlob, options, signal) { /* bounded adapter */ },
};
```

The default provider remains local color-key/alpha processing. The Python
provider must be explicit, size/time limited, cancellable, and transparent
about where the image goes. Prefer a separately deployed/local service or an
optional runtime; do not add a large Python/WebAssembly payload to every first
load without measuring the Lighthouse cost.

Preferred implementation order:

1. Keep the provider behind a small adapter and load it only after the user
   explicitly selects advanced removal.
2. Use native dynamic `import()` for an optional chunk; where a bundler exists,
   mark the provider as a separate chunk so tree shaking excludes it from the
   initial path. In the current no-build app, dynamic import plus a dedicated
   Worker is the practical equivalent.
3. Run the optional runtime/model in a dedicated Worker, with progress,
   cancellation, input dimensions, memory, and wall-time limits.
4. Self-host and version optional runtime/model assets, or use a separately
   deployed local service with an explicit privacy/status message.
5. If the optional path misses the memory/performance budget, keep the JS
   fallback and postpone Python rather than making it a mandatory dependency.

## Step 13 — Tabs, split, and recovery

Carry Phase 1 #7 here after the document and storage boundaries are stable:

- `SessionService`: `Map<docId, PaintDocument>`, tab order, active pane.
- `TabStore`: per-document keys and migration from the current single canvas.
- `RecoveryService`: session snapshot, crash flag, TTL trash, restore prompt.
- `TabBar` and reusable `SplitView` with keyboard-accessible divider.
- Max 10 total tabs, at least one open, dirty indicator, undo-close toast.
- Inactive documents use compressed snapshots and bounded history.

Text compositing remains a future-gated concern here: do not build the tabs or
recovery layer around a fragile text-coordinate cache. If Step 06 cannot prove
non-destructive overlap/edit behavior, defer that text UI and keep the raster
document contract explicit.
