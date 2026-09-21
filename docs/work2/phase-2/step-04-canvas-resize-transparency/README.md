# Step 04 - Canvas Resize and Transparency

## Goal

Make resizing predictable and make transparent PNG editing a first-class path.

## Tasks

- Percentage resize with ratio lock enabled by default.
- Resize selected content when a selection exists; otherwise resize canvas.
- Share target/transform logic with rotate and flip.
- Add transparent background mode, checkerboard presentation, and alpha-safe
  PNG save/export.
- Add pixel and PNG fixtures for New, paste, crop, erase, background removal,
  resize, and save; explicitly verify clear alpha is not replaced by white.

## Done when

No selected-area resize changes pixels outside the selection, and transparent
pixels remain transparent after save/reload.
