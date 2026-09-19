# Phase 2 — Current Status and UI Checks

Last updated: 2026-09-19

This is the short, updateable handoff for what is usable now, what is only a
foundation, and how to experience each delivered improvement in Paint. The
detailed evidence remains in each step workspace and `PROGRESS-LOG.md`.

## Status at a glance

| Step | Status | Score* | What is available now | Measurement / verification | Missing points / next gate | Quick UI/check path |
|---:|---|:---:|---|---|---|---|
| 01 | Done | 9/10 | Baseline, standards, and release safety evidence | `npm test` 4/4; baseline and `git diff --check` recorded | Community-standards traceability and release checklist can be more explicit | Run `npm test`; no separate feature surface |
| 02 | Done | 8/10 | Shared contracts, settings persistence, functional EventBus | Contract tests plus Settings reload check; remaining legacy owners are inventoried | Finish remaining legacy class/event owners and teardown assertions | Open Settings, change a preference, reload, and confirm it persists |
| 03 | Done | 8/10 | History/session UX, settings summaries, Ribbon/menu behavior, compact Settings layout | Smoke tests plus 1280px browser evidence; alternate Ribbon matrix remains | Complete alternate-layout browser matrix and keyboard menu audit | Open Settings and History; inspect Current-first history, two-column General choices, and the grid Ribbon tab |
| 04 | Done with follow-up | 8/10 | Resize percentage/ratio/selection behavior and transparent canvas foundation | `transparency.test.js` plus browser checkerboard check; file round trips remain | Add transparent PNG/import/export and resize regression fixtures | Open Resize; try 50% with ratio lock; choose General → Transparent and inspect the checkerboard viewport |
| 05 | Stabilized with follow-up | 9/10 | Compact checkerboard opacity menu, visible palette context menu, shared outside-click lifecycle, persisted alpha, and alpha-aware drawing paths | `npm test` 4/4; two headless browser passes; shape alpha carry-over and storage display verified | Broaden file/import/eyedropper alpha fixtures and add a final palette keyboard matrix | Open Colors: click the checkerboard/arrow, adjust FG/BG, right-click a palette slot, click outside, then draw and inspect the swatch/pixel result |
| 06 | Safe slice done; text-object selection gated | 7/10 | Textarea Recent text history, restore/clear, max 20; split Text options menu; shape select-after-draw remains tested | Store/shape/smoke tests plus browser history restore and live toolbar toggle; overlap-safe text proof is still required | Choose Text, open its arrow, type text, blur to commit, restore from Recent text; text “Select after draw” stays disabled until the proof gate |
| 07 | Foundation | 4/10 | Functional seams and EventBus groundwork | Static listener inventory and contract tests; repeatable pointer trace, coalescing, and teardown measurements are still missing | No new visible performance claim yet; browser trace and listener audit remain |
| 08 | Foundation | 4/10 | Memory-budget report and 64 MiB in-memory history cap | Memory contract tests; browser Blob/object-URL, quota-error, and IndexedDB recovery fixtures remain | Open About to see cached storage quota separately from memory; recovery flows are not complete |
| 09 | Planned; re-sequenced | 0/10 | Incremental `main.js`/`Sidebar.js` modularization | Not measured yet; begins after Step 07 listener seams and Step 08 recovery contracts are locked | Not available yet |
| 10 | Planned; follows Step 09 slices | 0/10 | Behavioral tests, `checkJs`, coverage, and quality gates | Not measured yet; each Step 09 slice must add its behavior gate | Not available yet |
| 11 | Planned; follows Step 10 gates | 0/10 | PWA, accessibility, CSS organization, and Lighthouse matrix | Not measured yet; use representative editor journeys and all Ribbon layouts | Not available yet |
| 12 | Planned | 0/10 | Optional lazy background-removal provider | Not available yet | Not available yet |
| 13 | Planned | 0/10 | Tabs, split panes, session/recovery | Not available yet | Not available yet |

\* Score is a current completion/evidence score out of 10, not a subjective
product-quality rating. A score cannot reach 10 until the step’s acceptance
behavior and its relevant browser or contract evidence are both complete.

## Current safety notes

- Text is still rasterized on commit. The metadata `TextDocumentStore` is a
  future ownership boundary, not proof that text objects can be edited safely.
- Text-object compositor, hit-testing, move/resize/edit-after-blur, range
  formatting, right-click Edit, reveal mode, and the text select-after-draw
  behavior remain deferred.
- Before enabling those features, tests must prove that editing after partial
  paint overlap does not erase unrelated pixels, duplicate text, or make text
  vanish; undo/redo and reload must be included.
- The requested transparency/opacity control inside the Ribbon Colors group is
  Step 05 work, not Step 04 canvas-background work. The control and core alpha
  drawing path are now implemented; Step 05 still has broader file/fixture
  follow-up before its score can reach 10.
- “Select text after draw” is intentionally tracked in Step 06. The checkbox
  must remain disabled until text hit-testing/compositing proves safe editing
  after partial overlap; its future cursor/reveal affordance is recorded in the
  Step 06 plan.
- About storage uses the browser estimate API once per 24-hour cache window,
  stores raw validated bytes in local storage, and calculates free space as
  `max(0, quota - usage)` before formatting. Browser memory remains a separate
  budget.
- The full Steps 01–08 completeness audit is recorded in
  [`STEP-01-08-AUDIT.md`](STEP-01-08-AUDIT.md).

## Updating this file

After each meaningful step, update only the affected row, add the shortest
working UI path, and link detailed evidence from that step's `IMPLEMENTATION.md`.
