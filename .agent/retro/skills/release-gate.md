---
name: release-gate
version: 1.0.0
description: Run Paint's synchronized release, documentation, runtime, and browser evidence gates.
---

# Paint release gate

Use this skill before a customer release or after a release-facing round.

1. Run `npm run verify:docs` after changing status or evidence files.
2. Run `npm run audit:runtime` after changing event ownership, storage,
   autosave, history, or memory-budget behavior.
3. Run `npm run verify:release`. It checks version synchronization, PWA icons,
   service-worker shell assets, JavaScript syntax, tests, documentation
   consistency, and `git diff --check`.
4. Start a local HTTP server and run a fresh browser journey at 1280px and
   320px. Record 200% visual scale, reduced motion, keyboard Escape/menu
   closure, service-worker control, and Settings → App update status.
5. Run Lighthouse and save both raw JSON and a short summary. Do not turn a
   baseline score into a pass by excluding failing categories; record the
   measured gap and its next owner.

Keep raw Playwright CLI snapshots out of the public boundary. Save only curated
fixtures under `output/playwright/phase-2/playwright-cli/` and quality reports
under `output/quality/`.
