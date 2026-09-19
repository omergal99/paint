# Paint Online — Work 2 / Phase 3

Phase 3 prepares the editor for international users and lightweight side-note
work without destabilizing the Phase 2 canvas, history, menu, and PWA seams.

## Scope

- Localization of the current UI through one English fallback catalog.
- Explicit language and direction state for LTR/RTL layouts.
- A small right-panel notepad with persistent tabs and local recovery.
- Browser evidence at narrow widths, 200% zoom, and both writing directions.

## Guardrails

- Do not scatter translated strings through feature modules.
- Do not infer RTL by reversing canvas coordinates; canvas/image coordinates stay
  LTR-independent while surrounding UI uses logical CSS properties.
- Keep notes local-only, bounded, and recoverable. The first version is not a
  collaborative document editor.
- Complete the remaining Phase 2 PWA/Lighthouse/offline gates before calling
  the Phase 3 features production-ready.

## Documents

- [Plan overview](PLAN-OVERVIEW.md)
- [Detailed plan](PLAN-DETAILS.md)
- [Decisions](DECISIONS.md)
