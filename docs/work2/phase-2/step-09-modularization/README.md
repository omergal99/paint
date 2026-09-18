# Step 09 — Modularization

## Goal

Reduce the blast radius of future features without a framework rewrite.

## Tasks

- Extract SettingsStore/HistoryPanel/AiPanel/SettingsDialog.
- Extract keyboard, file, resize, export, and drag/drop feature controllers.
- Add Ribbon action dispatch and public HistoryManager APIs.
- Keep `main.js` as composition root only.

## Done when

New settings, actions, and panels can be added through explicit contracts rather
than editing unrelated private fields in the god files.

