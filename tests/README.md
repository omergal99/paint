# Tests

- `*.test.js` files are the existing dependency-light Node regression suite,
  run by `npm test` and the current GitHub Actions workflow.
- `core/` contains the portable, product-neutral CDP/browser harness,
  configuration, isolation, lifecycle, diagnostics, and report writers.
- `browser-specs.mjs` defines stable CLI IDs. `adapters/paint/` and
  `specs/*.browser.mjs` contain Paint-specific setup and browser journeys.

Run all local checks with `npm run test:local`. For only browser checks, a
group, one test, or a test listing, use `npm run test:browser` and see the
[harness guide](./SKILL.md).

See the [harness and reuse guide](./SKILL.md) before adding browser tests or
copying the generic core to another project.

