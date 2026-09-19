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
| 05 | Implemented with follow-up | RGBA normalization, visible primary/secondary alpha controls, checkerboard swatches, palette-slot context menu, and alpha-aware drawing paths | Complete the broader alpha-bearing Open/Paste/Crop/Resize/Save/New fixture matrix and make the export evidence explicit |
| 06 | Safe slice done | Textarea Recent text history, persistence/restore/clear, max 20 entries, split Text options menu, and the verified shape select-after-draw boundary | Full text-object editing remains deferred until overlap-safe compositor/hit-test proofs exist |
| 07 | Foundation | Functional controller/EventBus seams and performance documentation | Finish pointermove coalescing, cached geometry, telemetry pause/resume, and the broad listener audit |
| 08 | Foundation | Memory-budget report and a 64 MiB in-memory history cap, kept distinct from storage quota | Add Blob/object-URL history, dimension guards, quota recovery, and IndexedDB corruption recovery |

## The requested transparency location

The transparency/opacity control requested beneath the two large foreground and
background swatches belongs to **Step 05 — Colors and Palette**. It is distinct
from **Step 04 — Resize and Canvas Semantics**, which owns transparent canvas
backgrounds, checkerboard display, alpha-safe edits, and PNG behavior.

The `index.html` `ribbon-group ribbon-group-colors` now contains the two
swatches, independent foreground/background opacity sliders, explicit `0%`
transparent actions, the native color picker, and the palette grid. The
palette-slot context menu is keyboard reachable. `ColorPalette` persists the
independent alpha values, and Freehand, Shape, Fill, Text, and Eyedropper now
consume the alpha state. The remaining Step 05 work is the broader alpha-bearing
file/fixture matrix, not the absence of the requested Ribbon control.

## Step 05 remaining gate

Keep the feature verified as one end-to-end RGBA path:

1. Keep the keyboard-reachable alpha/transparent controls associated with each
   large swatch, with a checkerboard/transparent visual state.
2. Keep primary and secondary alpha independent and persist them with the color
   settings.
3. Keep brush, shape, fill, text, eyedropper, and PNG export on the same
   normalized RGBA contract.
4. Add the remaining alpha-bearing Open/Paste/Crop/Resize/Save/New fixtures and
   explicit export assertions before marking Step 05 fully complete.

The control and core application path now exist together; the score remains below
10 until the remaining fixture matrix and export assertions are recorded.

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
