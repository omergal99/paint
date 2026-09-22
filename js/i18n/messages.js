// English-first localization contract.
//
// `t()` returns plain text for textContent, title, aria-label, and other
// attribute sinks. It deliberately does not construct HTML or accept markup
// templates; callers must not pass its result to innerHTML.

import { DEFAULT_LOCALE, localeCandidates, normalizeLocale } from './localeRegistry.js';
import { ES_MESSAGES } from './catalogs/es.js';
import { UI_TEXT_KEYS } from './uiText.js';
import { PT_BR_MESSAGES, initializePtBr } from './catalogs/pt-br.js';
import { FR_MESSAGES, initializeFr } from './catalogs/fr.js';
import { DE_MESSAGES, initializeDe } from './catalogs/de.js';
import { AR_MESSAGES, initializeAr } from './catalogs/ar.js';
import { JA_MESSAGES, initializeJa } from './catalogs/ja.js';
import { HE_MESSAGES, initializeHe } from './catalogs/he.js';

export { DEFAULT_LOCALE, normalizeLocale } from './localeRegistry.js';
export const I18N_LOCALE_STORAGE_KEY = 'paint:locale';

const deepFreeze = (value) => {
	if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
	Object.values(value).forEach((child) => deepFreeze(child));
	return Object.freeze(value);
};

