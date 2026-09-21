# Step 13 - Tabs, Split, and Recovery

## Current status

The session and recovery contracts are implemented as isolated, UI-neutral
foundations. There is no visible tab bar, split view, or multi-document editor
yet, so this step is not feature-complete.

## Implemented foundation

- `js/session/SessionService.js` owns an in-memory workspace with a maximum of
  ten `PaintDocument`-style records, ordered tabs, primary/secondary pane
  assignments, active-document focus, dirty state, and a bounded undo-close
  stack.
- The service validates restore data before mutation, keeps at least one
  document open, exposes snapshot/subscription seams for a future controller,
  and clears its subscriptions and document references on `dispose()`.
- `js/session/RecoveryService.js` accepts a small storage adapter and persists
  only a bounded JSON workspace shell plus a crash marker. It deliberately does
  not persist canvases, raster blobs, or undo payloads.
- Recovery classifies valid crash state, clean state, missing data, expired
  data, malformed data, and unavailable storage. Its default TTL is 24 hours;
  malformed or expired records are read-only until the user explicitly chooses
  `discardRecovery()`.
- `tests/session-recovery.test.js` covers document limits, pane focus, dirty
  state, undo-close, malformed restore rejection, recovery classification,
  explicit discard, bounded snapshots, and disposal.

## Still required to finish the feature

- Build and wire an accessible TabBar and SplitView, including mouse, touch,
  and keyboard divider behavior, focus management, dirty indicators, and
  visible undo-close controls.
- Connect the services to `main.js`, canvas ownership, tool/history state, and
  the existing single-document UI. Each tab needs an independently live or
  safely suspended canvas/document lifecycle.
- Move from the current single-canvas persistence model to bounded
  per-document IndexedDB raster storage, with history/object-URL cleanup,
  inactive-document compression, quota recovery, and safe restore ordering.
- Add a recovery prompt that lets the person restore or explicitly discard a
  recovered workspace; validate crash/reload, malformed storage, quota, and
  large-document paths in a browser.
- Keep text recovery gated on proven non-destructive overlap/edit behavior;
  the stored session shell is not a substitute for a text-rendering or
  coordinate-recovery implementation.

## Done when

Two visible documents can be edited independently, split or re-focused with
accessible controls, recovered after a crash/reload, and closed without leaking
listeners, object URLs, canvas memory, or persisted document data.
