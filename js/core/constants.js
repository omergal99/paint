// Shared names and limits. Feature modules should import these contracts
// instead of introducing another raw key or event string.

export const STORAGE_KEYS = Object.freeze({
	settings: 'omerpaint:settings',
	settingsTab: 'omerpaint:settings-tab',
	colors: 'paint:colors',
	zoom: 'paint:zoom',
	initialZoom: 'paint:initial-zoom',
	selectedTool: 'paint:selected-tool',
	fontSize: 'paint:font-size',
	textStyles: 'paint:text-styles',
	textStyle: 'paint:text-style',
	textHistory: 'paint:text-history',
	textHistoryToolbar: 'paint:text-history-toolbar',
	toolStyles: 'paint:tool-styles',
	styleHistory: 'paint:style-history',
	showCurrentTool: 'paint:show-current-tool',
	colorInspectorCollapsed: 'paint:color-inspector-collapsed',
	panelLayout: 'paint:panel-layout',
	sidebarState: 'paint:sidebar-state',
	sidebarWidth: 'paint:sidebar-width',
	shapeSelectAfterDraw: 'paint:shape-select-after-draw',
	textSelectAfterDraw: 'paint:text-select-after-draw',
	selectedEmoji: 'paint:selected-emoji',
	selectedShape: 'paint:selected-shape',
	ribbonButtonState: 'paint:ribbon-button-state',
	pendingHistorySave: 'paint:pending-history-save',
	aiConnection: 'paint:ai-connection',
	workspaceStripVisible: 'paint:workspace-strip-visible',
});

export const EVENTS = Object.freeze({
	settingsChanged: 'paint:settings-changed',
	documentChanged: 'paint:document-changed',
	selectionChanged: 'paint:selection-changed',
	historyChanged: 'paint:history-changed',
	storageError: 'paint:storage-error',
});

export const KEYBOARD_KEYS = Object.freeze({
	arrowUp: 'ArrowUp',
	arrowDown: 'ArrowDown',
	arrowLeft: 'ArrowLeft',
	arrowRight: 'ArrowRight',
	arrows: Object.freeze(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']),
	horizontalArrows: Object.freeze(['ArrowLeft', 'ArrowRight']),
});

const shortcut = (action, label, defaultBinding, aliases = []) => Object.freeze({
	action,
	label,
	defaultBinding,
	aliases: Object.freeze(aliases),
});

export const SHORTCUT_ACTIONS = Object.freeze({
	undo: 'undo',
	redo: 'redo',
	selectAll: 'selectAll',
	copy: 'copy',
	cut: 'cut',
	paste: 'paste',
	save: 'save',
	open: 'open',
	newFile: 'newFile',
	deleteSelection: 'deleteSelection',
	selectTool: 'selectTool',
	pencilTool: 'pencilTool',
	brushTool: 'brushTool',
	fillTool: 'fillTool',
	eraserTool: 'eraserTool',
	textTool: 'textTool',
	eyedropperTool: 'eyedropperTool',
	zoomTool: 'zoomTool',
	panTool: 'panTool',
	nudgeUp: 'nudgeUp',
	nudgeDown: 'nudgeDown',
	nudgeLeft: 'nudgeLeft',
	nudgeRight: 'nudgeRight',
});

export const SHORTCUT_DEFINITIONS = Object.freeze([
	shortcut(SHORTCUT_ACTIONS.undo, 'Undo', 'mod+z'),
	shortcut(SHORTCUT_ACTIONS.redo, 'Redo', 'mod+y', ['mod+shift+z']),
	shortcut(SHORTCUT_ACTIONS.selectAll, 'Select all', 'mod+a'),
	shortcut(SHORTCUT_ACTIONS.copy, 'Copy', 'mod+c'),
	shortcut(SHORTCUT_ACTIONS.cut, 'Cut', 'mod+x'),
	shortcut(SHORTCUT_ACTIONS.paste, 'Paste', 'mod+v'),
	shortcut(SHORTCUT_ACTIONS.save, 'Save', 'mod+s'),
	shortcut(SHORTCUT_ACTIONS.open, 'Open', 'mod+o'),
	shortcut(SHORTCUT_ACTIONS.newFile, 'New image', 'mod+n'),
	shortcut(SHORTCUT_ACTIONS.deleteSelection, 'Delete selection', 'delete', ['backspace']),
	shortcut(SHORTCUT_ACTIONS.selectTool, 'Select tool', 's'),
	shortcut(SHORTCUT_ACTIONS.pencilTool, 'Pencil tool', 'p'),
	shortcut(SHORTCUT_ACTIONS.brushTool, 'Brush tool', 'b'),
	shortcut(SHORTCUT_ACTIONS.fillTool, 'Fill tool', 'f'),
	shortcut(SHORTCUT_ACTIONS.eraserTool, 'Eraser tool', 'e'),
	shortcut(SHORTCUT_ACTIONS.textTool, 'Text tool', 't'),
	shortcut(SHORTCUT_ACTIONS.eyedropperTool, 'Eyedropper tool', 'k'),
	shortcut(SHORTCUT_ACTIONS.zoomTool, 'Zoom tool', 'z'),
	shortcut(SHORTCUT_ACTIONS.panTool, 'Pan tool', 'h'),
	shortcut(SHORTCUT_ACTIONS.nudgeUp, 'Nudge selection up', 'arrowup', ['shift+arrowup']),
	shortcut(SHORTCUT_ACTIONS.nudgeDown, 'Nudge selection down', 'arrowdown', ['shift+arrowdown']),
	shortcut(SHORTCUT_ACTIONS.nudgeLeft, 'Nudge selection left', 'arrowleft', ['shift+arrowleft']),
	shortcut(SHORTCUT_ACTIONS.nudgeRight, 'Nudge selection right', 'arrowright', ['shift+arrowright']),
]);

export const DEFAULT_SHORTCUT_BINDINGS = Object.freeze(
	Object.fromEntries(SHORTCUT_DEFINITIONS.map(({ action, defaultBinding }) => [action, defaultBinding])),
);

export const HISTORY_VIEWS = Object.freeze({
	history: 'history',
	session: 'session',
});

export const RIBBON_POSITIONS = Object.freeze({
	top: 'top',
	left: 'left',
	bottom: 'bottom',
	float: 'float',
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
	workingCanvas: 1,
});

export const DEFAULT_SETTINGS = Object.freeze({
	darkMode: false,
	showStatusBar: true,
	showColorInspector: true,
	showAiChat: false,
	interfaceDirection: 'auto',
	canvasBackground: 'none',
	solidBackgroundColor: '#ffffff',
	defaultCanvasSize: '800x600',
	defaultZoom: 100,
	historyAutoSave: true,
	historyAutoSaveMode: 'all',
	restoreLastImage: false,
	ribbonLayout: null,
	ribbonVisibility: {},
	buttonVisibility: {},
	showRotateInSelection: true,
	shortcuts: DEFAULT_SHORTCUT_BINDINGS,
});
