# Steps 01–08 Audit

Last audited: 2026-09-19

This is the current completeness check for the first eight Phase 2 steps. It
separates delivered behavior from foundations and deliberately deferred work so
that a plan item is not treated as complete merely because its data model
exists.

## Status matrix

| Step | Current status | Verified or recorded scope | Important remaining gate |
|---:|---|---|---|
| 01 | Done | Baseline, canonical community standards, safety checks, and green test evidence | Repeat browser/Lighthouse measurements when the relevant UI work is active |
| 02 | Done | Shared constants, document contract, SettingsStore, functional EventBus, and service-worker entries | Continue replacing remaining class-owned seams only when their dependencies are touched |
| 03 | Done | Session/history UX, stable IDs, accessible tabs, settings summaries, Ribbon ordering, shape-gallery propagation, and compact Settings layout | Keep the multi-layout Ribbon measurement matrix in the later quality gate |
| 04 | Done with follow-up | Resize percentage/ratio/selection behavior and transparent canvas/checkerboard foundations | Complete Open/Paste/Crop/Save/New alpha round trips and broader transparency regression tests |
| 05 | Foundation; requested Ribbon control is not implemented yet | RGBA normalization and legacy-compatible alpha persistence in `ColorPalette` | Add the visible alpha/transparent control, apply alpha in drawing/composition, and prove it with pixel/export tests |
| 06 | Safe slice done | Textarea Recent text history, persistence/restore/clear, max 20 entries, split Text options menu, and the verified shape select-after-draw boundary | Full text-object editing remains deferred until overlap-safe compositor/hit-test proofs exist |
| 07 | Foundation | Functional controller/EventBus seams and performance documentation | Finish pointermove coalescing, cached geometry, telemetry pause/resume, and the broad listener audit |
| 08 | Foundation | Memory-budget report and a 64 MiB in-memory history cap, kept distinct from storage quota | Add Blob/object-URL history, dimension guards, quota recovery, and IndexedDB corruption recovery |

## The requested transparency location

The transparency/opacity control requested beneath the two large foreground and
background swatches belongs to **Step 05 — Colors and Palette**. It is distinct
from **Step 04 — Resize and Canvas Semantics**, which owns transparent canvas
backgrounds, checkerboard display, alpha-safe edits, and PNG behavior.

The current `index.html` `ribbon-group ribbon-group-colors` contains the two
swatches, the native color picker, and the palette grid, but no visible alpha
slider/toggle or transparent swatch affordance. `ColorPalette` currently
persists independent alpha values as groundwork; the Freehand, Shape, Fill, and
Text raster paths still use opaque hex-only styles in the relevant drawing
operations. Therefore the Ribbon transparency feature must not be reported as
delivered yet.

## Step 05 next gate

Implement and verify the feature as one end-to-end RGBA path:

1. Add keyboard-reachable alpha/transparent controls associated with each large
   swatch, with a checkerboard/transparent visual state.
2. Keep primary and secondary alpha independent and persist them with the color
   settings.
3. Route brush, shape, fill, text, eyedropper, and PNG export through the same
   normalized RGBA contract.
4. Add DOM/keyboard, persistence, pixel, and export tests before marking Step
   05 complete.

No Step 05 completion claim should be made until the control, application path,
and tests all exist together.

## Important open items carried forward

- Text compositing remains intentionally deferred. Any future text-object
  editing must prove that partial overlap does not erase unrelated pixels,
  duplicate text, or make text vanish; undo/redo and reload belong in that gate.
- Browser memory budgeting is separate from storage quota and still needs
  runtime measurement and recovery coverage.
- Ribbon height and layout variants need a measured matrix for top, left, bottom,
  and floating layouts.
- Service-worker asset-list automation is useful but intentionally deferred;
  it is not a blocker for the current Steps 01–08 slice.
- Canvas transparency semantics need dedicated regression fixtures whenever the
  Step 04 alpha round-trip work resumes.
- The optional Python background-removal route remains Step 12 work. The plan
  keeps the default app lightweight and local-first, with a lazy provider
  boundary rather than making Python part of the main app bundle.

