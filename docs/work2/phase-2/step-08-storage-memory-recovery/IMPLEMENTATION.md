# Step 08 Implementation Record

## Delivered in this increment

- Added `js/storage/MemoryBudget.js` to report known history bytes, decoded
  pixels, scratch pixels, and object-URL counts without confusing them with
  browser storage quota.
- Added a 64 MiB byte cap to in-memory HistoryManager undo/redo snapshots while
  retaining the existing 20-entry product limit.
- Added contract tests for byte estimation and the separate-quota report.
- Added `ImageAdmission` limits for dimensions/pixels and applied them before
  resize, load, draw, clipboard, open/import, and drop paths can allocate an
  oversized canvas.
- Migrated working-canvas persistence to canonical, versioned IndexedDB PNG
  `Blob` records with guarded legacy fallback/migration. Corrupt records now
  surface a discard decision, while quota failures surface a recovery-download
  option instead of silently losing the open image.
- Updated history storage to release evicted `Blob` resources and enforce its
  byte guard before costly encoding. The local browser fixture covered a real
  autosave record, oversized admission rejection, corrupt-record recovery, and
  injected quota download recovery.

## Remaining follow-up

The local browser recovery fixtures and UX paths are complete. Still validate
native operating-system quota behavior, sustained large-canvas memory pressure,
and broad device resource release; injected browser errors are not a substitute
for those field conditions. Service-worker asset-list automation is now covered
by the production build rather than being a Step 08 requirement.
