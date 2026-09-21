# Localization

Paint keeps locale metadata, catalogs, and DOM application separate so adding a
language does not require changing feature code.

1. Add the normalized BCP-47 key to `SUPPORTED_LOCALES` and `LOCALE_METADATA`
   in `localeRegistry.js`. Set `direction: 'rtl'` for right-to-left locales.
2. Add the catalog to `MESSAGE_CATALOGS` in `messages.js` (or load it through a
   future catalog module), then mark the metadata `status: 'ready'`.
3. Add/adjust `data-i18n` and `data-i18n-attr="attribute:key"` bindings as UI
   surfaces are translated. Run `npm test` to verify required keys and safe
   text-only templates.
4. Keep reusable shell labels in `uiText.js`. Its source-text map lets the
   locale controller translate existing static and feature-created leaf labels
   without duplicating strings. Run `npm run check:i18n` (or `make i18n`) to
   verify every ready catalog, markup reference, and mapped label before review.

For new dynamic copy, import `{ t }` from `messages.js` and use a stable key
(`status.saved`, `status.imageOpened`, etc.) instead of embedding a new English
sentence in a feature module. The locale controller keeps that shared `t()`
locale synchronized when the user changes language.

The reviewed catalog set is English, Spanish, Brazilian Portuguese, French,
German, Arabic (RTL), and Japanese. Locale files inherit the English key shape
and override reviewed translations, so adding a key is safe and visible to the
coverage check. The selected locale is stored under `paint:locale`; a missing
runtime key still falls back to English.
