# Session and recovery core contracts

This folder is a foundation for Step 13, not a tabs or split-view UI.

- `createSessionService()` owns up to ten `PaintDocument`-style records,
  ordered tabs, primary/secondary pane assignments, an active document, dirty
  flags, and a bounded undo-close stack. It uses only internal subscriptions;
  `dispose()` clears all listener and document references.
- `createRecoveryService({ storage })` accepts a small `getItem` / `setItem` /
  `removeItem` adapter. It stores a bounded JSON workspace *shell* and a crash
  marker. Raster blobs, canvases, IndexedDB, and UI prompts are deliberately
  outside this module.

Suggested composition later:

```js
const session = createSessionService();
const recovery = createRecoveryService({ storage: sessionStorage });
const prior = recovery.begin();
if (prior.classification === 'recoverable') session.restore(prior.session);
// Subscribe to session changes and call recovery.saveSnapshot(session.getRecoveryState()).
// On confirmed normal shutdown: recovery.markCleanExit().
```

`inspect()` is read-only. A malformed or expired recovery record is never
deleted automatically; the UI must offer an explicit `discardRecovery()` path.
The stored shell excludes pixel and undo payloads, so future per-document
raster storage can remain separately bounded and recoverable.
