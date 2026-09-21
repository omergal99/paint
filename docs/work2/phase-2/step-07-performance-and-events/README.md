# Step 07 - Performance and Event Hygiene

## Goal

Reduce hot-path work and make listener lifetime explicit.

## Delivered locally

- One pointermove/rAF pipeline with coalesced pointer samples and cached viewport
  geometry.
- Pointer capture with a safe fallback, plus pointer-cancel and lost-capture
  cleanup.
- Explicit `destroy()` ownership for the EventBus, ToolManager, viewport,
  telemetry, panel/menu/PWA controllers, and the editor composition root.
- Visibility-aware telemetry pause/resume, and event handlers held by name so
  they can be removed deterministically.
- Existing delegated Ribbon/menu behavior retained behind the shared controller.

## Local browser evidence - 2026-09-20

The local production build was served in Chrome 151. A real Brush stroke
persisted normally; after a non-persisted `pagehide`, a later pointer input did
not draw. The journey recorded zero console errors. This checks both the normal
pointer path and the explicit teardown boundary instead of relying on a static
listener census alone.

`npm run audit:runtime` also verifies the pointer/frame, cached-viewport,
telemetry, and editor-teardown contracts. See [production-build browser
evidence](../../../../output/playwright/phase-2/local-audit-20260920/production-build-runtime.json)
and [the runtime audit](../../../../output/quality/step-07-08-runtime-audit.json).

Repeated destroy/recreate, touch/stylus stress, and a sustained large-canvas
memory-growth trace remain open. They are device/long-run follow-up, not a
reason to claim that the local teardown check has failed.

## Done when

The local runtime/teardown gate is complete. Close the remaining follow-up only
after repeat pointer/touch/stylus and memory measurements show no regression.
