# Validation skill

Before handoff:

1. Run `node --check` on changed JavaScript modules.
2. Run `npm test`.
3. Run `git diff --check`.
4. Search for stale selectors, native dialogs, missing service-worker assets, and duplicated defaults.
5. Manually exercise changed UI paths when a browser is available, including cancel/Escape and narrow layouts.

Report what was tested and any browser-only behavior that could not be exercised.
