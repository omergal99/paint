# Phase 3 - Detailed plan

## 3.1 Localization contract - foundation delivered

- `js/i18n/messages.js` now contains the single English catalog, grouped by
  `common`, `ribbon`, `settings`, `history`, `notepad`, and `status`.
- `createI18n({ locale, catalogs, storage })` supplies normalized locale
  fallback, safe plain-text interpolation, persistence helpers, and a stable
  `t(key, variables)` API. The standalone `t` intentionally remains English
  until application wiring exists.
- `REQUIRED_MESSAGE_KEYS` and `tests/i18n.test.js` cover declared keys,
  fallback behavior, interpolation, and accidental HTML in message templates.
- Storage keys, event names, CSS class names, and canvas metadata remain out of
  the translation catalog.

Still required for this slice to be user-visible:

- Mark static HTML with `data-i18n`, `data-i18n-aria-label`, or
  `data-i18n-title`, and migrate dynamic modules to request message keys.
- Add a real language preference control and connect it to rendering. There is
  currently no UI language switch and no translated application surface.

## 3.2 Language and direction - integration not started

- The catalog can retain a selected locale, but it does not currently set
  `html.lang` or `html.dir`; there is no language setting in the editor.
- No RTL layout conversion, direction metadata, focus-order audit, or LTR/RTL
  browser matrix has been completed.
- The integration must set `html.lang` and `html.dir` together, deriving
  direction from locale metadata rather than component-specific checks.
- Convert affected surrounding UI rules to logical properties (`margin-inline`,
  `padding-inline`, `border-inline-start`, `inset-inline-*`). Keep image/canvas
  coordinates and pointer conversion unchanged.
- Audit focus order, menus, submenu opening direction, settings tabs, history,
  resize controls, and sidebar resizer in both directions; test long labels,
  mixed numbers/units, keyboard arrows, and screen-reader names at 200% zoom
  and 320px width.

## 3.3 Notepad state contract - foundation delivered

- `js/notepad/NotepadStore.js` provides a local-only, plain-text schema-v1
  record with active-tab state, timestamps, a maximum of eight tabs, bounded
  title/text/record sizes, and named error/persistence states.
- `normalizeNotepadRecord` salvages valid individual tabs from damaged data
  without overwriting recovery data during load. `createNotepadStore` exposes
  in-memory create, rename, switch, delete, and text-edit operations.
- Writes are debounced and `flush()`/`dispose()` make persistence explicit.
  Quota and unavailable storage leave the current in-memory notes usable and
  report a structured failure. The store intentionally owns no DOM, page
  lifecycle listener, language strings, or service-worker wiring.
- `tests/notepad-store.test.js` covers normalization, bounds, CRUD, debounced
  persistence, quota/unavailable failures, and disposal.

Still required for this slice to be user-visible:

- Add `createNotepadPanel({ root, store, onChange })` beside the existing
  Sidebar/HistoryPanel seams, with a title, textarea, actions, and empty state.
- Have the application call `flush()` on pagehide/visibility change and present
  storage/recovery status. There is no notepad panel or tabs in the UI today.
- Decide and wire the final settings/storage registry integration before adding
  the feature to the service-worker shell.

## 3.4 Tabs and future enablement - UI not started

- The store already has a named conservative tab cap and active-tab persistence
  APIs, but these are not rendered as tabs or exposed through controls.
- Build native controls with tab semantics, roving focus, Delete confirmation,
  Escape cancellation, and focus restoration after rename/delete.
- Keep note content plain text initially. Defer rich text, attachments,
  cross-device sync, search, and encrypted export until the storage/recovery
  contract is proven.

## 3.5 Acceptance and release - pending integration

- Unit coverage proves the catalog and store contracts only. It is not browser
  evidence for localization, RTL, a notepad panel, or PWA availability.
- Verify localization fallback, language persistence, LTR/RTL layout, and
  notepad refresh persistence in Chromium at 1280px and 320px once integrated.
- Verify keyboard-only flows, reduced motion, 200% zoom, visible focus, and
  no console errors.
- Add notepad assets to the service-worker shell only after the feature has a
  stable entrypoint and versioned cache invalidation.
- Keep the Phase 2 text overlap gate separate: localization/notepad work must
  not be used as evidence that rasterized text is safely editable.