export const EN_MESSAGES = deepFreeze({
	common: {
		appName: 'Paint',
		actions: {
			add: 'Add',
			apply: 'Apply',
			cancel: 'Cancel',
			clear: 'Clear',
			close: 'Close',
			confirm: 'Confirm',
			copy: 'Copy',
			cut: 'Cut',
			delete: 'Delete',
			discard: 'Discard',
			download: 'Download',
			import: 'Import',
			new: 'New',
			open: 'Open',
			paste: 'Paste',
			redo: 'Redo',
			rename: 'Rename',
			retry: 'Retry',
			save: 'Save',
			undo: 'Undo',
			ok: 'OK',
		},
	},
	ribbon: {
		groups: {
			clipboard: 'Clipboard',
			colors: 'Colors',
			file: 'File',
			history: 'History',
			image: 'Image',
			shapes: 'Shapes',
			tools: 'Tools',
		},
		file: {
			newDocument: 'New',
			openImage: 'Open image',
			importImage: 'Import image',
			saveImage: 'Save',
		},
		image: {
			cropToSelection: 'Crop to selection',
			moreActions: 'More image actions',
			resize: 'Resize',
		},
		tools: {
			colorPicker: 'Color picker',
			eraser: 'Eraser',
			fill: 'Fill',
			magnifier: 'Magnifier',
			pencil: 'Pencil',
			select: 'Select',
			text: 'Text',
		},
		annotations: {
			currentTool: 'Current tool: {tool}',
			more: 'More',
			moreTools: 'More tools',
			openOptions: 'Open options',
		},
	},
	settings: {
		title: 'Settings',
		language: 'Language',
		browserLanguage: 'Browser: {language}',
		languageDescription: 'Choose the language used by the Paint interface. More languages appear after review.',
		appearance: 'Appearance',
		storage: 'Storage',
		about: 'About',
			general: 'General',
			search: 'Search settings',
			languageReady: '{language} is ready',
			languagePlanned: '{language} is planned',
			resetConfirm: 'Reset all settings to their defaults? Colors, layout, tools, zoom, history preferences and other preferences will be reset. Saved images and history entries will not be deleted.',
			clearDataTitle: 'Clear all saved data',
			clearDataConfirm: 'Clear the saved canvas, workspace data, settings, and history? This cannot be undone.',
	},
	ui: {
		crop: 'Crop', removeBackground: 'Remove Background', backgroundRemovalMode: 'Removal mode', backgroundRemovalColorKey: 'Color key (all matching pixels)', backgroundRemovalFloodFill: 'Flood fill (connected background)', backgroundRemovalSoftEdge: 'Soft edge (feathered alpha)', backgroundRemovalTolerance: 'Tolerance', backgroundRemovalSoftness: 'Edge softness', backgroundRemovalColor: 'Background color', backgroundRemovalSample: 'Sample', preview: 'Preview', noSelectionCrop: 'No Selection Area to Crop', openBackgroundRemovalOptions: 'Open background removal options', rotate: 'Rotate', rotate90: 'Rotate 90',
		rotate180: 'Rotate 180', rotate270: 'Rotate 270', freeRotate: 'Free Rotate', showRotateInSelection: 'Show Rotate in selection',
		flip: 'Flip', flipHorizontal: 'Flip Horizontal', flipVertical: 'Flip Vertical', showRecentTextToolbar: 'Show Recent text toolbar',
		selectTextAfterDraw: 'Select text after draw', textFocusHelp: 'Focus targets are safe; editing existing text remains deferred.',
		textStyle: 'Text style', outline: 'Outline', blackOutline: 'Black outline', shadow: 'Shadow', neon: 'Neon', bold: 'Bold',
		italic: 'Italic', underline: 'Underline', handPan: 'Hand / Pan', recentStyles: 'Recent styles', line: 'Line', arrow: 'Arrow',
		rectangle: 'Rectangle', rounded: 'Rounded', rightTriangle: 'Right Tri', diamond: 'Diamond', pentagon: 'Pentagon', hexagon: 'Hexagon',
		star: 'Star', heart: 'Heart', plus: 'Plus', doubleArrow: 'Du-Arrow', ellipse: 'Ellipse', triangle: 'Triangle', emoji: 'Emoji',
		selectAfterDraw: 'Select after draw', foreground: 'Foreground', background: 'Background', aiChat: 'AI Chat', extras: 'Extras',
		showRibbon: 'Show ribbon', sidebar: 'Sidebar', autoSaveLifecycle: 'Exit, refresh or new image', fiftyImages: '50 images',
		openHistorySettings: 'Open History Settings', off: 'Off', tenImages: '10 images', twentyImages: '20 images', hundredImages: '100 images',
		actionsHistory: 'Actions: History', aiProvider: 'AI provider', connectionDetails: 'Connection details',
		aiHelp: 'Use Quick actions or type a supported command. I will show exactly what I apply.', send: 'Send',
		resizeCanvas: 'Resize canvas', quickSizes: 'Quick sizes', square: 'Square', a4Landscape: 'A4 landscape', a4Portrait: 'A4 portrait',
		fullHd: 'Full HD', squareCanvasSize: '1000 × 1000 (square)', a4LandscapeCanvasSize: 'A4 landscape (1123 × 794)', a4PortraitCanvasSize: 'A4 portrait (794 × 1123)', widthPx: 'Width (px)', heightPx: 'Height (px)', scalePercent: 'Scale (%)', wholeCanvas: 'Whole canvas', keepAspect: 'Maintain aspect ratio',
		tabGeneral: 'GENERAL', tabShortcuts: 'SHORTCUTS', tabHistory: 'HISTORY', tabRibbon: 'RIBBON', tabReleaseNotes: 'RELEASE NOTES',
		tabAbout: 'ABOUT', tabApp: 'APP', tabFeedback: 'FEEDBACK', darkMode: 'Dark Mode', showStatusBar: 'Show Status Bar', showColorInspector: 'Show Color Inspector',
		canvasBackground: 'Canvas Background', solidColor: 'Solid Color', transparent: 'Transparent', transparentCheckerboard: 'Transparent Checkerboard',
		gridlines: 'Gridlines', selected: 'Selected:', defaultNewImage: 'Default new image', custom: 'Custom', initialZoom: 'Initial zoom',
		keyboardShortcuts: 'Keyboard shortcuts', shortcutHelp: 'Focus a shortcut field, press the keys you want, then leave the field. Changes are saved in this browser.',
		defaultsActive: 'Defaults are active.', autoSaveHistory: 'Auto-save to history', restoreLastImage: 'Load last image on startup',
		restoreHelp: 'Off starts with a blank canvas. Turn it on when you want Paint to restore the last working image automatically.',
		autoSaveWhen: 'Auto-save when', allAutomaticEvents: 'All automatic events', onlyManual: 'Only manually (Save Current button)', saveLimit: 'Save limit',
		exportAllHistory: 'Export All History', ribbon: 'Ribbon', ribbonHelp: 'Choose which ribbon groups are visible. Detailed group options open in the sidebar.',
		ribbonPosition: 'Ribbon position', top: 'Top', left: 'Left', bottom: 'Bottom', floating: 'Floating', aboutPaint: 'About paint',
		aboutPaintText: 'paint is a local-first browser drawing workspace built for fast, private image editing.', version: 'Version', loading: 'Loading…',
		activity: 'Activity', storedData: 'Browser storage used (estimate)', freeSpace: 'Free space', usage: 'Usage', usagePercent: 'Usage ({percent}%)', storageQuota: 'Browser storage quota (estimate)', resetSettings: 'Reset Settings', clearData: 'Clear Data',
		releaseNotes: 'Release notes', releaseNotesHelp: 'What is new in each version. Newest first.', installUpdates: 'Install & updates',
		installHelp: 'Install paint as an app for a focused window, quick launch, and offline use. The browser decides when direct installation is available.',
		installPaint: 'Install paint', checkingInstall: 'Checking install options…', versionUpdates: 'Version updates',
		updateHelp: 'When a new version is published, the service worker checks for it and applies it automatically on the next safe reload.',
		checkUpdates: 'Check for updates', offlineUse: 'Offline use',
		offlineHelp: 'Prepare every current Paint feature for use without an internet connection. Future optional features may add a separate download step.',
		prepareOffline: 'Prepare offline use', checkingOffline: 'Checking offline shell…', feedbackSupport: 'Feedback & support',
		showAiChat: 'Show AI Chat', autoSaveLabel: 'Auto-save:', saveLimitLabel: 'Save limit:', use: 'Use',
		pointerIdle: 'Pointer: -',
		aiReadyLocal: 'Ready: local actions only', connected: 'Connected', customPalette: 'Custom palette', defaultSelectedColor: 'Default selected color', useCurrent: 'Use current', actionsSession: 'Actions: Session', showEntireGroup: 'Show Entire Group', showCurrentTool: 'Show Current tool', historyItemDeleted: 'History item deleted', loadedFromHistory: 'Loaded from history', restoredSessionStep: 'Restored session step',
		providerWebsiteSafe: 'Use the provider website; no credentials are stored here.', currentImageCopied: 'Current image copied. Open the provider website and paste it into the chat.', imageClipboardUnavailable: 'Image clipboard is unavailable in this browser. Export the image and upload it on the provider website.', imageCopyFailed: 'The image could not be copied. Export it and upload it on the provider website.',
		interfaceDirection: 'Interface direction', directionAuto: 'Automatic', directionLtr: 'Left to right', directionRtl: 'Right to left',
		feedbackHelp: 'Your feedback is important because it helps prioritize fixes, accessibility improvements, and features that make paint useful in real workflows.',
		issueHelp: 'If something feels broken or confusing, please open a GitHub issue with what you expected, what happened, and-when possible-steps to reproduce it.',
		openIssue: 'Open a new GitHub issue', browseIssues: 'Browse existing issues', startNewImage: 'Start new image?', unsavedChanges: 'Unsaved changes will be lost.',
		pleaseConfirm: 'Please confirm', continue: 'Continue', providerPrivacy: 'Paint never asks for, stores, or receives your provider password or API key.',
		openProvider: 'Open provider website', copyCurrentImage: 'Copy current image',
		showLabel: 'Show {label}', settingsAlwaysVisible: '{group} (Settings always visible)', details: 'Details', countImages: '{count} images', onlyManualShort: 'Only manually', freeRotatePrompt: 'Enter the rotation angle in degrees.',
	},
	history: {
		title: 'History',
		global: 'History',
		session: 'Session',
		saveCurrent: 'Save Current',
		exportAll: 'Export All',
		clearAll: 'Clear All',
		noHistory: 'No history found',
		noSessionSteps: 'No session steps yet - draw something first',
		restoreSessionStep: 'Restore session step',
		deleteSessionStep: 'Delete session step',
		clearTitle: 'Clear history',
		clearConfirm: 'Are you sure you want to permanently delete all saved history? This cannot be undone.',
	},
	notepad: {
		title: 'Notes',
		empty: 'No notes yet',
		addNote: 'Add note',
		renameNote: 'Rename note',
		deleteNote: 'Delete note',
		noteTitle: 'Note title',
		placeholder: 'Write a note…',
		storageUnavailable: 'Notes are available for this visit, but could not be saved.',
		quotaExceeded: 'Notes could not be saved because browser storage is full.',
	},
	status: {
		pointer: 'Pointer: {position}',
		selection: 'Selection: {selection}',
		saved: 'Saved',
		restoredRecentImage: 'Restored recent image',
		imageOpened: 'Opened {name}',
		imageImported: 'Imported {name}',
		copied: 'Copied',
		pasted: 'Pasted',
		storageError: 'Could not save your work. Your image is still open.',
		undoSnapshotSkipped: 'Undo snapshot skipped to protect memory.',
		downloadReady: 'Download ready',
		historySaved: 'History image saved',
		historyCleared: 'History cleared',
	},
	releaseNotes: {
		unreleasedSep2026: {
			h1: 'Hebrew and additional reviewed interface languages are now available with RTL support and complete catalog coverage',
			h2: 'Settings, history, ribbon, sidebar, release notes, and storage labels now follow the active language',
			h3: 'Browser storage reporting now separates estimated usage from the browser quota and explains the percentage honestly',
		},
		v1_6_1: {
			h1: 'Empty text placement stays in Text mode until text is actually entered',
			h2: 'Settings remembers the last tab while closing with a clean URL',
			h3: 'Offline preparation now verifies and warms every current app feature',
			h4: 'Offline shell coverage now follows the app import graph in release checks',
		},
		v1_6_0: {
			h1: 'Reliable menus with viewport-aware placement and outside-click/Escape closing',
			h2: 'Independent opacity controls, transparent color support, and safer shape placement',
			h3: 'History and Settings improvements with keyboard-friendly tabs and Ribbon controls',
			h4: 'Recent text history, optional text selection, and movable text-layer selections',
			h5: 'Hand/Pan navigation, responsive Ribbon layouts, and install/update controls for the offline app',
		},
		v1_5_0: {
			h1: 'Shapes gallery with fill modes, arrows, V/X marks',
			h2: 'Shared line/text size control with presets',
			h3: 'IndexedDB history with auto-save modes and export',
			h4: 'Settings dialog with ribbon/history/about sections',
			h5: 'Offline support via service worker',
		},
	},
});

