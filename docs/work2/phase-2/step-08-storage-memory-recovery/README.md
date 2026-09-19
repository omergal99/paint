# Step 08 — Storage, Memory, and Recovery

## Goal

Prevent avoidable crashes and silent data loss.

## Tasks

- Byte-bounded Blob/object-URL history with eviction cleanup.
- Track browser memory separately from storage quota, including decoded image
  surfaces, ImageBitmaps, scratch canvases, backing stores, Blobs, object URLs,
  and in-memory undo entries.
- Import/paste dimension limits and visible fallback messaging.
- Quota-exceeded status/dialog with download escape hatch.
- IndexedDB corruption/open recovery.
- Verify and harden Phase 1 #8 compressed thumbs/quota/docId migration.

## Done when

Large-canvas fixtures stay within the chosen memory budget, old records load,
quota failures are visible, and object URLs/decoded resources are released.
