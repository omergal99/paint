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
- “Select text after draw” is still required but intentionally disabled. It may
  be enabled only after a real text-object compositor and hit-test path proves
  safe partial-overlap editing. The future design needs a dedicated focus/edit
  cursor and a reveal mode, not only the regular pointer.
- About free space uses raw validated `navigator.storage.estimate()` bytes,
  persists a cache in local storage for a 24-hour window, and computes
  `max(0, quota - usage)`. Browser memory is tracked separately from storage
  quota.
- The Ribbon settings list uses responsive grid columns and the Text split
  arrow has an explicit 16px width with an outer border and divider.

## Remaining gates before a full Step 05 score

- Add explicit alpha-bearing fixtures for Open, Paste, Crop, Resize, Save, and
  New, including PNG export assertions.
- Keep `npm test`, syntax checks, and browser evidence green.

## Recommended continuation order

1. Close the measurable Step 07 pointer/listener gates and the Step 08 storage
   recovery gates that Step 09 modularization depends on.
2. Execute Step 09 as small extraction slices: composition-root contracts,
   settings/history panels, then file/resize/export controllers. Add a behavior
   check after each slice.
3. Execute Step 10 immediately after each Step 09 slice: direct behavioral
   tests first, then `checkJs`/typedef coverage and subsystem coverage reports.
4. Execute Step 11 in risk order: accessibility/focus/keyboard journeys,
   PWA/SW and icons, CSS organization, then Lighthouse and repeatable budgets.
5. Keep Step 12 background removal and Step 13 multi-document workspace after
   these launch-quality gates unless a new requirement changes the priority.

