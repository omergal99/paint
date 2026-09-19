# Step 09 — Modularization

## Goal

Reduce the blast radius of future features without a framework rewrite.

## Tasks

- Start only after the measurable Step 07 pointer/listener seams and Step 08
  storage/recovery contracts are stable.
- Slice A: extract settings/about and history-panel controllers behind explicit
  read/write contracts without changing DOM behavior.
- Slice B: extract keyboard, file, resize, export, and drag/drop feature
  controllers; keep canvas/history ownership explicit.
- Slice C: add Ribbon action dispatch and public HistoryManager APIs.
- Keep `main.js` as a composition root for wiring, not feature logic, and keep
  `Sidebar.js` focused on panel composition rather than storage/provider work.

## Verification order

Each slice must add or preserve a direct browser/behavior check, run the full
test suite, and record line/listener ownership changes before the next slice.
Do not perform a broad rewrite or combine the Step 09 slices into one change.

## Done when

New settings, actions, and panels can be added through explicit contracts rather
than editing unrelated private fields in the god files.

## Round 2 progress

The first slice is delivered: `ActionMenuController` now supports top-level
and nested menus through one functional seam. Image → More owns Crop, Rotate,
and Flip submenus; ancestor menus remain open while a child opens, while one
document-level outside-click/Escape lifecycle closes all levels. The next
slice is HistoryPanel extraction.

## Round 3 progress

09.1 and 09.2 are now delivered as focused functional seams:
`js/ui/HistoryPanel.js` owns History/Session tab semantics, roving tab index,
and view-aware action labels; `js/ui/SettingsDialog.js` owns settings tab
roles, panel visibility, arrow navigation, and close-focus restoration. The
existing Sidebar/main composition remains compatible while data/rendering
owners stay explicit. Further extraction is gated on teardown and callback
coverage.
