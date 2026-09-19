# Step 07 Implementation Record

## Delivered in this increment

- Converted `js/core/EventBus.js` from a class to a closure factory with an
  immutable public API and explicit unsubscribe/destroy behavior.
- Converted the low-risk UI/tool controllers (`SegmentedChoice`,
  `ColorPalette`, `ColorInspector`, `StatusBar`, `ZoomTool`, `FillTool`,
  `EyedropperTool`, `SelectTool`, `ShapeTool`, and the Freehand base) to closure factories. The remaining
  class owners and migration order are recorded in `FUNCTIONAL-MIGRATION.md`.
- Added the project architecture rule for functional factories and incremental
  legacy-class migration.
- Converted all standalone named function declarations in `js/`, `tests/`, and
  `scripts/` to arrow constants (`const name = (...) => {}`). Class methods
  remain unchanged until their owning class crosses a tested migration seam.
- Extracted the shared Ribbon action-menu lifecycle into the functional
  `js/ui/ActionMenuController.js` seam. It owns positioning, direction,
  outside-click/Escape close, and `aria-expanded` state for static and dynamic
  menus, including the palette context menu.

## Remaining gate

Pointermove coalescing, cached geometry, telemetry pause/resume, and broad
`paint:*` adoption still require a browser trace and listener teardown audit.
The ActionMenuController extraction is the first Step 09 modularization slice;
the next slices must preserve the same behavior-test and listener-ownership
evidence.
