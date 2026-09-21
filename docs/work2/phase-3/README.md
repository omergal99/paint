# Paint Online - Work 2 / Phase 3

Phase 3 prepares the editor for international users and lightweight side-note
work without destabilizing the Phase 2 canvas, history, menu, and PWA seams.

The message catalog now has a visible, persisted language selector with
English, Spanish, Brazilian Portuguese, French, German, Arabic (RTL), and
Japanese catalogs. A bounded local-only `NotepadStore` is also present but not
wired into a visible panel.

## Scope

- Foundation delivered: an English fallback catalog, safe plain-text message
  interpolation, locale fallback/persistence helpers, and catalog coverage
  tests.
- Foundation delivered: bounded local-only note state with tab CRUD,
  normalization/recovery, debounced persistence, and quota/unavailable
  reporting.
- Still to integrate: deeper feature-module sentence migration, RTL layout
  proof, and a visible notepad panel/tabs. The selector, persisted locale
  preference, catalog checker, and `html.lang`/`dir` controller are in place.
- Still to prove: browser evidence at narrow widths, 200% zoom, and both
  writing directions.

## Guardrails

- Do not scatter translated strings through feature modules.
- Do not infer RTL by reversing canvas coordinates; canvas/image coordinates stay
  LTR-independent while surrounding UI uses logical CSS properties.
- Keep notes local-only, bounded, and recoverable. The first version is not a
  collaborative document editor.
- Treat any future planned catalog entry and the note store as seams, not
  user-facing completion: they do not add a notepad panel or tabs by themselves.
- Complete the remaining Phase 2 PWA/Lighthouse/offline gates before calling
  the Phase 3 features production-ready.

## Documents

- [Plan overview](PLAN-OVERVIEW.md)
- [Detailed plan](PLAN-DETAILS.md)
- [Decisions](DECISIONS.md)
