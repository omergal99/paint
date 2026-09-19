# Decisions and Open Choices

## Recorded decisions

1. Phase 2 planning is complete enough to begin implementation; Steps 01–04
   are now the active implementation scope.
2. Phase 1's current code is evidence, not proof. The current test run is the
   source of truth for the baseline.
3. Multi-tab/split (#7) stays last, but its document/storage contracts are
   prepared earlier.
4. Quota/thumbs (#8) is treated as partially implemented and moved into early
   storage hardening rather than rebuilt blindly.
5. Text editing must use a durable object/layer model; a coordinate cache over
   rasterized pixels is rejected as the primary design.
6. Text compositing may be postponed if overlap, selection, and edit behavior
   cannot be proven without damaging unrelated pixels.
7. Step 06 currently ships only textarea recent-text history and the verified
   select-after-draw slice; text-object editing stays behind the overlap proof
   until dedicated tests cover partial paint overlap, undo/redo, and reload.
8. Browser memory is a separate budget from storage quota and must be measured
   for decoded images, scratch surfaces, Blobs, object URLs, and undo entries.
9. Service-worker asset-list synchronization is deferred maintenance for Step
   11, not a blocker for the first PWA/accessibility pass.

## Owner decisions required before implementation

| Decision | Options | Recommendation |
|---|---|---|
| Default new canvas | Solid white or transparent | Keep current solid default for compatibility; add explicit transparent mode and make it user-selectable. |
| Palette right-click | Preserve secondary-color shortcut or open editor | Open editor; provide an explicit “set as secondary” action to remove ambiguity. |
| Text persistence | localStorage metadata or IndexedDB document record | IndexedDB for document text objects; localStorage only for the 20-entry text clipboard/history. |
| Advanced background removal | Pyodide/WebAssembly in browser, optional local Python service, or remote API | Optional lazy provider behind a dynamic import and Worker; self-host/version assets, do not inflate the default bundle or upload images silently. Keep the JS fallback and postpone Python if budgets fail. |
| Lighthouse target | 90+ all categories or category-specific targets | Use 90+ as the initial launch gate after a real baseline; document editor-specific exceptions. |
| Current session card deletion | Allow hiding synthetic current card, or mark it non-deletable | Prefer stable `kind` semantics: delete saved/session snapshots; current is a live preview and is clearly marked. Revisit after UI review. |

## Low-priority maintenance decisions

- The canonical community standards file is `docs/work1/COMMUNITY_STANDARDS.md`.
  README and smoke-test references are corrected in Step 01; stale path drift is
  not treated as a product blocker after the correction.

## Missing historical input

The request references `paint/docs/w2/PLAN-OVERVIEW.html`, but that file is not
present. The available `paint/docs/work2/phase-1/PLAN-OVERVIEW.md` identifies
the relevant deferred work as tabs/split (#7) and quota/thumbs (#8), so those
are the items carried into this plan.
