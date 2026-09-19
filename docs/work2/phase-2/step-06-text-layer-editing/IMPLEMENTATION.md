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
- Kept select-after-draw behavior covered by the existing shape-layer tests.

## Safety boundary

This is intentionally not the full editable compositor. Move/edit/hit-test,
range formatting, right-click Edit, reveal mode, and the T/chevron split remain
postponed. The non-negotiable overlap acceptance case is still open: editing a
text object after partial paint overlap must not erase unrelated pixels,
duplicate text, or make the text vanish. The metadata store must not be treated
as proof of that behavior.

## Verification

- `npm test` — all 4 top-level test files passed, including the bounded
  history contract and existing shape-layer/select-after-draw coverage.
- `node --check` — passed for the changed JavaScript modules.
- `git diff --check` — passed.
- Browser smoke — local headless Chrome opened the real Text tool, committed
  one entry, restored it through Recent text, and cleared history while the
  textarea stayed open. No object-editing claim was made by this check.
