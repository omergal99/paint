# Step 03 Implementation Record

## Delivered

- Session history renders the live current card first, then newest snapshots,
  with stable IDs and matching delete/hide actions.
- Added public `HistoryManager.restore`, `removeSessionEntry`, and
  `persistSession` APIs; Sidebar no longer restores through `_restore` or
  persists through a private method.
- History and Session tabs now expose `aria-selected`; active tabs use the
  light-blue active treatment and visible focus styling.
- Removed the General-panel cancel button and About-panel close button; header
  and footer close paths remain.
- General settings now use the shared compact choice summaries for background,
  default canvas size, and initial zoom while retaining native selects.
- Added stable `RIBBON_GROUP_ORDER` for Ribbon settings rendering.
- Shape-gallery click propagation is stopped so selecting a shape/fill control
  does not close the gallery.
- Ribbon control/title bands now have explicit measured target variables; the
  target remains subject to checks in all layouts.

## Browser evidence

Using the installed local Playwright CLI against `http://127.0.0.1:4173/`:

- General settings showed selected summaries and only header/footer close paths.
- History showed selected History/Session tabs with ARIA selected state.
- Session showed `Current` first with a `Hide current session image` action.
- Shape gallery remained open after selecting `Line`.
- Browser console reported 0 warnings and 0 errors.
- Screenshot: `output/playwright/phase-2/settings-general.png`.
- Raw Playwright snapshots: `output/playwright/phase-2/playwright-cli/`.

## Verification

- Node test suite and syntax checks pass after implementation.
- Browser checks are evidence for the tested 1280px-class viewport only; the
  Step 11 layout matrix still covers narrow, side, bottom, and floating modes.
