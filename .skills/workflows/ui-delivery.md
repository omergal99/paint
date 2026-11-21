# Feature delivery guide

Use this for UI and application changes across workstreams. It is not tied to
one phase, date, or planning directory.

## Before editing

- Identify the owning module, state source, mirrored controls, and user-visible
  journeys affected by the change.
- Reuse existing infrastructure such as `CheckboxRowController`,
  `SegmentedChoice`, `SliderControl`, `TabBar`, `ActionMenuController`,
  `SettingsStore`, and `SettingsRegistry` where appropriate.
- For new persisted settings, update `DEFAULT_SETTINGS` and
  `SettingsRegistry` with validation; do not create a second owner for state.

## Implementation contracts

- Keep data/state transitions, rendering, and DOM event adapters separate.
- Add user-visible text through `messages.js`, `uiText.js`, and all ready locale
  catalogs; remove obsolete mappings and run `npm run check:i18n`.
- Preserve keyboard, focus, Escape/cancel, narrow layout, and RTL behavior.
- Preserve canvas pixels and undo/history behavior unless explicitly in scope.
- After adding, removing, or renaming JavaScript modules, run
  `npm run sw:sync`; the generated shell must remain consistent.

## Delivery checks

- Run syntax checks for changed JavaScript and focused tests, then `npm test`
  for meaningful application changes.
- Run `npm run verify:docs` for documentation changes and `git diff --check`
  before handoff.
- Use real-browser checks for visible interaction/layout changes; document
  viewport, direction, journey, and evidence.
- Run `npm run audit:runtime` for changes to event ownership, history, storage,
  autosave, or memory budgets. Treat its output as static evidence, not a
  substitute for browser measurements.

Read [the RTL/browser audit](../quality/rtl-browser-audit.md),
[validation guidance](../quality/validation.md), and
[architecture guidance](../engineering/architecture.md) only when their
surfaces are involved.
