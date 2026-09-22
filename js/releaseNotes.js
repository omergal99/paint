import { APP_VERSION } from './version.js';

// Per-version highlights are message keys so every ready locale can render the
// customer-facing release history. Keep newest first; the renderer resolves
// them through `t()` with the English fallback for unreleased catalogs.
export const RELEASE_NOTES = Object.freeze([
	{
		version: '1.6.1',
		date: '2026-09-20',
		highlightKeys: [
			'releaseNotes.v1_6_1.h1',
			'releaseNotes.v1_6_1.h2',
			'releaseNotes.v1_6_1.h3',
			'releaseNotes.v1_6_1.h4',
		],
	},
	{
		version: '1.6.0',
		date: '2026-09-19',
		highlightKeys: [
			'releaseNotes.v1_6_0.h1',
			'releaseNotes.v1_6_0.h2',
			'releaseNotes.v1_6_0.h3',
			'releaseNotes.v1_6_0.h4',
			'releaseNotes.v1_6_0.h5',
		],
	},
	{
		version: '1.5.0',
		date: '2026-09',
		highlightKeys: [
			'releaseNotes.v1_5_0.h1',
			'releaseNotes.v1_5_0.h2',
			'releaseNotes.v1_5_0.h3',
			'releaseNotes.v1_5_0.h4',
			'releaseNotes.v1_5_0.h5',
		],
	},
]);

export const getReleaseNotes = () => { return RELEASE_NOTES; }
export const getAppVersion = () => { return APP_VERSION; }

