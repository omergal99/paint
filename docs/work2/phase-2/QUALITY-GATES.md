# Quality Gates

## Every implementation task

- `npm test` is green.
- `node --check` passes for changed JavaScript files.
- `git diff --check` passes.
- Changed UI path is manually exercised in a browser when available.
- No new direct storage key, raw global event string, or native dialog is added
  outside its owning contract.

## Baseline metrics to capture in Step 01

| Metric | Baseline method | Target direction |
|---|---|---|
| Test health | `npm test` and individual test files | 0 failures |
| Listener count | static census of `addEventListener`/`removeEventListener` | teardown ratio approaches 1:1 |
| Main/sidebar size | `wc -l` | reduce responsibilities before chasing line count |
| Pointer work | browser performance trace during 5-second draw | fewer forced layouts and duplicate coordinate conversions |
| Browser memory | Chrome task manager/performance profile on 2k and 4k canvases; include decoded surfaces, ImageBitmaps, scratch canvases, Blobs, object URLs, and undo entries | bounded runtime memory; release transient surfaces and URLs |
| Storage | quota probe plus IndexedDB/localStorage diagnostics | bounded undo/storage; actionable quota recovery |
| Lighthouse | local server + Lighthouse on representative view | measured baseline before target is chosen |
| PWA | Lighthouse installability + manifest inspection | installable with 192/512 PNG icons |

## Release targets

- Lighthouse budgets: establish real baseline first; initial target is 90+ for
  Performance, Accessibility, Best Practices, and SEO on the public landing
  view, with documented exceptions for the editor's intentional canvas UX.
- No unbounded full-resolution history array.
- Browser memory and storage quota are reported as separate budgets.
- Canvas/import operations reject or downscale unsafe dimensions with a visible
  status message.
- Storage failures are visible to the user and offer a safe export path.
- Ribbon height is measured in each supported layout, including compact and
  expanded variants, rather than inferred from one top-layout constant.
- Transparency tests include pixel-level and PNG fixtures for clear, erase,
  import, resize, and export behavior.
- Keyboard-only journeys cover ribbon, menus, settings, history, dialogs, and
  text editing.
