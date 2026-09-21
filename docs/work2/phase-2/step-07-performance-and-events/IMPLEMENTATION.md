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
- Added the production runtime path: `ToolManager` coalesces pointer frames,
  uses pointer capture with cancel/lost-capture cleanup, and flushes its final
  sample before pointer-up. `ViewportManager` caches geometry and invalidates it
  only when needed.
- Made listener ownership explicit across telemetry, panel layout, action menus,
  PWA installation/update controls, text-selection helpers, history resources,
  and the editor composition root. `destroyEditor()` is invoked on a
  non-persisted pagehide before the EventBus is destroyed.
- Added contract coverage for listener release and status-bar write avoidance.
  The local production-build browser journey verified that an actual pointer
  stroke works before teardown and a later pointer event cannot paint after it.

## Remaining follow-up

The local cleanup proof is complete. Still collect a sustained large-canvas
memory trace and repeat the interaction matrix with touch and stylus hardware;
these are not covered by a localhost mouse journey. The ActionMenuController
seam remains a Step 09 ownership boundary and must retain its behavior and
teardown coverage as it evolves.
