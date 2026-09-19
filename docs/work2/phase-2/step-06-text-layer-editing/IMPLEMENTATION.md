# Step 06 Implementation Record

## Delivered in this increment

- Added bounded closure-based `TextDocumentStore` with normalized objects,
  revisions, z-order, subscription, replacement, removal, and serialization.
- Text commits register metadata in the store while retaining the current
  raster output path.
- Added closure-based `TextHistoryStore` with local persistence, newest-first
  ordering, de-duplication, safe parsing, clear support, and a maximum of 20
  entries.
- Added a compact Recent text control inside the active textarea editor. It can
  restore or clear entry history without introducing text-object editing.
- Added a persisted Text options checkbox for Select text after draw. When
  enabled, a committed text object is selected through an accurate,
  metadata-bound focus target and handed to the normal pixel-selection handles;
  the target remains visible and follows a committed raster move.
- Kept shape select-after-draw behavior covered by the existing shape-layer
  tests.

## Safety boundary

This is intentionally not the full editable compositor. Text-only
move/resize/edit-after-blur, range formatting, right-click Edit, and reveal mode
remain postponed. The current handoff uses the ordinary raster selection path;
it does not claim that only text pixels are isolated from paint underneath.
The non-negotiable overlap acceptance case is still open: editing a text object
after partial paint overlap must not erase unrelated pixels, duplicate text, or
make the text vanish. The metadata store must not be treated as proof of that
behavior.

## Verification

- `npm test` — all 4 top-level test files passed, including the bounded
  history contract and existing shape-layer/select-after-draw coverage.
- `node --check` — passed for the changed JavaScript modules.
- `git diff --check` — passed.
- Browser smoke — local headless Chrome opened the real Text tool, committed
  one entry, restored it through Recent text, and cleared history while the
  textarea stayed open. A second browser pass verified the enabled checkbox,
  selected focus target, and no-raster-edit boundary. No object-editing claim
  was made by this check.

## Round 2 stabilization

- Clicking a real canvas point outside the textarea commits the text and
  switches the active tool to Select, so the editor does not reopen another
  textarea or leave Text mode active.
- “Show Recent text toolbar” now hides the live toolbar visually and
  semantically when false (`hidden`, `aria-hidden`, and `display: none`).
- “Select text after draw” remains deliberately safe: after commit it exposes
  a labeled metadata focus target with a text cursor, but does not repaint or
  edit existing pixels. It can always be turned off.
- Playwright evidence includes the hidden-toolbar state, outside commit/tool
  exit, and the focus-target option. Full object editing remains gated by the
  overlap/duplicate/vanish plus undo/redo/reload proof.
