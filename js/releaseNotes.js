import { APP_VERSION } from './version.js';

// Static per-version highlights. Keep newest first. The settings dialog
// renders this as customer-facing release history.
export const RELEASE_NOTES = Object.freeze([
	{
		version: '1.6.1',
		date: '2026-09-20',
		highlights: [
			'Empty text placement stays in Text mode until text is actually entered',
			'Settings remembers the last tab while closing with a clean URL',
			'Offline preparation now verifies and warms every current app feature',
			'Offline shell coverage now follows the app import graph in release checks',
		],
	},
	{
		version: '1.6.0',
		date: '2026-09-19',
		highlights: [
			'Reliable menus with viewport-aware placement and outside-click/Escape closing',
			'Independent opacity controls, transparent color support, and safer shape placement',
			'History and Settings improvements with keyboard-friendly tabs and Ribbon controls',
			'Recent text history, optional text selection, and movable text-layer selections',
			'Hand/Pan navigation, responsive Ribbon layouts, and install/update controls for the offline app',
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
