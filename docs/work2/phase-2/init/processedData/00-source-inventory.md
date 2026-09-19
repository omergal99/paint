# Processed Source Inventory

## Inputs read

- `initIstructions.txt`
- `paint/AGENTS.md`, `paint/.skills/README.md`, and all relevant local skill notes
- `paint/README.md`, `package.json`, `manifest.json`, `sw.js`
- `paint/docs/AUDIT-REPORT.md`
- `paint/docs/work2/phase-1/PLAN-OVERVIEW.md`, `PLAN-DETAILS.md`, and `VERIFY-REPORT2.md`
- `paint/index.html`, `css/styles.css`, `css/progressive.css`
- core canvas, tools, history, storage, UI, settings, and transform modules
- `tests/smoke.test.js`, `tests/shape-layer.test.js`, and GitHub workflows
- `paint/docs/work1/COMMUNITY_STANDARDS.md` (canonical standards document)

## Current structure

```text
paint/
  index.html
  css/styles.css + progressive.css
  js/main.js                 composition root plus many features
  js/canvas/                 pixels, viewport, resize
  js/tools/                  pointer tools and text
  js/history/                session and persistent history
  js/ui/                     toolbar, sidebar, dialogs, palette
  js/settings/               registry
  js/utils/                  color and transforms
  tests/                     one source-heavy smoke suite + shape behavior tests
  .skills/                   useful local contracts, missing feature-specific notes
```

## Missing/reference discrepancy

The request references `paint/docs/w2/PLAN-OVERVIEW.html`. It is not present in
the checkout. The available Phase 1 overview was used as the source for the
deferred #7 tabs/split and #8 quota/thumbs items.

The community standards document does exist at
`paint/docs/work1/COMMUNITY_STANDARDS.md`; older README/test references to
`docs/COMMUNITY_STANDARDS.md` are path drift to correct in Step 01.
