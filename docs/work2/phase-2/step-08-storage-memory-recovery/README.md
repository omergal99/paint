# Step 08 - Storage, Memory, and Recovery

## Goal

Prevent avoidable crashes and silent data loss.

## Delivered locally

- Byte-bounded `Blob`/object-URL history with eviction cleanup.
- Browser memory remains separate from storage quota, including decoded image
  surfaces, ImageBitmaps, scratch canvases, backing stores, Blobs, object URLs,
  and in-memory undo entries.
- Import, paste, resize, and canvas-load dimension/pixel admission limits with
  visible fallback messaging.
- Quota-exceeded status/dialog with a recovery-download escape hatch.
- IndexedDB working-canvas records as versioned PNG `Blob` data, including
  corrupt/open recovery decisions and legacy migration.

## Local browser evidence - 2026-09-20

The local browser recovery journey verified all of the following without a
console error:

- A real drawing created a versioned PNG `Blob` working-canvas record in
  IndexedDB.
- A 5000 × 7000 canvas request was rejected before allocation and left the
  existing 800 × 600 image intact.
- A seeded malformed autosave prompted an explicit discard choice; it was not
  silently removed before the user confirmed.
- An injected IndexedDB `QuotaExceededError` showed the recovery dialog, and
  the “Download now” path saved a PNG while editing could otherwise continue.

The runtime audit still records the 64 MiB history limit, 33,554,432 decoded
pixel limit, 16,777,216 scratch-pixel limit, and resource-cleanup contracts.
See [production-build browser evidence](../../../../output/playwright/phase-2/local-audit-20260920/production-build-runtime.json)
and [the runtime audit](../../../../output/quality/step-07-08-runtime-audit.json).

These are controlled localhost fixtures. Native quota behavior, sustained
large-image memory pressure, and device-specific resource release still need
real-device validation.

## Done when

The local recovery gate is complete: records are versioned, oversized images
are rejected, quota failures are visible, and object URLs/decoded resources
have explicit cleanup paths. The remaining device-memory and native-quota work
is a launch follow-up.