initializePtBr(EN_MESSAGES);
initializeFr(EN_MESSAGES);
initializeDe(EN_MESSAGES);
initializeAr(EN_MESSAGES);
initializeJa(EN_MESSAGES);
initializeHe(EN_MESSAGES);

export const MESSAGE_CATALOGS = deepFreeze({
	[DEFAULT_LOCALE]: EN_MESSAGES,
	es: ES_MESSAGES,
	'pt-br': PT_BR_MESSAGES,
	fr: FR_MESSAGES,
	de: DE_MESSAGES,
	ar: AR_MESSAGES,
	ja: JA_MESSAGES,
	he: HE_MESSAGES,
});

// This is the current markup/module usage contract. New data-i18n attributes
// or `t()` calls should add their key here until the future source scanner is
// introduced, so a missing English fallback cannot silently reach users.
export const REQUIRED_MESSAGE_KEYS = Object.freeze([
	'common.appName',
	'common.actions.cancel',
	'common.actions.close',
	'common.actions.save',
	'common.actions.undo',
	'common.actions.redo',
	'ribbon.groups.file',
	'ribbon.groups.tools',
	'ribbon.annotations.currentTool',
	'settings.title',
	'settings.language',
	'settings.languageDescription',
	'settings.general',
	'settings.search',
	'settings.languageReady',
	'settings.languagePlanned',
	'history.title',
	'history.session',
	'history.noSessionSteps',
	'notepad.title',
	'notepad.empty',
	'status.saved',
	'status.undoSnapshotSkipped',
	...new Set(Object.values(UI_TEXT_KEYS)),
]);

