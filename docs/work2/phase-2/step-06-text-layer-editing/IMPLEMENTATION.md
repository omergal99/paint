# Step 06 Implementation Record

## Delivered in this increment

- Added bounded closure-based `TextDocumentStore` with normalized objects,
  revisions, z-order, subscription, replacement, removal, and serialization.
- Text commits register metadata and render to a separate transparent text
  canvas. CanvasManager composites that layer for save, copy, history, and
  export; the base paint raster is not modified by a text commit.
- Added closure-based `TextHistoryStore` with local persistence, newest-first
  ordering, de-duplication, safe parsing, clear support, and a maximum of 20
  entries.
- Added a compact Recent text control inside the active textarea editor. It can
  restore or clear entry history without introducing text-object editing.
- Added a persisted Text options checkbox for Select text after draw. When
  enabled, a committed text object is selected through an accurate,
  metadata-bound focus target. Pointer drag and arrow keys update only the
  text object; the normal pixel-selection handles are not involved.
- Kept shape select-after-draw behavior covered by the existing shape-layer
  tests.

## Safety boundary

This is intentionally not the full editable compositor. Text-only resize,
edit-after-blur, range formatting, right-click Edit, and reveal mode remain
postponed. A normal pixel operation explicitly flattens the committed text
layer before it starts, so it cannot duplicate the layer or erase unrelated
paint. Reload currently restores the composited image, not editable text
metadata. The non-negotiable overlap acceptance case for future editing still
requires undo/redo and reload proof before those features are enabled.

## Verification

- `npm test` — all 5 top-level test files passed, including the bounded
  history contract, renderer contract, and existing shape-layer coverage.
- `node --check` — passed for the changed JavaScript modules.
- `git diff --check` — passed.
- Browser smoke — local headless Chrome opened the real Text tool, committed
  text, restored it through Recent text, and cleared history while the textarea
  stayed open. A second pass verified the enabled checkbox, moved the selected
  target by `+100,+50` while pixel-selection status stayed empty, and cleared
  the target on outside click. No unsafe object-editing claim was made.

## Round 2 stabilization

- Clicking a real canvas point outside the textarea commits the text and
  switches the active tool to Select, so the editor does not reopen another
  textarea or leave Text mode active.
- “Show Recent text toolbar” now hides the live toolbar visually and
  semantically when false (`hidden`, `aria-hidden`, and `display: none`).
- “Select text after draw” remains deliberately safe: after commit it exposes
  a labeled metadata focus target, and pointer/keyboard movement updates only
  the text layer. It can always be turned off.
- Playwright evidence includes the hidden-toolbar state, outside commit/tool
  exit, and the focus-target option. Full object editing remains gated by the
  overlap/duplicate/vanish plus undo/redo/reload proof.
