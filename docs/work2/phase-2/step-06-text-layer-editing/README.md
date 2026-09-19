# Step 06 — Safe Text Entry History

## Goal

Deliver the highest-impact text workflow improvements without claiming that
rasterized text is already a safely editable layer.

## Tasks

- Keep and verify the existing select-after-draw behavior for shape-like
  objects, with the layer tests as its safety boundary.
- Provide an opt-in, always-disableable text select-after-draw affordance.
  Selection is a metadata-bound focus target only; it must not imply that
  raster text is safely editable.
- Add recent text history to the active textarea: restore a previous entry,
  clear it, de-duplicate it, persist it locally, and cap storage at 20 entries.
- Keep the history UI small and local to the textarea so it does not imply that
  committed raster text can be moved or edited as an object.
- Preserve the current raster commit path and the metadata-only
  `TextDocumentStore` boundary.
- Defer the compositor, move/resize/edit-after-blur, range formatting,
  right-click Edit, and reveal-mode editing until the overlap proof is strong
  enough. Text hit-testing is limited to a non-destructive focus overlay.

## Future enablement checklist

“Select text after draw” is now an enabled, persisted option. When checked, the
committed metadata bounds receive a dedicated focus target/cursor. Clicking a
target selects it without rewriting the raster. The option can always be
turned off from the Text options menu. Editing existing text remains deferred
until the overlap-safe compositor proof passes.

## Done when

Select-after-draw remains covered by its existing layer tests, the text focus
target is covered by browser verification, and the textarea can restore and
clear recent text safely within the 20-entry bound. The raster commit behavior
is unchanged. Full text-object editing is not considered done until editing
after partial paint overlap can prove that unrelated pixels are not erased,
text is not duplicated, and text does not vanish.
