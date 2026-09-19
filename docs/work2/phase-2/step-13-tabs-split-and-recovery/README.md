# Step 13 — Tabs, Split, and Recovery

## Goal

Implement the deferred Phase 1 #7 workspace model after the foundations are
stable.

## Tasks

- `SessionService`, `PaintDocument`, `TabStore`, and `RecoveryService`.
- TabBar with max 10 total tabs, dirty indicators, and undo-close.
- SplitView with mouse/touch/keyboard divider.
- Per-document storage migration from the current single-canvas key.
- Inactive-document compression and bounded history.
- Do not depend on a fragile text-coordinate cache for recovery. Text UI remains
  gated on proving non-destructive overlap/edit behavior.

## Done when

Two documents can be edited independently, recovered after a crash/reload, and
closed without leaking listeners, object URLs, or canvas memory.
