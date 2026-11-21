# Tests and browser reports

Paint keeps its fast Node regression tests and local real-browser journeys
separate. The test runner is deterministic and does not use AI. GitHub Actions
continues to run the existing Node suite; browser tests remain local-only.

## Run and count tests

```bash
npm test
npm run test:browser -- --list
npm run test:local
```

The Node suite contains **400+ tests**. To get the current exact total, run
`npm test` and read the `ℹ tests N` line in Node's summary; do not copy that
volatile number into status documentation. The browser catalog is listed with
`npm run test:browser -- --list`.

Run one browser journey or group when diagnosing:

```bash
npm run test:browser -- --test clipboard-text-paste
npm run test:browser -- --spec desktop
npm run test:browser -- --spec mobile
npm run test:browser -- --rerun-failed latest
```

## Current browser journeys

| Journey | What it proves |
|---|---|
| `brush-desktop` | Desktop app readiness, clean session state, active Brush, and changed canvas pixels |
| `brush-mobile` | Mobile-emulated touch input paints canvas pixels |
| `clipboard-text-paste` | Browser Clipboard API text can be pasted through Ctrl+V into Paint's text editor |

These are focused Chromium checks, not full product, physical-device, or
cross-browser certification. The Clipboard journey covers successful text
paste only; denied permissions and image copy/paste remain unverified.

## Reports

Each browser run writes JSON and standalone HTML under
`output/test-artifacts/runs/<run-id>/`. The JSON is canonical; the HTML is a
human-readable view of the same result. `output/test-artifacts/latest.json`
points to the latest report. Failure screenshots and logs are retained with
the run; successful journeys do not produce screenshots unless diagnostics
were requested.

- [Successful-run HTML example](./examples/successful-browser-run.html)
- [Successful-run JSON example](./examples/successful-browser-run.json)

The examples are a sanitized successful run showing the report schema and
presentation. Refresh them when the report schema or its useful presentation
changes, not after every test run. Keep machine-specific paths, credentials,
and private image data out of checked-in reports.

## Source of truth and structure

- [Test-tree map](../../tests/README.md)
- [Harness operating guide and repair rules](../../tests/skills/SKILL.md)
- [Deterministic browser-testing ADR](../adr/testing/ADR-0002-local-deterministic-browser-tests.md)
- [Coverage gaps and next work](../reports/project-audit.md)

The reusable harness is grouped into browser, process, runner, and reporting
modules under `tests/core/`; validated defaults and Paint overrides are in
`tests/config/`; product journeys are in `tests/specs/browser/`; Node tests
are grouped under `tests/unit/`. Direct CDP use is Chromium-specific and has
no compatibility guarantee; see the ADR before extending the core.
