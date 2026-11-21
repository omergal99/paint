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
npm run test:browser -- --spec desktop
npm run test:browser -- --spec mobile
npm run test:browser -- --spec mobile,desktop
npm run test:browser -- --test selection-select
npm run test:browser -- --test selection-deselect
npm run test:browser -- --test canvas-resize
npm run test:browser -- --diagnostics --test canvas-resize
npm run test:browser -- --rerun-failed latest
```

`--spec` values run in the order supplied. Use `--test <id>` for one journey;
the current IDs are listed with `npm run test:browser -- --list`.

## Current browser journeys

| Journey | What it proves |
|---|---|
| `brush-desktop` | Desktop app readiness, clean session state, active Brush, and changed canvas pixels |
| `brush-mobile` | Mobile-emulated touch input paints canvas pixels |
| `clipboard-text-paste` | Browser Clipboard API text can be pasted through Control+V into Paint's text editor |
| `selection-select` | Desktop rectangular selection covers the expected canvas region without changing canvas pixels |
| `selection-deselect` | Deselect clears selection handles and restores the explicitly selected previous Brush tool |
| `canvas-resize` | A 50% whole-canvas resize updates dimensions and pixels; Undo and Redo restore the expected states |

These are focused Chromium checks, not full product, physical-device, or
cross-browser certification. The Clipboard browser journey currently sends
Control+V on Linux. A focused Node test confirms both Ctrl+V and Meta+V
normalize to the default `mod+v` paste binding, and the clipboard source
documents native Cmd/Ctrl+V paste events. This is not a real macOS browser
verification. Denied permissions and image copy/paste remain unverified.

The selection journeys cover one rectangular desktop marquee, Deselect from
the Selection menu, and whole-canvas resize with Undo/Redo. They do not prove
mobile selection, moving/resizing a selection, lasso, or broader edit history.

## Reports

Each browser run writes JSON and standalone HTML under
`output/test-artifacts/runs/<run-id>/`. The JSON is canonical; the HTML is a
human-readable view of the same result. `output/test-artifacts/latest.json`
points to the latest report. Failure screenshots and logs are retained with
the run; successful journeys do not produce screenshots unless diagnostics
were requested.

- [Successful-run HTML example](./examples/successful-browser-run.html)
- [Successful-run JSON example](./examples/successful-browser-run.json)
- [Controlled-failure HTML example](./examples/controlled-failure-browser-run.html)
- [Controlled-failure JSON example](./examples/controlled-failure-browser-run.json)
- [Screenshot gallery and copyable commands](./examples/README.md)

`output/test-artifacts/latest.json` contains an `html` path relative to
`output/test-artifacts/`; open that standalone HTML report to inspect the most
recent run. The report's JSON is canonical. The checked-in controlled failure
is a deliberate example-only assertion expecting 801×600 from Paint's normal
800×600 canvas; it is not a product failure. The examples are sanitized,
captured report evidence, not fixtures that run as part of the suite. Refresh
them when the report schema or its useful presentation changes, not after
every test run. Keep machine-specific paths, credentials, and private image
data out of checked-in reports.

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
