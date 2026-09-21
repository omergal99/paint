# Step 13 - Tabs, Split, and Recovery

## Current status

The session and recovery contracts remain isolated foundations, and the first
visible workspace shell is now available as reusable UI modules. It is
deliberately mountable without changing the current single-canvas boot path,
so document/canvas migration can land incrementally.

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

## First visible UI slice

- `js/ui/TabBar.js` renders an accessible `role="tablist"` from a
  `SessionService` snapshot. It supports active/dirty indicators, close and
  new-document affordances, Home/End and arrow-key navigation, and clean
  subscription teardown.
- `js/ui/SplitView.js` renders an opt-in split host. It assigns the secondary
	  pane through `SessionService`, exposes an accessible keyboard/pointer
	  divider, and loads an isolated full Paint app (ribbon, canvas, sidebar,
	  status bar) in each pane.
- `css/styles.css` contains shared light/dark-mode-aware shell styles.
- The shell is compact and controllable: the File → More menu exposes Save and
	Manage multiple Paint, while the strip provides a manage button and a split
	view control. The manager dialog can select or close session documents.
- The strip is hidden by default for a clean canvas and its visibility is
  persisted through the shared storage-key contract. Split controls are also
  hidden until File → More → Split Paint view is chosen; the active split host
  covers the app with two bounded full-app panes.
- `tests/step13-ui.test.js` verifies tab projection, split-ratio bounds, pane
	  assignment, iframe pane creation, and hidden-by-default behavior. Cross-pane
	  document metadata and crash recovery remain the next integration slice.

## Still required to finish the feature

- Connect parent tab metadata and dirty state to the isolated pane apps, then
	  add visible undo-close and recovery actions.
- Add a small postMessage/session bridge for active-document labels, focus, and
	  safe close behavior without sharing raster or tool state across panes.
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
