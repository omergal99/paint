# Step 10 — Tests, Types, and Quality

## Goal

Make behavior—not source formatting—the durable regression contract.

## Tasks

- Add direct behavior tests immediately after each Step 09 extraction slice:
  history, resize, palette/alpha, text, storage, EventBus, and DOM journeys.
- Keep shape-layer behavioral coverage and extend it for edge cases, including
  the overlap-safe text gate and alpha-bearing file fixtures.
- Add `jsconfig.json`/`checkJs` and core typedefs incrementally, starting with
  contracts and extracted controllers.
- Add coverage reporting by subsystem and record thresholds rather than one
  misleading project-wide number.
- Remove or reduce brittle regex-only assertions as behavior tests land; retain
  static checks only for architecture invariants that behavior cannot express.

## Verification order

The quality gate runs after every Step 09 slice, then as a complete suite before
Step 11. The first gate now covers the extracted ActionMenuController,
opacity/palette behavior, stable storage display, and safe text focus. A
failing type or behavior gate blocks the next extraction slice.

Round 2 adds contracts for the 32×32/30×16 alpha layout, removed transparent
class, source-over floating placement, Text → Select commit, hidden toolbar,
and nested Image menu wiring. The permanent gap is a direct browser pixel
fixture for selected-shape placement plus `checkJs`, coverage, and teardown
behavior tests.

## Round 3 progress

10.1 is complete for the selected-shape alpha gate. The browser fixture sets
foreground `#a349a4` to 20%, enables Select after draw, observes the floating
layer and eight selection handles, commits once, and matches the expected
source-over pixel `[237,219,237,255]`. Evidence is in
`output/playwright/phase-2/playwright-cli/round3-browser-fixtures.json`.
Transparent PNG/import/export, `checkJs`, subsystem coverage, and negative
teardown/error-path fixtures remain open.

## Done when

CI is green, coverage is measured, and the highest-risk workflows have direct
behavioral tests. Current evidence is `npm test` 4/4, syntax checks,
`git diff --check`, and repeatable headless browser assertions; coverage,
`checkJs`, and negative/error-path fixtures remain open.
