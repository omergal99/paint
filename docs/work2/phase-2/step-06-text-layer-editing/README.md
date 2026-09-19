# Step 06 — Safe Text Entry History

## Goal

Deliver the highest-impact text workflow improvements without claiming that
rasterized text is already a safely editable layer.

## Tasks

- Keep and verify the existing select-after-draw behavior for shape-like
  objects, with the layer tests as its safety boundary.
- Add recent text history to the active textarea: restore a previous entry,
  clear it, de-duplicate it, persist it locally, and cap storage at 20 entries.
- Keep the history UI small and local to the textarea so it does not imply that
  committed raster text can be moved or edited as an object.
- Preserve the current raster commit path and the metadata-only
  `TextDocumentStore` boundary.
- Defer the compositor, text hit-test, move/resize/edit-after-blur, range
  formatting, right-click Edit, reveal mode, and T/chevron split until the
  overlap proof is strong enough.

## Done when

Select-after-draw remains covered by its existing layer tests, and the textarea
can restore and clear recent text safely within the 20-entry bound. The raster
commit behavior is unchanged. Full text-object editing is not considered done
until editing after partial paint overlap can prove that unrelated pixels are
not erased, text is not duplicated, and text does not vanish.
