# Normalized Requirements

## P0 — visible workflow fixes

- History/session cards: delete actions, newest-first order, current item first,
  active-tab light-blue state.
- Settings: compact ordered Ribbon settings, better General choices, one close
  path, no redundant General/About close controls.
- Ribbon: aligned group titles, height budget, unified Image More menu.
- Shape menu: internal clicks do not close the gallery; outside click closes.
- Resize: percentage scaling, ratio locked by default, selection is the target
  when selected.

## P1 — editing model and color usability

- Transparent canvas/background and alpha-preserving PNG export.
- Generic browser background removal with tolerance controls.
- Optional advanced Python background removal through an explicit adapter.
- Palette right-click editing, transparent/alpha controls for both colors.
- Text movement after creation, selection-after-draw option, range formatting,
  local text history (5 visible, 30 maximum), right-click edit, reveal mode,
  and an independent T/chevron split button.

## P1 — quality and architecture

- Measure and reduce duplicate event work.
- Improve module boundaries, SSOT, tests, memory/OOM safety, and edge cases.
- Add measured Lighthouse/PWA/SEO/accessibility readiness for domain launch.

## P2 — future workspace

- Prepare and then implement Phase 1 tabs/split/session/recovery work only after
  document, storage, and history boundaries are stable.

