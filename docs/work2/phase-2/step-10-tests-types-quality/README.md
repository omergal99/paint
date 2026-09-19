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
Step 11. A failing type or behavior gate blocks the next extraction slice.

## Done when

CI is green, coverage is measured, and the highest-risk workflows have direct
behavioral tests.
