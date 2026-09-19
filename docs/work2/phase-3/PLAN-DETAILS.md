# Phase 3 — Detailed plan

## 3.1 Localization contract

- Add `js/i18n/messages.js` as the single English catalog, grouped by feature
  (`common`, `ribbon`, `settings`, `history`, `notepad`, `status`).
- Add `createI18n({ locale, catalogs, storage })` with fallback-to-English,
  interpolation, and a stable `t(key, variables)` API.
- Mark static HTML with `data-i18n`, `data-i18n-aria-label`, or
  `data-i18n-title`; dynamic modules request messages by key instead of storing
  translated phrases in state.
- Keep storage keys, event names, CSS class names, and canvas metadata out of
  the translation catalog.
- Add a test that enumerates catalog keys used by markup/modules and fails on a
  missing fallback key.

## 3.2 Language and direction

- Add a language preference to the settings registry with English as the
  fallback and a small initial language list.
- The language service sets `html.lang` and `html.dir` together. Direction is
  derived from locale metadata, not from ad-hoc component checks.
- Convert affected surrounding UI rules to logical properties (`margin-inline`,
  `padding-inline`, `border-inline-start`, `inset-inline-*`). Keep image/canvas
  coordinates and pointer conversion unchanged.
- Audit focus order, menus, submenu opening direction, settings tabs, history,
  resize controls, and sidebar resizer in both directions.
- Test long translated labels, mixed numbers/units, keyboard arrows, and
  screen-reader names at 200% zoom and 320px width.

## 3.3 Notepad right panel

- Add a `createNotepadPanel({ root, store, onChange })` functional seam next to
  the existing Sidebar/HistoryPanel seams.
- The first UI is a right-panel mode with a title, tabs, textarea, add/rename/
  delete actions, and an empty state. It must be reachable without changing
  the canvas tool mode.
- Store notes in a dedicated `STORAGE_KEYS.notepad` record with a schema
  version, active tab id, bounded tab count, bounded note length, and updated
  timestamps. Use safe parse/normalize and preserve valid tabs if one record is
  malformed.
- Persist on a debounced input path and flush on pagehide/visibility change;
  never write every keystroke synchronously for large notes.
- Provide a recovery status when storage is unavailable or quota is exceeded;
  the editor remains usable in memory.

## 3.4 Tabs and future enablement

- Start with a conservative tab cap and make the cap a named limit, not a magic
  number. The first UI can use a fixed default tab and add tabs explicitly.
- Use native buttons with tab semantics, roving focus, Delete confirmation,
  Escape cancellation, and focus restoration after rename/delete.
- Keep note content plain text initially. Defer rich text, attachments,
  cross-device sync, search, and encrypted export until the storage/recovery
  contract is proven.

## 3.5 Acceptance and release

- Verify localization fallback, language persistence, LTR/RTL layout, and
  notepad refresh persistence in Chromium at 1280px and 320px.
- Verify keyboard-only flows, reduced motion, 200% zoom, visible focus, and
  no console errors.
- Add notepad assets to the service-worker shell only after the feature has a
  stable entrypoint and versioned cache invalidation.
- Keep the Phase 2 text overlap gate separate: localization/notepad work must
  not be used as evidence that rasterized text is safely editable.
