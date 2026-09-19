// Shared names and limits. Feature modules should import these contracts
// instead of introducing another raw key or event string.

export const STORAGE_KEYS = Object.freeze({
	settings: 'omerpaint:settings',
	colors: 'paint:colors',
	zoom: 'paint:zoom',
	initialZoom: 'paint:initial-zoom',
	selectedTool: 'paint:selected-tool',
	fontSize: 'paint:font-size',
	textStyles: 'paint:text-styles',
	textStyle: 'paint:text-style',
	textHistory: 'paint:text-history',
	textHistoryToolbar: 'paint:text-history-toolbar',
	storageEstimate: 'paint:storage-estimate',
	toolStyles: 'paint:tool-styles',
	styleHistory: 'paint:style-history',
	showCurrentTool: 'paint:show-current-tool',
	colorInspectorCollapsed: 'paint:color-inspector-collapsed',
	panelLayout: 'paint:panel-layout',
	sidebarState: 'paint:sidebar-state',
	sidebarWidth: 'paint:sidebar-width',
	shapeSelectAfterDraw: 'paint:shape-select-after-draw',
	selectedEmoji: 'paint:selected-emoji',
	selectedShape: 'paint:selected-shape',
	ribbonButtonState: 'paint:ribbon-button-state',
	pendingHistorySave: 'paint:pending-history-save',
	aiConnection: 'paint:ai-connection',
});

export const EVENTS = Object.freeze({
	settingsChanged: 'paint:settings-changed',
	documentChanged: 'paint:document-changed',
	selectionChanged: 'paint:selection-changed',
	historyChanged: 'paint:history-changed',
	storageError: 'paint:storage-error',
});

export const LIMITS = Object.freeze({
	maxHistoryEntries: 20,
	maxTextHistoryEntries: 20,
	maxCanvasDimension: 10000,
	maxImportPixels: 32 * 1024 * 1024,
});

export const SCHEMA_VERSIONS = Object.freeze({
	settings: 1,
	document: 1,
	globalHistory: 2,
});

export const DEFAULT_SETTINGS = Object.freeze({
	darkMode: false,
	showStatusBar: true,
	showColorInspector: true,
	showAiChat: false,
	canvasBackground: 'none',
	solidBackgroundColor: '#ffffff',
	defaultCanvasSize: '800x600',
	defaultZoom: 100,
	historyAutoSave: true,
	historyAutoSaveMode: 'all',
	ribbonLayout: null,
	ribbonVisibility: {},
	buttonVisibility: {},
	showRotateInSelection: true,
});
