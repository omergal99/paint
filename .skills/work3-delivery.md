# Work 3 delivery skill

Use for every Work 3 phase/step (`docs-internal/develop/work3/phase-N/step-MM-*/README.md`).

## Delivery loop (one step at a time)

1. Read the step README + parent `README.md` + `PLAN-DETAILS.md` first.
2. Reuse before adding: `CheckboxRowController`, `SegmentedChoice`,
   `SliderControl`, `TabBar`, `ActionMenuController`, `SettingsStore` +
   `SettingsRegistry`, `RibbonMirror` (Phase 2 step-01 and later).
3. SSOT: mirrors write the same setting/action the ribbon writes; never keep a
   second copy of state. New persisted keys go in `DEFAULT_SETTINGS` +
   `SettingsRegistry` with a validator.
4. i18n: every user-visible string uses `messages.js` + `uiText.js` + all ready
   catalogs; run `npm run check:i18n`.
5. Validate: `node --check` on changed JS, `npm test`, `git diff --check`,
   `npm run verify:docs` after status changes. Browser check per step README
   (LTR/RTL, narrow, Escape/cancel). Tests land in the final pass per owner
   instruction unless the step README names a blocking regression test.

## Hooks (when to use)

- `architecture.md`: new module or cross-module wiring.
- `ui-components.md`: new control/panel/menu/sidebar surface.
- `rtl-browser-audit.md`: layout, direction, positioning, canvas/input change.
- `performance.md`: pointer/canvas/history hot path.
- `validation.md`: before every handoff.
- `seo.md`: metadata/discoverability change.
- `community-standards-audit/SKILL.md`: release/security/contributor surface.

## Sub-agent validation (per owner request)

Before handoff, run three checks (sub-agent or second pass):
1. SSOT/dup check: `grep` new keys/selectors/handlers; exactly one owner.
2. i18n check: `npm run check:i18n` + no raw user-visible English in new DOM.
3. Contract check: `data-tag` stable, `git diff --check`, changed JS parses.
Record the outcome in the step + phase + STATUS status sections.