const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

const textValue = (value) => {
	if (value === null || value === undefined) return '';
	return String(value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
};

export const getMessageTemplate = (catalog, key) => {
	if (!catalog || typeof catalog !== 'object') return undefined;
	const segments = textValue(key).split('.').filter(Boolean);
	if (segments.length === 0) return undefined;
	let value = catalog;
	for (const segment of segments) {
		if (!value || typeof value !== 'object' || !hasOwn(value, segment)) return undefined;
		value = value[segment];
	}
	return typeof value === 'string' ? value : undefined;
};

export const interpolateMessage = (template, variables = {}) => textValue(template).replace(
	/\{([A-Za-z0-9_.-]+)\}/g,
	(match, name) => (variables && hasOwn(variables, name) ? textValue(variables[name]) : match),
);

export const listMessageKeys = (catalog, prefix = '') => {
	if (!catalog || typeof catalog !== 'object') return [];
	return Object.entries(catalog).flatMap(([name, value]) => {
		const key = prefix ? `${prefix}.${name}` : name;
		if (typeof value === 'string') return [key];
		return listMessageKeys(value, key);
	});
};

const toKeyList = (keys) => {
	if (typeof keys === 'string') return [keys];
	if (!keys || typeof keys[Symbol.iterator] !== 'function') return [];
	return [...keys];
};

export const findMissingMessageKeys = (keys, catalog = EN_MESSAGES) => [...new Set(toKeyList(keys))]
	.filter((key) => getMessageTemplate(catalog, key) === undefined);

export const assertMessageCoverage = (keys, catalog = EN_MESSAGES) => {
	const missing = findMissingMessageKeys(keys, catalog);
	if (missing.length > 0) throw new Error(`Missing English message keys: ${missing.join(', ')}`);
	return true;
};

// Catalog templates are text/attribute strings, never snippets of HTML. This
// catches accidental markup before a future data-i18n renderer consumes them.
export const findMarkupMessageKeys = (catalog = EN_MESSAGES) => listMessageKeys(catalog)
	.filter((key) => /[<>]/.test(getMessageTemplate(catalog, key)));

const resolveCatalogs = (catalogs) => {
	const source = catalogs && typeof catalogs === 'object' ? catalogs : {};
	const resolved = { [DEFAULT_LOCALE]: EN_MESSAGES };
	Object.entries(source).forEach(([locale, catalog]) => {
		if (catalog && typeof catalog === 'object') resolved[normalizeLocale(locale)] = catalog;
	});
	return resolved;
};

const readStoredLocale = (storage, storageKey) => {
	try { return storage?.getItem?.(storageKey) || null; } catch { return null; }
};

const writeStoredLocale = (storage, storageKey, locale) => {
	try { storage?.setItem?.(storageKey, locale); } catch {}
};

export const createI18n = ({
	locale,
	catalogs = MESSAGE_CATALOGS,
	storage = null,
	storageKey = I18N_LOCALE_STORAGE_KEY,
} = {}) => {
	const availableCatalogs = resolveCatalogs(catalogs);
	let activeLocale = normalizeLocale(locale ?? readStoredLocale(storage, storageKey));

	const templateFor = (key) => {
		for (const candidate of localeCandidates(activeLocale)) {
			const template = getMessageTemplate(availableCatalogs[candidate], key);
			if (template !== undefined) return template;
		}
		return getMessageTemplate(EN_MESSAGES, key);
	};

	const t = (key, variables = {}) => {
		const template = templateFor(key);
		if (template === undefined) return `[missing:${textValue(key)}]`;
		return interpolateMessage(template, variables);
	};

	return Object.freeze({
		t,
		getLocale: () => activeLocale,
		setLocale: (nextLocale, { persist = true } = {}) => {
			activeLocale = normalizeLocale(nextLocale);
			if (persist) writeStoredLocale(storage, storageKey, activeLocale);
			return activeLocale;
		},
		has: (key) => templateFor(key) !== undefined,
		getCatalog: (locale = activeLocale) => {
			for (const candidate of localeCandidates(locale)) {
				if (availableCatalogs[candidate]) return availableCatalogs[candidate];
			}
			return EN_MESSAGES;
		},
	});
};

// Stable convenience export for feature modules that need a locale-aware text
// sink without passing the controller through every constructor.
const defaultI18n = createI18n({ locale: DEFAULT_LOCALE });
export const t = (key, variables = {}) => defaultI18n.t(key, variables);
export const setDefaultLocale = (locale) => defaultI18n.setLocale(locale, { persist: false });
