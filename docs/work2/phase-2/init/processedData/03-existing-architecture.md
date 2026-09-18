# Existing Architecture Summary

## Strengths to preserve

- True image-pixel drawing with CSS zoom rather than re-rasterizing on zoom.
- Separate real canvas and overlay canvas.
- Transparent scratch rendering for select-after-draw shape layers.
- Focused leaf modules for tools, viewport, dialog, and storage.
- Themed DialogService instead of native alert/confirm/prompt.
- Local-first storage and explicit AI provider launcher without collecting keys.
- Local `.skills/` and `AGENTS.md` contract.

## Structural risks to address

- `main.js` owns composition, keyboard, file actions, settings, transforms,
  history export, menus, and drag/drop.
- `Sidebar.js` owns three unrelated panels and calls a private history method.
- storage keys and settings defaults are distributed across modules.
- raw `paint:*` event names have no registry or teardown standard.
- history memory is bounded by count, not bytes.
- text is rasterized too early for the requested editing behavior.
- source-regex tests can pass while behavior is broken and currently fail on
  documentation/style drift.

