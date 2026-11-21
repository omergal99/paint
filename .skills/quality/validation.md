# Validation skill

Before handoff:

1. Run `node --check` on changed JavaScript modules.
2. Run `npm test`.
3. Run `git diff --check`.
4. Search for stale selectors, native dialogs, missing service-worker assets, and duplicated defaults.
5. Manually exercise changed UI paths when a browser is available, including cancel/Escape and narrow layouts.
6. Run `npm run verify:docs` after status or evidence changes and
   `npm run verify:release` before a customer release.
7. Run `npm run audit:runtime` when changing event ownership, history, storage,
   autosave, or memory-budget behavior; report its static limitations separately
   from real-browser measurements.

Report what was tested and any browser-only behavior that could not be exercised.
