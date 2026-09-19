# Step 04 Implementation Record

## Delivered

- Resize dialog now targets the whole canvas or active selection explicitly.
- Added percentage scaling relative to the selected target; Maintain aspect
  ratio defaults to checked and updates both dimensions without a feedback loop.
- Selection resize lifts only the selected pixels, scales the floating layer,
  preserves unrelated canvas pixels, and expands the canvas only when needed.
- Added explicit transparent background mode. Transparent clear/fill/resize
  paths use `clearRect`; the viewport uses a checkerboard presentation layer,
  while solid mode remains the compatibility default.
- Added pixel-level fake-canvas coverage for transparent fill/clear behavior.

## Browser evidence

- Resize dialog opened with 800×600, Scale 100%, Whole canvas, and ratio lock
  checked.
- Filling Scale with 50% updated the dialog to 400×300.
- Selecting the General > Transparent choice updated the selected summary to
  `Transparent` and the viewport class to `canvas-viewport bg-transparent`.
- No browser console warnings or errors were reported.

## Verification and limits

- `npm test`, changed-file `node --check`, and `git diff --check` pass.
- Open/Paste/Crop/Save/New alpha-bearing fixtures remain a Step 04/10 follow-up;
  the current automated test covers the clear/fill pixel contract, not a full
  image-file round trip.
