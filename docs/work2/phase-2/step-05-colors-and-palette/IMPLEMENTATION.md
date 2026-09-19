# Step 05 Implementation Record

## Delivered in this increment

- Added `js/utils/colorContract.js` with normalized RGBA values, CSS output,
  hex compatibility, and validation helpers.
- Reworked `ColorPalette` into a closure factory that migrates legacy hex
  records and persists independent primary/secondary alpha values for the
  upcoming alpha controls.
- The contract accepts the existing hex-only palette representation, so the
  later palette migration can add alpha without invalidating current saved
  colors.
- Added contract coverage for normalization and alpha-preserving CSS output.
- Added a compact checkerboard transparency icon with a down-arrow action menu;
  it contains independent foreground/background opacity sliders and explicit
  `0%` transparent actions while keeping the Colors group within the 74px
  Ribbon target. Checkerboard swatch rendering and local persistence remain.
- Added a keyboard-reachable palette-slot context menu with Edit, Set as
  foreground, Set as background, and Reset slot actions. It uses the shared
  functional ActionMenuController, has an opaque Ribbon-surface background,
  and closes on outside click or Escape.
- Routed alpha through Freehand, Shape, Fill, Text, and Eyedropper operations;
  the canvas remains the PNG/export source of truth.

## Remaining gate

The browser evidence now confirms the opacity popover/icon, persistence,
palette context menu open/close behavior, shape alpha carry-over, stable
storage display, and a real non-opaque drawing pixel. Step 05 still needs explicit
alpha-bearing Open/Paste/Crop/Resize/Save/New fixtures and export assertions
before the full acceptance gate is closed.

Browser verification at 1280×900 recorded: the opacity icon/popover present,
primary alpha persisted, checkerboard swatch visible, palette menu received
focus and closed outside, arrow width 16px, split borders visible, text toolbar
hid live, Ribbon settings used two columns, storage free-space text used the
stable quota, and the drawn pixel measured alpha `26/255` on a transparent
canvas. A follow-up layout check confirmed the Ribbon remained exactly `74px`
high with the compact opacity affordance.

## Round 2 stabilization

- The checkerboard trigger is now explicitly horizontal at `30px × 16px`; the
  swatch stack is `32px × 32px`.
- The obsolete `swatch-alpha-transparent` class was removed; transparent
  actions use the shared opacity data attribute and menu styling.
- Shape select-after-draw placement now commits the already-alpha-bearing
  floating layer with `globalAlpha = 1` and `source-over`, preventing a 20%
  shape from becoming 4% when it is placed.
- `transparency.test.js` now records the actual alpha/composite values used by
  the source-over commit helper and verifies the caller context is restored.
- The remaining browser gate is a direct pixel-ratio fixture for the complete
  lift and placement journey, in addition to the broader file/import/export
  fixtures.
