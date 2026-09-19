import { APP_VERSION } from './version.js';

// Static per-version highlights. Keep newest first. The settings dialog
// renders this; "Unreleased" collects the current roadmap items.
export const RELEASE_NOTES = Object.freeze([
  {
    version: 'Unreleased',
    date: '',
    highlights: [
      'V shape anchor fix + optional select-after-draw in Shapes More',
      'First paste on a clean New canvas lands at 0,0',
      'Reusable font-size slider (1–120)',
      'History/Session tabs, no-change dedup, compressed thumbnails',
      'Tabs (max 10) + split view session service (planned)',
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
