import { APP_VERSION } from './version.js';

// Static per-version highlights. Keep newest first. The settings dialog
// renders this; "Unreleased" collects the current roadmap items.
export const RELEASE_NOTES = Object.freeze([
  {
    version: 'Unreleased',
    date: '2026-09-19',
    highlights: [
      'Phase 2: shared action-menu placement, outside-click/Escape closure, and reliable palette color editing',
      'Phase 2: compact alpha controls, source-over Select-after-draw composition, and transparent canvas groundwork',
      'Phase 2: functional History/Session and Settings seams with keyboard semantics and focus restoration',
      'Phase 2: recent text history, optional text focus targets, accurate bounds, and shape-like raster-selection handoff',
      'Phase 2: Ribbon position buttons, mobile layout checks, storage estimate display, and release-readiness evidence',
    ],
  },
  {
    version: '1.5.0',
    date: '2026-09',
    highlights: [
      'Shapes gallery with fill modes, arrows, V/X marks',
      'Shared line/text size control with presets',
      'IndexedDB history with auto-save modes and export',
      'Settings dialog with ribbon/history/about sections',
      'Offline support via service worker',
    ],
  },
]);

export const getReleaseNotes = () => { return RELEASE_NOTES; }
export const getAppVersion = () => { return APP_VERSION; }
