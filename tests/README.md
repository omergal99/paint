# Tests

- `*.test.js` files are the existing dependency-light Node regression suite,
  run by `npm test` and the current GitHub Actions workflow.
- `core/` contains the portable, product-neutral CDP/browser test harness.
- `adapters/paint/` and `specs/*.browser.mjs` contain Paint-specific setup and
  real-browser desktop/mobile checks. Run them with `node tests/run-local.mjs`.

See the [harness and reuse guide](./SKILL.md) before adding browser tests or
copying the generic core to another project.

