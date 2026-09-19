# Current Gaps and Next Plan

Processed from the Phase 2 review on 2026-09-19.

## Confirmed implementation decisions

- Transparency below the large foreground/background swatches is Step 05
  Colors and Palette work. Step 04 remains responsible for transparent canvas
  backgrounds, checkerboards, alpha-safe edits, and PNG semantics.
- Step 05 now has the requested Ribbon controls: independent foreground and
  background opacity, explicit `0%` transparent actions, checkerboard swatches,
  persistence, palette-slot context actions, and alpha-aware core drawing
  paths.
- “Select text after draw” is now enabled as a persisted, always-disableable
  non-destructive focus affordance. It selects metadata bounds with a text
  cursor and never rewrites pixels. Full editing/reveal remains gated by a
  real compositor and partial-overlap proof.
- About free space uses raw validated `navigator.storage.estimate()` bytes,
  persists a cache in local storage for a 24-hour window, and displays free
  space from a stable 10,240 MiB budget. Browser memory is tracked separately
  from storage quota.
- The Ribbon settings list uses responsive grid columns and the Text split
  arrow has an explicit 16px width with an outer border and divider.
- Palette context actions and opacity controls now use the shared functional
  `ActionMenuController`; outside click and Escape close behavior is no longer
  implemented as a private palette listener.

## Remaining gates before a full Step 05 score

- Add explicit alpha-bearing fixtures for Open, Paste, Crop, Resize, Save, and
  New, including PNG export assertions.
- Keep `npm test`, syntax checks, and browser evidence green.

## Recommended continuation order

1. Continue the measurable Step 07 pointer/listener gates and the Step 08
   storage recovery gates that Step 09 modularization depends on.
2. Step 09 has started with `ActionMenuController`; continue as small extraction slices: composition-root contracts,
   settings/history panels, then file/resize/export controllers. Add a behavior
   check after each slice.
3. Execute Step 10 immediately after each Step 09 slice: direct behavioral
   tests first, then `checkJs`/typedef coverage and subsystem coverage reports.
4. Execute Step 11 in risk order: accessibility/focus/keyboard journeys,
   PWA/SW and icons, CSS organization, then Lighthouse and repeatable budgets.
5. Keep Step 12 background removal and Step 13 multi-document workspace after
   these launch-quality gates unless a new requirement changes the priority.
