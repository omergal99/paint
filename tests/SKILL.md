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
browser specs. The GitHub Actions workflow continues to run its existing Node
suite; browser tests remain local-only.

```bash
npm run test:browser
npm run test:browser -- --spec desktop
npm run test:browser -- --spec mobile
npm run test:browser -- --spec mobile,desktop
npm run test:browser -- --test brush-desktop
npm run test:browser -- --rerun-failed latest
npm run test:browser -- --list
npm run test:browser -- --diagnostics --test brush-desktop
```

Stable test IDs and names are in `tests/browser-specs.mjs`. Each browser
journey runs in its own fresh Chrome BrowserContext and a separate Node test
process, so browser storage, page state, and execution order do not leak
between journeys. `--spec` order is respected. A targeted run is for diagnosis;
after any source fix, run `npm run test:local` before declaring it verified.

`npm test` remains the existing CI-safe Node suite. The browser specs are named
`*.browser.mjs`, so they are not included by its current test glob. Each browser
run writes a report whether it passes, fails, or cannot start:

```text
output/test-artifacts/
  latest.json
  runs/<run-id>/
    report.json
    report.html
    results/<test-id>.json
    screenshots/       # failures, plus optional --diagnostics checkpoints
    logs/              # native test reporter output and stderr
```

`latest.json` is a small portable pointer to the most recent report; it is not
a symlink. Open the standalone `report.html` directly or consume `report.json`
from tools. The JSON is the source of truth; HTML has no external assets or
runtime dependencies. JSON/HTML reports and `latest.json` are atomically
replaced, and report links are limited to safe relative artifact paths. Run
directories are currently retained without automatic pruning so failure
evidence is not deleted unexpectedly; a bounded retention policy remains open.
`--rerun-failed latest` (or an explicit prior run ID)
executes only browser test IDs marked failed in that report; infrastructure-only
failures without test failures must be diagnosed and rerun through normal
selection.

## Configuration and timeout policy

Defaults are centralized and validated in `tests/core/test-config.mjs`.
Project-specific overrides can be set in `tests/browser.config.mjs`. Precedence
is defaults, project config, environment, then CLI. Timeouts are maximum bounds
around condition-based waits, not synchronization delays. Override selected
bounds through the CLI:

```bash
npm run test:browser -- --chrome-timeout-ms 20000 --test-timeout-ms 45000
```

Supported environment variables are `LOCAL_BROWSER_CHROME_TIMEOUT_MS`,
`LOCAL_BROWSER_CHROME_DISCOVERY_TIMEOUT_MS`,
`LOCAL_BROWSER_SERVER_TIMEOUT_MS`, `LOCAL_BROWSER_COMMAND_TIMEOUT_MS`,
`LOCAL_BROWSER_CLOSE_TIMEOUT_MS`,
`LOCAL_BROWSER_APP_TIMEOUT_MS`, `LOCAL_BROWSER_UI_TIMEOUT_MS`,
`LOCAL_BROWSER_TEST_TIMEOUT_MS`, `LOCAL_BROWSER_POLL_INTERVAL_MS`,
`LOCAL_BROWSER_SHUTDOWN_GRACE_MS`, `LOCAL_BROWSER_ARTIFACT_DIR`,
`LOCAL_BROWSER_SCREENSHOT_ON_FAILURE`, and
`LOCAL_BROWSER_DIAGNOSTIC_SCREENSHOTS`. Durations must be positive integers
up to 600000 ms. `CHROME_BIN` may point to a compatible Chrome/Chromium binary.

HTTP(S) requests from browser tests are intercepted: loopback requests are
continued, and external requests are blocked and recorded as failures. HTTP
error responses, failed requests, browser log errors, console errors, and
uncaught exceptions are also included in test diagnostics. There is no implicit
external-host allowlist. Reported network URLs omit credentials, query strings,
and fragments. Reports stay local under `output/`; review screenshots and
application error text before sharing them, since those may reflect local test
fixtures or application state.

## Structure and reuse

- `tests/core/` owns generic server-process startup, Chrome discovery and
  lifecycle, isolated BrowserContexts, the CDP client, validated configuration,
  viewport and input controls, error/network collection, condition-based waits,
  diagnostics, and report generation. It must not contain Paint-specific
  selectors or product assumptions.
- `tests/adapters/paint/` owns the Paint server configuration, selectors, app
  readiness, canvas operations, and app-specific checks.
- `tests/browser-specs.mjs` owns stable IDs, display names, categories, and
  device/viewports for CLI selection and reports.
- `tests/specs/` owns browser journeys. The smoke tests verify app load, clean
  session state before app scripts, active Brush selection, and drawing on
  desktop and mobile-emulated touch. More product journeys remain future work.
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
- Keep browser HTTP(S) requests loopback-only. A future external integration
  allowlist requires an explicit reviewed policy; none is currently supported.
- Keep each browser journey in a fresh BrowserContext; storage reset scripts
  must run before application code, not after navigation.
- Use named `step()` checkpoints for meaningful actions. Failure reports retain
  the last failed step and browser evidence; avoid noisy screenshots on passing
  runs unless `--diagnostics` is explicitly requested.
- Preserve test intent. Never delete or weaken an assertion to make a failure
  disappear; change a test only after an explicit product/spec decision.
- After any fix, rerun the full `npm run test:local` command and verify exit
  code `0`, including desktop and mobile.
- Review failure logs and screenshots, then report the failing journey,
  viewport, root cause, files changed, and full-suite verification.

## Run report JSON schema

`report.json` and each per-test `results/<test-id>.json` include
`schemaVersion: 1`. The run report contains:

- `runId`, optional `rerunOf`, `startedAt`, `finishedAt`, `durationMs`,
  `gitCommit`, and `status`;
- `environment` with Node, browser, OS, and architecture;
- `selection` and `summary` counts;
- `infrastructureError` when setup or cleanup fails;
- `tests[]` with stable ID/name/category, device, viewport, status, duration,
  named steps, failure/error details, browser/network diagnostics, and screenshot
  path when available;
- `diagnostics` with native test reporter and log artifact paths.

Consumers should reject unsupported schema versions rather than guess field
meaning. The report JSON is the canonical record; the HTML report is rendered
from the same object.

See the [testing ADR](../docs/adr/testing/ADR-0002-local-deterministic-browser-tests.md)
and the [deterministic test fixer skill](../.agents/skills/deterministic-test-fixer/SKILL.md).

