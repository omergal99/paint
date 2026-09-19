# Current Evidence and Reconciliation

## Verified in this planning pass

- `git -C paint status --short` was clean before planning artifacts.
- The initial `npm test` exited non-zero: `shape-layer.test.js` passed and
  `smoke.test.js` failed as a subtest. Step 01 corrected the intended paths and
  settings height; the current four-file test gate is green.
- `docs/work1/COMMUNITY_STANDARDS.md` is the canonical standards document;
  README and smoke tests currently refer to the stale `docs/` path.
- The initial settings-height expectation was reconciled during implementation;
  the current product target is the compact 470px shell documented in Phase 2.
- `main.js` is 1,867 lines; `Sidebar.js` 827; `styles.css` 2,344.
- `ToolManager` has separate `pointermove` handlers for tool work and status.
- `HistoryManager` stores full PNG data URLs in undo/redo memory.
- `GlobalHistory` already has compressed thumbnails, quota trimming, and a v2
  `docId` field; this is hardening work, not a greenfield feature.
- `TextTool` commits the textarea to canvas pixels on blur; it has no durable
  text-object store or hit-test/edit path.
- `manifest.json` contains one SVG icon; `.github/workflows/lighthouse.yml`
  exists but is `workflow_dispatch` only.
- The docs/tests path mismatch is maintenance drift, not a product behavior
  blocker once Step 01 updates the references.

## Audit claims that need re-measurement

The audit report says “39/41” and says there is no Lighthouse workflow. The
current checkout instead exposes one failing smoke subtest and does contain a
manual Lighthouse workflow. The plan uses fresh commands as the authority and
will not copy stale numbers into implementation decisions.
