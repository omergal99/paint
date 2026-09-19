# Step 06 — Editable Text Layer

## Goal

Turn text into durable editable content rather than one-way raster output.

## Tasks

- Text object store, style runs, z-order, serialization, compositor, hit-test.
- Select-after-draw/move/resize option in Tools More.
- Range formatting toolbar with safe normalized commands.
- Local text history: 5 visible, expand to 30.
- Right-click Edit and temporary reveal-all-editable-text mode.
- Independent T button and chevron settings menu.
- If non-destructive overlap/edit behavior cannot be proven, postpone the full
  text UI and keep the durable document contract as the future boundary.

## Done when

Text can be edited, moved, restored, and exported without duplicating or
destroying neighboring pixels, including after partial paint overlap.
