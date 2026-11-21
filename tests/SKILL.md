# Local deterministic browser test harness

This harness runs real Chromium browser checks locally without adding a browser
automation package. It uses Node.js 24+, the built-in `node:test` runner and
WebSocket, and an installed Chrome or Chromium binary. Test execution has no AI
dependency and uses loopback-only browser and server connections.

## Run

```bash
npm run test:local
```

This runs the existing Node tests first, then the desktop and mobile-emulated
browser specs. To run only the browser specs:

```bash
node tests/run-local.mjs
```

`npm test` remains the existing CI-safe Node suite. The browser specs are named
`*.browser.mjs`, so they are not included by its current test glob. The GitHub
Actions workflow is unchanged. Failure screenshots are written to the ignored
`output/test-artifacts/failures/` directory; passing runs do not create them.

## Structure and reuse

- `tests/core/` owns generic server-process startup, Chrome discovery and
  lifecycle, the CDP client, viewport and input controls, error collection,
  condition-based waits, and failure screenshots. It must not contain
  Paint-specific selectors or product assumptions.
- `tests/adapters/paint/` owns the Paint server configuration, selectors, app
  readiness, canvas operations, and app-specific checks.
- `tests/specs/` owns browser journeys. Current coverage is desktop app load and
  brush drawing, plus mobile-emulated touch drawing. Add future journeys for
  selection, resizing, history, and other features as their behavior is
  covered.
- `tests/run-local.mjs` composes the Paint server, generic runner, and specs.

To reuse the harness elsewhere, copy `tests/core/`, implement a small adapter
for that project's server, app readiness, and feature operations, then point a
local-suite entry point at the new adapter and specs. Keep project selectors
and assertions out of `core/`; do not copy this project's adapter as generic
infrastructure.

## Reliability rules

- Wait for a concrete app or UI condition rather than a fixed sleep.
- Start each journey with clean origin storage and a known viewport.
- Let uncaught page exceptions and browser console errors fail the run.
- Do not let a browser journey rely on session state left by another journey.
- Keep browser HTTP(S) requests loopback-only unless a spec explicitly declares
  and verifies an external integration dependency.
- Preserve test intent. Never delete or weaken an assertion to make a failure
  disappear; change a test only after an explicit product/spec decision.
- After any fix, rerun the full `npm run test:local` command and verify exit
  code `0`, including desktop and mobile.
- Review failure logs and screenshots, then report the failing journey,
  viewport, root cause, files changed, and full-suite verification.

See the [testing ADR](../docs/adr/testing/ADR-0002-local-deterministic-browser-tests.md)
and the [deterministic test fixer skill](../.agents/skills/deterministic-test-fixer/SKILL.md).

