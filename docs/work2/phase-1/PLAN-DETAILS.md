# Paint - Plan Details (per-item specs)

> Companion to `PLAN-OVERVIEW.md`. All paths under `paint/`.

## #1 - V-shape anchor + create-then-move toggle

**Problem:** `drawNormalizedV()` (`ShapeTool.js:149-154`) centers via
`squareBounds(x,y,w,h)`. Drag direction shifts the square, so V jumps,
unlike X/rectangle which use raw x,y,w,h.

**Plan:**
- Add `paint:shape-select-after-draw` bool (default OFF) as checkbox row
  in Shapes gallery More footer (reuse `.menu-checkbox` style).
- When ON: after `ShapeTool.onUp` commits, call `setSelection(bbox)` +
  switch to `select` + lift floating pixels so user moves it immediately.
- Persist via `SettingsRegistry`; register key.
- Optional V tweak: map V points to raw `(x,y,w,h)` like rectangle.
  Confirm before changing look.

**Accept:** toggle ON lets user reposition right after draw; OFF = today.

## #2 - First paste on fresh New goes to 0,0

**Current:** `ClipboardManager:45-47` pastes at `statusBar.currentPointer`
if present, else 0,0. After restart the stale pointer misplaces first paste.

**Plan:** add `isFreshDoc` flag - set true on `newFile()` / cold load with
no `omerpaint:last-canvas`; cleared on first draw/paste/resize/open.
In `insertBitmapAsFloatingSelection`: if fresh → x=0,y=0, else pointer.
~5 lines, no storage change.

**Accept:** cold-start → New → Ctrl+V lands at 0,0; later pastes follow cursor.

## #3 - Font-size slider 1–120

**Current:** `#line-size` + `[data-size-option]` + `#custom-line-size`
in `Toolbar._bindLineSize` (clamp 1–300).

**Plan:** add `<input type=range min=1 max=120>` on top of
`.size-menu-items` + live label; reuse same `applySize()` path; sync
number input + boxes on `input` event. Text clamps 1–120; brush keeps 1–300.

**Accept:** drag updates textarea + committed text + label; persists via
existing `_styles`. Add `aria-label`, 28px touch target.

## #4 - Settings Release Notes tab

**Plan:** new tab `data-settings-tab="release"` + panel in `#settings-dialog`
(`index.html:853-859`); static `RELEASE_NOTES` const in new
`js/releaseNotes.js`, rendered by `main.js`. Start with 1.5.0 + Unreleased.
Reuses `.settings-panel`; keep `?dialog=settings&tab=release` deep-link.

## #5 - tool-status-btn hover affordance


## #6 - History upgrade

### 6.0 Skip no-change saves
Hash/sample pixels (dims + dataURL length or 32px sample) vs last saved in
`GlobalHistory.addSession` + `persistToStorage`; skip if identical.

### 6.1 History / Session tabs + responsive grid
Wrap `#history-grid` with `[History|Session]` tab bar.
History = IndexedDB persistent (honors lifecycle/all/manual).
Session = in-memory `HistoryManager.undoStack+redoStack+current`
(every stroke; click restores via `_restore` with confirm; dies on reload).
Undo/Redo stays session-scoped MAX 20 - unchanged, correct per request.
CSS: `grid-template-columns: repeat(auto-fill,minmax(120px,1fr))`;
1 col narrow → 2 cols when `.right-sidebar` wide/resized.

### 6.2 Button colors (CSS only)
Save=light green, Clear=light red, Export=light blue (pastel bg + dark-mode
variants); keep `.danger` semantics.

## #8 - Quota + compressed thumbs (do before #6)

About (`main.js:1184`): show `Used X · Free Y · Quota Z` + bar from
`navigator.storage.estimate()`; fallback Unavailable.
Thumbs: store `{thumb webp q0.6 max160px, full PNG}`; grid uses thumb,
load/export uses full; fallback to full on encode fail. Compress on
`addSession` (off hot path). IDB v1→v2 migration adds `thumb`+`docId`.
Quota guard: >80% → drop oldest + flash.

## #7 - Tabs (max 10) + split + session service [XL, last]

### UX
TabBar above viewport: `+`, chips with dirty dot, x per tab,
Ctrl+Tab cycle. Min 1 (no close-all), max 10. Split toggle → L/R panes
with draggable divider (mouse/touch/keyboard). Tabs move L↔R via
drag or menu. Closed-tab toast Undo 8s; TTL trash ~5min max 3 tabs.

### New modules (small, modular)
`js/session/SessionService.js` (owns Map docId→doc, panes),
`PaintDocument.js` (canvas+undo+selection+dirty),
`TabStore.js` (order/active/per-doc keys), `RecoveryService.js`
(sessionStorage snapshot + crash flag + TTL).
`js/ui/TabBar.js` (dumb strip) + `js/ui/SplitView.js` (generic divider,
reusable; persisted ratio). Reuse `statusBar.flash` for toasts.

### Storage/memory
Per-doc keys `omerpaint:doc:<id>:canvas`; migrate current key → doc-1.
Active = full-res; inactive = compressed snapshot + undo cap 10;
closed = 1 snapshot TTL. IDB sessions gain `docId` (back-compat).
`sessionStorage.paint:tabs:v1` debounced; crash flag → Restore offer.

### Order inside #7
1 multi-tab single-pane → 2 per-doc keys+recovery → 3 SplitView wiring
→ 4 undo-close polish. Start only after #6/#8 stable.

### Skills (write at #7 kickoff, not now)
`.skills/session-storage/SKILL.md` (storage limits, TTL, crash flag) and
`.skills/split-view/SKILL.md` (pointer capture, keyboard, queries),
each <100 lines with MDN links.

## Build order
P0: #5→#3→#2→#4→#1. P1: #8 spike→#6. P2: #7 in 4 steps.
Validate each with `npm test` + manual check.

**Current:** `.inactive-status` is transparent (`styles.css:296-303`),
looks disabled but is clickable.

**Plan (CSS only):**
`inactive-status:hover { background: var(--w10-hover);
border-color: var(--w10-hover-border); cursor:pointer; }`
+ icon recolor + `:focus-visible` same. Optional title tweak in Toolbar.

