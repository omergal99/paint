# Phase 3 — Plan overview

| Slice | Goal | Depends on | Evidence gate |
|---|---|---|---|
| 3.1 catalog | Replace raw user-facing strings with a typed message catalog and English fallback | Phase 2 SSOT seams | Catalog coverage check; no missing-key console errors |
| 3.2 language/RTL | Switch language and `dir` without disturbing canvas coordinates or focus order | 3.1 | LTR/RTL browser matrix at desktop, 320px, and 200% zoom |
| 3.3 notepad core | Add a right-panel note editor that survives refresh | Sidebar seam, storage keys | Reload/recovery test, bounded payload, no data loss on malformed storage |
| 3.4 notepad tabs | Add create, rename, switch, delete, and active-tab persistence | 3.3 | Keyboard tab workflow, empty state, max-tab behavior |
| 3.5 release hardening | Integrate translations and notes with settings, PWA shell, and quality budgets | 3.1–3.4 and Phase 2 gates | Lighthouse, offline shell, mobile, reduced-motion, and release checklist |

## Recommended order

1. Freeze the Phase 2 release candidate and close its explicit PWA/offline/
   Lighthouse gaps.
2. Build the catalog and language service before changing visible markup.
3. Add direction-aware layout primitives and test RTL before translating all
   strings; this catches structural assumptions early.
4. Add the notepad behind a small functional panel seam and bounded storage
   contract.
5. Run the combined browser matrix and update release notes.
