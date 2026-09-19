---
name: paint-architecture
description: Maintain Paint's functional seams, single-source-of-truth constants, and maintainable JavaScript API shapes.
license: MIT
metadata:
  author: paint-project
  version: "1.0"
---

# Paint architecture conventions

Use this skill when changing Paint JavaScript modules, UI seams, state stores,
or cross-feature contracts.

## Contracts

- Prefer closure-based factories that return small frozen APIs for new UI,
  state, and coordination modules. Do not introduce a class when a functional
  seam is sufficient.
- Public functions and cross-module callbacks should accept one destructured
  options object with defaults instead of a positional list. Keep native DOM
  callback signatures and tiny local pure helpers positional when that is
  clearer.
- Put repeated domain strings, storage keys, event names, keyboard keys, and
  valid option values in one named constants object. Import that object rather
  than repeating literals across modules.
- Keep one owner for each state transition. UI adapters may render or forward
  an action, but persistence and layout rules belong to their owning service.
- Preserve browser-visible behavior with a focused unit or browser fixture
  whenever a shared seam changes.

## Safety

- Do not turn metadata into an editable raster layer without overlap, undo,
  reload, and unrelated-pixel proofs.
- Prefer native controls and one shared controller for menus/dialogs/tabs so
  positioning, focus, and teardown behavior cannot drift per instance.
