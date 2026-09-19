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
- Added independent foreground/background opacity sliders and explicit `0%`
  transparent actions beneath the Ribbon swatches, with checkerboard swatch
  rendering and local persistence.
- Added a keyboard-reachable palette-slot context menu with Edit, Set as
  foreground, Set as background, and Reset slot actions.
- Routed alpha through Freehand, Shape, Fill, Text, and Eyedropper operations;
  the canvas remains the PNG/export source of truth.

## Remaining gate

The browser evidence now confirms the controls, persistence, palette context
menu, and a real non-opaque drawing pixel. Step 05 still needs explicit
alpha-bearing Open/Paste/Crop/Resize/Save/New fixtures and export assertions
before the full acceptance gate is closed.

Browser verification at 1280×900 recorded: alpha controls present, primary alpha
persisted, checkerboard swatch visible, arrow width 16px, split borders visible,
text toolbar hid live, palette menu received focus, Ribbon settings used two
columns, storage free-space text was available, and the drawn pixel measured
alpha `26/255` on a transparent canvas. A follow-up layout check confirmed the
Ribbon remained exactly `74px` high while the alpha controls stayed visible.
