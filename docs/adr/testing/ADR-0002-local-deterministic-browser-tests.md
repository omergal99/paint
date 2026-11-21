# ADR-0002: Portable deterministic local browser tests

## Status

Accepted

## Context

Contributors need repeatable browser checks before sharing changes, including
real desktop and mobile-emulated interaction. Test execution must be
deterministic, local, lightweight, and independent of AI. The same generic
browser-control logic should be reusable in other projects without carrying
Paint-specific selectors or behavior into it.

Adding a browser automation framework would introduce a separate dependency
tree and maintenance surface. The project already targets Node.js 24, whose
built-in test runner and WebSocket API can control an installed Chrome or
Chromium browser through the Chrome DevTools Protocol (CDP).

## Decision

- Use Node's built-in `node:test` and WebSocket APIs to control a local Chrome
  or Chromium instance over CDP. Do not add Cypress, Playwright, or another
  browser-automation npm dependency.
- Keep generic process, browser lifecycle, CDP, viewport, input, error capture,
  and failure-screenshot logic in `tests/core/`.
- Keep Paint-specific server setup, selectors, canvas checks, and user journeys
  in `tests/adapters/paint/` and `tests/specs/`.
- Run the existing Node suite and the local desktop/mobile browser suite with
  `npm run test:local`. The browser specs use `.browser.mjs` names so the
  existing `npm test` command and GitHub Actions workflow remain unchanged.
- Capture browser screenshots only for failed cases, under ignored `output/`.
- Keep test execution free of AI. AI may help diagnose and fix a regression,
  but must not delete or weaken a test to hide a failure, and must rerun the
  complete local suite after a fix.

## Consequences

### Benefits

- No additional browser-test npm dependencies or framework update/CVE burden.
- Direct control and clear ownership of browser setup, failure evidence, and
  test behavior.
- A portable generic core can be copied into another project with a small
  project adapter and independent specs.
- Local test execution is reproducible and has an unambiguous exit status.

### Trade-offs

- The project owns and must maintain its CDP client and browser lifecycle code.
- Contributors need a compatible local Chrome or Chromium installation.
- Browser behavior is initially tested in Chromium, not across every browser
  engine.
- Coverage is only as broad as the journeys encoded in specs; this first
  increment checks desktop load/brush drawing and mobile touch/brush drawing.
- The browser suite is local-only for now. Connecting it to CI is a separate
  decision and is not part of this change.

## Implementation references

- [Local browser test harness guide](../../../tests/SKILL.md)
- [Deterministic test fixer skill](../../../.agents/skills/deterministic-test-fixer/SKILL.md)

