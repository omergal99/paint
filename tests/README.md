# Tests

The test tree separates Paint unit tests from the reusable local browser
harness. Keep only the test entry point and this navigation file at the root.

```text
tests/
  adapters/paint/       Paint-specific app and server adapter
  config/               Shared harness defaults and Paint overrides
  core/
    browser/            CDP session, Chrome launch, input and browser checks
    process/            Child-process lifecycle and local server
    reporting/          JSON/HTML reports and test reporter
    runner/             Suite orchestration and CLI selection
  fixtures/paint/       Paint browser fixtures
  helpers/              Shared Node-test helpers
  skills/               Agent instructions for running and fixing tests
  specs/browser/        Browser test catalog and user journeys
  unit/                 Node regression tests grouped by product concern
  run-local.mjs         Local browser suite entry point
```

Run the Node suite with `npm test`; run Node and browser tests with
`npm run test:local`. For browser-only selection and report details, see
[Testing documentation](../docs/tests/README.md) and the
[harness operating guide](./skills/SKILL.md).
