# Phase 3 - Plan overview

| Slice | Status | Goal | Depends on | Evidence gate |
|---|---|---|---|---|
| 3.1 catalog | English + Spanish delivered; expansion remains | Maintain message catalogs, fallback helpers, safe interpolation, and coverage checks | Phase 2 SSOT seams | `tests/i18n.test.js`; later, no missing-key console errors in the integrated UI |
| 3.2 language/RTL | Not integrated | Switch language and `dir` without disturbing canvas coordinates or focus order | 3.1 | LTR/RTL browser matrix at desktop, 320px, and 200% zoom |
| 3.3 notepad core | Foundation delivered; no panel | Provide bounded, local-only note state that a right-panel editor can use | Storage boundary | `tests/notepad-store.test.js`; later, reload/recovery evidence through the UI |
| 3.4 notepad tabs | Store API only; no UI tabs | Add accessible create, rename, switch, delete, and active-tab persistence to the panel | 3.3 | Keyboard tab workflow, empty state, max-tab behavior |
| 3.5 release hardening | Not started | Integrate translations and notes with settings, PWA shell, and quality budgets | 3.1–3.4 and Phase 2 gates | Lighthouse, offline shell, mobile, reduced-motion, and release checklist |

## Recommended order

1. Freeze the Phase 2 release candidate and close its explicit PWA/offline/
   Lighthouse gaps.
2. Wire the delivered catalog into visible markup and a language setting before
   changing locale-dependent UI behavior.
3. Add direction-aware layout primitives and test RTL before translating all
   strings; this catches structural assumptions early.
4. Build the notepad panel around the delivered bounded store, including its
   lifecycle flush and failure-status presentation.
5. Run the combined browser matrix and update release notes.
