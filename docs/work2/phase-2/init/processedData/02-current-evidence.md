# Current Evidence and Reconciliation

## Verified in this planning pass

- `git -C paint status --short` was clean before planning artifacts.
- `npm test` exited non-zero: `shape-layer.test.js` passed and
  `smoke.test.js` failed as a subtest.
- `docs/COMMUNITY_STANDARDS.md` is absent while README and smoke tests refer to
  it.
- `css/styles.css` currently defines settings height `min(440px, 88vh)` while
  the smoke test expects 560px.
- `main.js` is 1,867 lines; `Sidebar.js` 827; `styles.css` 2,344.
- `ToolManager` has separate `pointermove` handlers for tool work and status.
- `HistoryManager` stores full PNG data URLs in undo/redo memory.
- `GlobalHistory` already has compressed thumbnails, quota trimming, and a v2
  `docId` field; this is hardening work, not a greenfield feature.
- `TextTool` commits the textarea to canvas pixels on blur; it has no durable
  text-object store or hit-test/edit path.
- `manifest.json` contains one SVG icon; `.github/workflows/lighthouse.yml`
  exists but is `workflow_dispatch` only.

## Audit claims that need re-measurement

The audit report says “39/41” and says there is no Lighthouse workflow. The
current checkout instead exposes one failing smoke subtest and does contain a
manual Lighthouse workflow. The plan uses fresh commands as the authority and
will not copy stale numbers into implementation decisions.

