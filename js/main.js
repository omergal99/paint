// js/main.js
import { CanvasManager, commitLayerWithSourceOver } from './canvas/CanvasManager.js';
import { ADJUSTMENTS } from './canvas/AdjustmentEngine.js';
import { createAdjustmentService } from './canvas/AdjustmentService.js';
import { createBrushAreaMask } from './canvas/BrushAreaMask.js';
import { ViewportManager } from './canvas/ViewportManager.js';
import { CanvasResizer } from './canvas/CanvasResizer.js';
import { HistoryManager } from './history/HistoryManager.js';
import { ClipboardManager } from './clipboard/ClipboardManager.js';
import { createClipboardService } from './services/clipboard/clipboardService.js';
import { createSelectionSettings } from './services/selection/selectionSettings.js';
import { translatePath } from './services/selection/selectionGeometry.js';
import { createSelectionModeController } from './app/selectionModeController.js';
import { createSelectionOverlayController } from './app/selectionOverlayController.js';
import { createImageDropController } from './app/imageDropController.js';
import { ToolManager } from './tools/ToolManager.js';
import { createSelectTool } from './tools/SelectTool.js';
import { appState } from './app/appState.js';
import { router } from './app/router.js';
import { initResizeDialog } from './app/resizeDialog.js';
import { initFileActions } from './app/fileActions.js';
import { initCanvasContextMenu } from './app/canvasContextMenu.js';
import { initCanvasTransforms, pruneRotationState, resetRotationState } from './app/canvasTransforms.js';
import { initHistoryControls } from './app/historyControls.js';
import { createPaintSettingsRegistry } from './app/settingsRegistry.js';
import { initAboutPanel } from './app/aboutPanel.js';
import { initShortcutSettings } from './app/shortcutSettings.js';
import { initRibbonSettings } from './app/ribbonSettings.js';
import { initSettingsHydration, getDefaultZoom } from './app/settingsHydration.js';
import { markBoot } from './app/bootTiming.js';
import { createPencilTool, createBrushTool, createEraserTool } from './tools/FreehandTools.js';
import { createFillTool } from './tools/FillTool.js';
import { createShapeTool } from './tools/ShapeTool.js';
import { createTextTool } from './tools/TextTool.js';
import { createEyedropperTool } from './tools/EyedropperTool.js';
import { createZoomTool } from './tools/ZoomTool.js';
import { createPanTool } from './tools/PanTool.js';
import { createAdjustmentMaskTool } from './tools/AdjustmentMaskTool.js';
import { createColorPalette } from './ui/ColorPalette.js';
import { createColorInspector } from './ui/ColorInspector.js';
import { createStatusBar } from './ui/StatusBar.js';
import { Toolbar } from './ui/Toolbar.js';
import { Sidebar } from './ui/Sidebar.js';
import { configureShapesFavorites, initRibbonShapeFavorites } from './ui/mirrors/shapesMirror.js';
import { PanelLayoutManager } from './ui/PanelLayoutManager.js';
import { createDialogService } from './ui/DialogService.js';
import { createSettingsRegistry } from './settings/SettingsRegistry.js';
import { createDeterministicCommandService } from './ai/DeterministicCommandService.js';
import { createAiConnectionStore } from './ai/AiConnectionStore.js';
import { getReleaseNotes } from './releaseNotes.js';
import { hexToRgb } from './utils/color.js';
import { rotateCanvas, rotateCanvasByAngle, flipCanvas } from './utils/transform.js';
import { APP_VERSION } from './version.js';
import {
	DEFAULT_SETTINGS,
	EVENTS,
	HISTORY_LIMIT_OPTIONS,
	HISTORY_VIEWS,
	KEYBOARD_KEYS,
	RIBBON_POSITIONS,
	SHORTCUT_ACTIONS,
	SHORTCUT_DEFINITIONS,
	STORAGE_KEYS,
	DEFAULT_TEXT_FONT_FAMILY,
	TEXT_FONT_FAMILIES,
} from './core/constants.js';
import { createPaintSettingsStore } from './app/settingsStore.js';
import { createCommandRegistry } from './app/CommandRegistry.js';
import { createGlobalShortcutController } from './app/GlobalShortcutController.js';
import { createTextDocumentStore } from './document/TextDocumentStore.js';
import { createTextHistoryStore } from './document/TextHistoryStore.js';
import { createTextLayerService } from './document/TextLayerService.js';
import { createTextSelectionOverlay } from './ui/TextSelectionOverlay.js';
import { createTabBar } from './ui/TabBar.js';
import { createSplitView } from './ui/SplitView.js';
import { createWorkspaceStripController } from './ui/WorkspaceStrip.js';
import { createActionMenuController } from './ui/ActionMenuController.js';
import { createFontFamilyPicker } from './ui/FontFamilyPicker.js';
import { createBrushCursorOverlay } from './ui/BrushCursorOverlay.js';
import { initializeDialogIndicators } from './ui/DialogIndicator.js';
import { createBrushState } from './tools/BrushState.js';
import { createPersistentDropdown } from './ui/PersistentDropdown.js';
import { createAdjustmentsDialog, createAdjustmentOption } from './ui/AdjustmentsDialog.js';
import { createDialogSearch } from './ui/DialogSearch.js';
import { standardizeDialogFrames } from './ui/DialogFrame.js';
import { createSettingsDialog } from './ui/SettingsDialog.js';
import { createBrowserInfoPanel } from './ui/BrowserInfoPanel.js';
import { createCheckboxRowController } from './ui/CheckboxRowController.js';
import { createLocaleController } from './i18n/LocaleController.js';
import { t } from './i18n/messages.js';
import { formatUnambiguousDate, formatUnambiguousDateTime } from './utils/datetime.js';
import { createPwaInstallManager } from './pwa/PwaInstallManager.js';
import { assessImageAdmission } from './storage/ImageAdmission.js';
import { createEventBus } from './core/EventBus.js';
import { createBackgroundRemovalService } from './background/BackgroundRemovalProvider.js';
import { createLocalColorKeyProvider } from './background/LocalColorKeyProvider.js';
import { createPaintDocument } from './core/DocumentContract.js';
import { createSessionService } from './session/SessionService.js';

markBoot('boot:start');
standardizeDialogFrames({ root: document });

// ---------- DOM refs ----------
// Every addressable UI element gets a deterministic inspection hook. Explicit
// data-tag values remain authoritative; generated tags use semantic context,
// never render order.
const DATA_TAG_IDENTITY_ATTRIBUTES = Object.freeze([
	'tool', 'shape', 'settingsTab', 'brushOption', 'brushControl', 'brushDynamic',
	'brushTip', 'exportFormat',
]);
const stableDataTag = (element) => {
	if (element.id) return element.id;
	const classes = [...(element.classList || [])].filter((name) => /^[a-z][a-z-]*$/i.test(name));
	const identity = DATA_TAG_IDENTITY_ATTRIBUTES
		.map((name) => element.dataset[name])
		.filter((value) => value && /^[a-z][a-z-]*$/i.test(value));
	const parentClass = [...(element.parentElement?.classList || [])]
		.find((name) => /^[a-z][a-z-]*$/i.test(name));
	const parts = [...new Set([...identity, ...classes])];
	if (parts.length === 0 && parentClass) parts.push(parentClass);
	return `dom-${element.tagName.toLowerCase()}${parts.length ? `-${parts.join('-')}` : ''}`;
};
const ensureDataTags = (root = document) => {
	const elements = root.matches?.('*') ? [root, ...root.querySelectorAll('*')] : [...(root.querySelectorAll?.('*') || [])];
	elements.forEach((element) => {
		if (element.dataset.tag) return;
		element.dataset.tag = stableDataTag(element);
	});
};
ensureDataTags();
initializeDialogIndicators();
const dataTagObserver = globalThis.MutationObserver ? new MutationObserver((records) => {
	records.flatMap((record) => [...record.addedNodes])
		.filter((node) => node.nodeType === 1)
		.forEach((node) => ensureDataTags(node));
}) : null;
dataTagObserver?.observe(document.documentElement, { childList: true, subtree: true });

const isEmbeddedPaint = router.resolveDeepLink().embedded;
document.documentElement.classList.toggle('embedded-paint-app', isEmbeddedPaint);

const stage = document.getElementById('canvas-stage');
const bgSelect = document.getElementById('setting-canvas-bg');
const canvasEl = document.getElementById('paint-canvas');
const overlayEl = document.getElementById('overlay-canvas');
const scaleEl = document.getElementById('canvas-scale');
const dialogService = createDialogService({
	dialog: document.getElementById('app-dialog'),
	title: document.getElementById('app-dialog-title'),
	message: document.getElementById('app-dialog-message'),
	preview: document.getElementById('app-dialog-preview'),
	closeButton: document.getElementById('app-dialog-close'),
	input: document.getElementById('app-dialog-input'),
	confirmButton: document.getElementById('app-dialog-confirm'),
	cancelButton: document.getElementById('app-dialog-cancel'),
	form: document.getElementById('app-dialog-form'),
});

// ---------- Settings store (created first: every feature reads it) ----------
const settingsStore = createPaintSettingsStore();
markBoot('boot:settings-store');

const readSettings = () => {
	return settingsStore.get();
}

// Values that JS renders must stay translatable: writing the text alone leaves
// the node frozen in the language that was active at render time. Tagging the
// node with `data-i18n-runtime` hands ownership back to LocaleController, which
// re-translates every such node on `paint:locale-change`. Unkeyed values (a
// plain number) clear the tag so the controller never overwrites them.
const setLocalizedText = (node, key) => {
  if (!node) return;
  if (key) {
    node.textContent = t(key);
    node.setAttribute('data-i18n-runtime', key);
  } else {
    node.removeAttribute('data-i18n-runtime');
  }
};

const getRibbonGroupKey = (groupSection) => groupSection?.dataset.ribbonKey
	|| [...(groupSection?.classList || [])].find((name) => name.startsWith('ribbon-group-'))?.slice('ribbon-group-'.length)
	|| groupSection?.querySelector('.ribbon-group-title')?.textContent.trim();

// ---------- Settings controls read by saveSettings ----------
// `saveSettings` is the widest-reaching writer in the app: every ribbon row,
// Settings switch and theme change funnels through it, and its `catch` only
// warns. So every binding it closes over must be initialised above it. These
// live here rather than in the Settings-dialog section further down because
// declaration order is what keeps this path free of temporal dead zone
// failures - moving them back below would reintroduce them.
const dmCheckbox = document.getElementById('setting-dark-mode');
const sbCheckbox = document.getElementById('setting-show-status-bar');
const ciCheckbox = document.getElementById('setting-show-color-inspector');
const aiCheckbox = document.getElementById('setting-show-ai-chat');
const directionSelect = document.getElementById('setting-direction');
const solidBackgroundColorInput = document.getElementById('setting-solid-background-color');
const defaultCanvasSizeSelect = document.getElementById('setting-default-canvas-size');
const defaultCanvasWidthInput = document.getElementById('setting-default-canvas-width');
const defaultCanvasHeightInput = document.getElementById('setting-default-canvas-height');
const defaultZoomSelect = document.getElementById('setting-default-zoom');
const defaultZoomCustomInput = document.getElementById('setting-default-zoom-custom');
const { shortcutManager, renderShortcutSettings } = initShortcutSettings({ settingsStore });

// `PanelLayoutManager` cannot be built here: its constructor calls `apply()`,
// which invokes `onChange` synchronously, and that handler needs the ribbon
// Settings controls defined further down. So `saveSettings` reads the layout
// through this accessor, which is rebound to the real manager as soon as it
// exists. The fallback mirrors the manager's own defaults for the case where
// settings are saved during startup.
let readRibbonLayout = () => ({ visible: true, position: 'top' });

const saveSettings = () => {
	try {
		const ribbonVisibility = {};
		const buttonVisibility = {};
		document.querySelectorAll('.ribbon-group').forEach((groupSection) => {
			const title = groupSection.querySelector('.ribbon-group-title');
			if (!title) return;
			ribbonVisibility[getRibbonGroupKey(groupSection)] = [...groupSection.children]
				.filter((child) => !child.classList.contains('ribbon-group-title') && child.id !== 'file-input')
				.some((child) => !child.hidden && child.style.display !== 'none');
			groupSection.querySelectorAll('.rbtn[id]').forEach((button) => {
				buttonVisibility[button.id] = !button.hidden && button.style.display !== 'none';
			});
		});
		const historyAutoSave = (document.getElementById('history-auto-save-toggle')?.checked
			?? document.getElementById('setting-history-auto-save')?.checked) ?? true;
		const historyAutoSaveMode = document.getElementById('setting-history-auto-save-mode')?.value || 'all';
		settingsStore.set({
			darkMode: dmCheckbox.checked,
			showStatusBar: sbCheckbox.checked,
			showColorInspector: ciCheckbox.checked,
		showAiChat: aiCheckbox?.checked === true,
		interfaceDirection: directionSelect?.value || 'auto',
			canvasBackground: bgSelect.value,
			solidBackgroundColor: solidBackgroundColorInput?.value || DEFAULT_SETTINGS.solidBackgroundColor,
			defaultCanvasSize: defaultCanvasSizeSelect?.value || '800x600',
			defaultCanvasWidth: Number(defaultCanvasWidthInput?.value) || 800,
			defaultCanvasHeight: Number(defaultCanvasHeightInput?.value) || 600,
			defaultZoom: getDefaultZoom(),
			historyAutoSave,
			historyAutoSaveMode,
			// Phase 3 / step-01: the limit is owned by the store, never by a select.
			historyLimit: Number(readSettings().historyLimit ?? DEFAULT_SETTINGS.historyLimit),
			restoreLastImage: document.getElementById('setting-restore-last-image')?.checked === true,
			ribbonLayout: readRibbonLayout(),
			ribbonVisibility,
			buttonVisibility,
			showRotateInSelection: document.getElementById('rotate-selection-toggle')?.checked === true,
			shortcuts: shortcutManager.get(),
		});
	} catch (error) { console.warn('Unable to save settings:', error); }
}

// ---------- History preferences + export helpers ----------
const getHistoryPrefs = () => {
	const s = readSettings();
	return {
		autoSave: s.historyAutoSave !== false, // default: automatic
		mode: s.historyAutoSaveMode === 'close' ? 'lifecycle' : (s.historyAutoSaveMode || 'lifecycle'),
	};
}

// Auto-save on "regular" events (Ctrl+S, new file). Manual Save Current always
// works on its own.
const shouldAutoSaveHistory = () => {
	const { autoSave, mode } = getHistoryPrefs();
	return autoSave && mode === 'all';
}

// Auto-save when the page is about to close (beforeunload).
const shouldAutoSaveOnClose = () => {
	const { autoSave, mode } = getHistoryPrefs();
	return autoSave && (mode === 'all' || mode === 'lifecycle');
}

const shouldAutoSaveOnNew = () => {
	const { autoSave, mode } = getHistoryPrefs();
	return autoSave && (mode === 'all' || mode === 'lifecycle');
}

// ---------- Core managers ----------
const eventBus = createEventBus();
const canvasManager = new CanvasManager({ canvas: canvasEl, overlay: overlayEl, width: 800, height: 600, eventBus });
const brushState = createBrushState();
const initialBrush = brushState.get();
let brushTipShape = initialBrush.tipShape;
// The cursor overlay reads these without cloning BrushState on every move.
let brushRotation = { angle: initialBrush.angle, angleJitter: initialBrush.angleJitter };
canvasManager.lineWidth = initialBrush.size;
const adjustmentMask = createBrushAreaMask({
	width: canvasManager.width,
	height: canvasManager.height,
	previewCanvas: document.getElementById('adjustment-mask-canvas'),
});
const historyManager = new HistoryManager(canvasManager, {
	captureState: () => ({
		selection: canvasManager.selection ? { ...canvasManager.selection } : null,
	}),
	restoreState: ({ selection } = {}) => {
		canvasManager.floatingCanvas = null;
		setSelection(selection ? { ...selection } : null);
	},
});
const backgroundRemovalService = createBackgroundRemovalService({
	localProvider: createLocalColorKeyProvider(),
});
const textDocumentStore = createTextDocumentStore();
const textHistoryStore = createTextHistoryStore();

const statusBar = createStatusBar({
	pointerEl: document.getElementById('status-pointer'),
	selectionEl: document.getElementById('status-selection'),
	canvasSizeEl: document.getElementById('status-canvas-size'),
	flashEl: document.getElementById('status-flash'),
});

// Step 13 keeps the parent session as the pane-assignment source of truth.
// Split panes render isolated full Paint app instances so each raster/editor
// lifecycle remains independent from the parent shell.
const workspaceSession = createSessionService({
	initialDocuments: [createPaintDocument({ metadata: { label: 'Untitled' } })],
});
// Workspace chrome is optional and intentionally absent from the static HTML
// shell. Mount it after the editor graph loads so first paint stays compact;
// keep compatibility with shells that still provide the nodes.
const workspaceStripRoot = (() => {
	const existing = document.getElementById('workspace-strip');
	if (existing) return existing;
	const mainArea = document.getElementById('main-area');
	const content = document.getElementById('workspace-content');
	if (!mainArea || !content) return null;
	const strip = document.createElement('section');
	strip.id = 'workspace-strip';
	strip.className = 'workspace-strip';
	strip.dataset.tag = 'workspace-strip';
	strip.setAttribute('aria-label', 'Open documents');
	const tabBar = document.createElement('div');
	tabBar.id = 'workspace-tab-bar';
	tabBar.className = 'workspace-tab-bar';
	tabBar.dataset.tag = 'workspace-tab-bar';
	strip.append(tabBar);
	mainArea.insertBefore(strip, content);
	return strip;
})();
const workspaceSplitRoot = (() => {
	const existing = document.getElementById('workspace-split-view');
	if (existing) return existing;
	const host = document.getElementById('workspace-content');
	if (!host) return null;
	const root = document.createElement('div');
	root.id = 'workspace-split-view';
	root.className = 'workspace-split-view workspace-split-host';
	root.dataset.tag = 'workspace-split-view';
	root.hidden = true;
	host.prepend(root);
	return root;
})();
const workspaceTabBar = createTabBar({
	root: workspaceStripRoot?.querySelector('#workspace-tab-bar') || document.getElementById('workspace-tab-bar'),
	sessionService: workspaceSession,
	onSelect: (id) => statusBar.flash(`Active document: ${workspaceSession.getDocument?.(id)?.metadata?.label || 'Image'}`),
	onManage: () => workspaceManagerDialog?.showModal?.(),
	onNew: () => {
		const count = workspaceSession.getState().documents.length + 1;
		const created = workspaceSession.createDocument({ metadata: { label: `Image ${count}` } });
		if (!created.ok) statusBar.flash(created.error?.message || 'Could not open another document tab');
		else statusBar.flash('New document tab added; canvas ownership is the next Step 13 slice.');
	},
});
const workspaceSplitView = createSplitView({
	root: workspaceSplitRoot,
	sessionService: workspaceSession,
	onChange: (model) => {
		if (model.isSplit) statusBar.flash('Split view is ready for two document canvases.');
	},
});
const workspaceManagerDialog = document.getElementById('workspace-manager-dialog');
const workspaceStripController = createWorkspaceStripController({
	root: workspaceStripRoot,
	toggleButton: document.getElementById('btn-toggle-workspace'),
	labelElement: document.getElementById('workspace-strip-toggle-label'),
	storageKey: STORAGE_KEYS.workspaceStripVisible,
	defaultVisible: false,
});
const workspaceManagerTabs = createTabBar({
	root: document.getElementById('workspace-manager-tabs'),
	sessionService: workspaceSession,
	onSelect: (id) => {
		workspaceManagerDialog?.close?.();
		statusBar.flash(`Active document: ${workspaceSession.getDocument?.(id)?.metadata?.label || 'Image'}`);
	},
	onNew: () => workspaceSession.createDocument({ metadata: { label: `Image ${workspaceSession.getState().documents.length + 1}` } }),
});
document.getElementById('btn-manage-workspace')?.addEventListener('click', () => workspaceManagerDialog?.showModal?.());
document.getElementById('btn-toggle-split-view')?.addEventListener('click', () => workspaceSplitView.openSplit?.());
statusBar.setCanvasSize(canvasManager.width, canvasManager.height);
canvasManager.onAdmissionRejected = (admission) => statusBar.flash(admission.message);
canvasManager.onImageLoadError = (error) => statusBar.flash(error.message);
historyManager.onSnapshotRejected = (admission) => statusBar.flash(admission.message);

const viewportManager = new ViewportManager({
	stage,
	scaleEl,
	canvasManager,
	zoomInBtn: document.getElementById('zoom-in'),
	zoomOutBtn: document.getElementById('zoom-out'),
	zoomInput: document.getElementById('zoom-input'),
	zoomSlider: document.getElementById('zoom-slider'),
});

const canvasResizer = new CanvasResizer({
	stage,
	scaleEl: document.getElementById('canvas-scale'),
	canvasManager,
	viewportManager,
	historyManager,
	handleRight: document.getElementById('handle-right'),
	handleBottom: document.getElementById('handle-bottom'),
	handleCorner: document.getElementById('handle-corner'),
	ghost: document.getElementById('resize-ghost'),
});

// Direction changes move the stage and can change the transformed canvas
// rectangle. Invalidate cached pointer geometry and re-glue resize handles so
// a direction toggle never leaves resize math one layout behind.
const refreshCanvasDirectionGeometry = () => {
	viewportManager.invalidateGeometry();
	canvasResizer.reposition();
	viewportManager.alignRtlResizeEdge(document.documentElement?.dir);
};
const directionEventTarget = document.documentElement || window;
directionEventTarget.addEventListener('paint:locale-change', refreshCanvasDirectionGeometry);

const textLayerService = createTextLayerService({
	root: scaleEl,
	store: textDocumentStore,
	canvasManager,
	onMoveStart: () => historyManager.snapshot({ force: true }),
	onMoveEnd: () => canvasManager.persistToStorage(),
});
canvasManager.setLayerComposer({
	composite: (context) => textLayerService.compositeTo(context),
	hasContent: () => textLayerService.hasContent(),
	clear: () => textLayerService.clear(),
});

const textSelectionOverlay = createTextSelectionOverlay({
	root: scaleEl,
	store: textDocumentStore,
	getZoom: () => Number(viewportManager.zoom || 100) / 100,
	onMoveStart: (options) => textLayerService.beginMove(options),
	onMove: (options) => textLayerService.move(options),
	onMoveEnd: (options) => textLayerService.endMove(options),
	onDelete: ({ id }) => {
		historyManager.snapshot({ force: true });
		if (textDocumentStore.remove(id)) canvasManager.persistToStorage();
	},
});

canvasManager.onRasterLoad = () => {
	textLayerService.clear();
	textSelectionOverlay.clear();
};

canvasManager.onSizeChange = (w, h) => {
	statusBar.setCanvasSize(w, h);
	canvasResizer.reposition();
	textLayerService.resize({ width: w, height: h });
	adjustmentMask.resize(w, h);
	// Redraw any selection that CanvasManager.resize() preserved (clamped to the
	// new bounds) so resizing the canvas no longer drops an active marquee.
	setSelection(canvasManager.selection);
};

const colorInspector = createColorInspector({
	swatchEl: document.getElementById('ci-swatch'),
	rgbEl: document.getElementById('ci-rgb'),
	hexEl: document.getElementById('ci-hex'),
	copyButtons: [...document.querySelectorAll('.ci-copy')],
});
const colorInspectorEl = document.getElementById('color-inspector');
const colorInspectorToggle = document.getElementById('ci-toggle');
const setColorInspectorCollapsed = (collapsed) => {
	if (!colorInspectorEl || !colorInspectorToggle) return;
	colorInspectorEl.classList.toggle('collapsed', collapsed);
	const button = colorInspectorToggle;
	// The arrow is the shared `.menu-arrow` glyph; CSS points it along the
	// collapse axis from `aria-expanded` and mirrors it under RTL, so the
	// markup is never rewritten here (an inline SVG would ignore the direction).
	button.setAttribute('aria-expanded', String(!collapsed));
	const label = collapsed ? t('ui.expandColorInspector') : t('ui.collapseColorInspector');
	button.title = label;
	button.setAttribute('aria-label', label);
	try { localStorage.setItem('paint:color-inspector-collapsed', String(collapsed)); } catch { }
}
let colorInspectorCollapsed = false;
try { colorInspectorCollapsed = localStorage.getItem('paint:color-inspector-collapsed') === 'true'; } catch { }
setColorInspectorCollapsed(colorInspectorCollapsed);
colorInspectorToggle?.addEventListener('click', () => {
	setColorInspectorCollapsed(!colorInspectorEl.classList.contains('collapsed'));
});

const colorPalette = createColorPalette({
	gridEl: document.getElementById('palette-grid'),
	primarySwatchEl: document.getElementById('primary-swatch'),
	secondarySwatchEl: document.getElementById('secondary-swatch'),
	colorPickerInput: document.getElementById('color-picker'),
	primaryAlphaInput: document.getElementById('primary-alpha'),
	secondaryAlphaInput: document.getElementById('secondary-alpha'),
	primaryAlphaOutput: document.getElementById('primary-alpha-output'),
	secondaryAlphaOutput: document.getElementById('secondary-alpha-output'),
	primaryTransparentButton: document.getElementById('primary-alpha-transparent'),
	secondaryTransparentButton: document.getElementById('secondary-alpha-transparent'),
	onPrimaryChange: (hex, alpha = 1) => {
		canvasManager.primaryColor = hex;
		canvasManager.primaryAlpha = alpha;
		window.dispatchEvent(new CustomEvent('paint:primary-color-change', { detail: { hex, alpha } }));
	},
	onSecondaryChange: (hex, alpha = 1) => {
		canvasManager.secondaryColor = hex;
		canvasManager.secondaryAlpha = alpha;
	},
});
const primaryRgb = hexToRgb(colorPalette.primary);
if (primaryRgb) {
	colorInspector.show({ ...primaryRgb, hex: colorPalette.primary });
}
// Phase 2 step-03: the inspector always reflects the shared foreground state,
// so alpha/mirror changes (paint:primary-color-change) keep ci-swatch/ci-hex in
// the same direction as palette writes.
window.addEventListener('paint:primary-color-change', (event) => {
	const hex = event.detail?.hex;
	const rgb = hexToRgb(hex);
	if (rgb) colorInspector.show({ ...rgb, hex });
});

const aiConnectionStore = createAiConnectionStore();
const sidebar = new Sidebar({ canvasManager, historyManager, statusBar, palette: colorPalette, dialogService, aiConnectionStore, brushState });

// Dialog URLs are owned by the router; this adapter keeps the historical call
// shape and publishes the open dialog into app state. It is declared before
// the feature modules that bind to it during boot.
const setDialogUrl = (dialog, extra = {}) => {
	router.setDialog(dialog, { tab: extra.tab ?? null, extra });
	appState.dispatch({ type: 'dialog/changed', payload: dialog || null });
}

// ---------- Selection state + overlay drawing ----------
// The frame has two states. While the marquee is being dragged the region has
// no area yet, so it paints with the thin "selecting" colour. Once the
// selection exists it switches to the thicker, darker "active" colour to say
// "this is a real selection, drag inside it to move it". Both colours come from
// CSS custom properties, so Settings can change them without editing this file.
let selectionPreviewActive = false;
let activeToolName = 'select';

// Two genuinely different selection modes, and the difference is whether the
// pixels have been lifted off the canvas:
//
//   idle marquee - a rectangle that only defines bounds. Handles and arrow keys
//                 change *which part of the image* is selected; nothing is
//                 transformed. Painted with the thin "selecting" colour.
//   active float - the region has been dragged/rotated/cut, so its pixels live
//                 on `floatingCanvas` and can be transformed. Painted with the
//                 thicker "active" colour.
//
// Driving this off the region's size (the original `isActiveSelection()`) made
// "active" true on the first pointermove, so the selecting colour showed for
// about one frame and "Selection outline color" looked like it did nothing.
let selectionOverlayController;

// Repaint the frame after a mode change. `setSelection` only runs while a gesture
// is in flight, so without this the last painted frame stayed on screen after the
// float was lifted or dropped.
const repaintSelectionFrame = () => {
	if (!canvasManager.selection?.w || !canvasManager.selection?.h) return;
	canvasManager.clearOverlay();
	if (canvasManager.floatingCanvas) {
		const overlayContext = canvasManager.octx;
		overlayContext.save();
		overlayContext.globalAlpha = 1;
		overlayContext.globalCompositeOperation = 'source-over';
		overlayContext.drawImage(canvasManager.floatingCanvas, canvasManager.selection.x, canvasManager.selection.y);
		overlayContext.restore();
	}
	drawSelectionOutline(canvasManager.selection);
};

const setMarqueeStatus = (active) => {
	if (!active) repaintSelectionFrame();
};

const drawSelectionOutline = (region) => selectionOverlayController.drawSelectionOutline(region);

const getSelection = () => {
	return canvasManager.selection;
}

// Selection-gated actions flip together: Crop, Cut, Copy, and every control
// marked [data-requires-selection] (ribbon, File > More, canvas context menu)
// read one enabled state, and sidebar mirrors of those controls follow their
// ribbon source through data-source-tag so the two surfaces cannot disagree.
const syncSelectionActions = () => {
	const enabled = Boolean(canvasManager.selection?.w && canvasManager.selection?.h);
	document.querySelectorAll('[data-requires-selection]').forEach((control) => {
		control.disabled = !enabled;
		control.setAttribute('aria-disabled', String(!enabled));
		if (!control.id) return;
		document.querySelectorAll(`[data-source-tag="${control.id}"]`).forEach((mirror) => {
			mirror.disabled = !enabled;
			mirror.setAttribute('aria-disabled', String(!enabled));
		});
	});
	// Crop also swaps its label so the disabled tooltip explains itself.
	const crop = document.getElementById('btn-crop');
	if (crop) {
		const label = enabled ? 'Crop to selection' : 'No Selection Area to Crop';
		crop.title = label;
		crop.setAttribute('aria-label', label);
	}
};

const setSelection = (region, opts = {}) => {
	// Quarter-turn rotations legitimately swap the selection dimensions. Keep
	// the original pixel snapshot while the center remains anchored, otherwise
	// the next rotation would use an already fitted/shrunk result as its base.
	pruneRotationState(region);
	canvasManager.selection = region;
	// The status slot always reports the real measurement. An earlier version showed
	// a transient "Selecting..." hint during the marquee, but the hint could be
	// left on screen when a pointerup was missed, hiding the selection size.
	// A correct-but-plainer readout beats a hint that can lie, so the marquee
	// state is still tracked for the tools, but not rendered here.
	statusBar.setSelection(region);
	appState.dispatch({ type: 'selection/changed', payload: region });
	canvasManager.clearOverlay();
	if (region && region.w && region.h) {
		if (canvasManager.floatingCanvas) {
			const overlayContext = canvasManager.octx;
			overlayContext.save();
			overlayContext.globalAlpha = 1;
			overlayContext.globalCompositeOperation = 'source-over';
			overlayContext.drawImage(canvasManager.floatingCanvas, region.x, region.y);
			overlayContext.restore();
		}
		drawSelectionOutline(region);
	}
	selectionOverlayController.updateSelectionHandles(region);
	syncSelectionActions();
}

selectionOverlayController = createSelectionOverlayController({
	canvasManager,
	viewportManager,
	setSelection,
	isToolActive: () => activeToolName === 'select',
	isPreviewActive: () => selectionPreviewActive,
});

syncSelectionActions();

const nudgeSelection = (dx, dy) => {
	const selection = canvasManager.selection;
	if (!selection?.w || !selection?.h) return false;
	if (!canvasManager.floatingCanvas) {
		historyManager.snapshot();
		canvasManager.floatingCanvas = canvasManager.extractRegion(selection);
		canvasManager.fillRegion(selection, canvasManager.backgroundColor);
	}
	const width = canvasManager.floatingCanvas?.width || selection.w;
	const height = canvasManager.floatingCanvas?.height || selection.h;
	// Deliberately NOT clamped to the canvas. A floating selection may be nudged
	// (and dragged) past the border so it can be parked off-screen and brought
	// back; only the marquee that *creates* a selection stays inside the canvas.
	setSelection({
		x: selection.x + dx,
		y: selection.y + dy,
		w: width,
		h: height,
		path: translatePath(selection.path, dx, dy),
	});
	return true;
}

// Preview mode hides the frame, the corner handles and the rotate control while
// still compositing the floating pixels. It is driven solely by the
// Sidebar ▸ Image ▸ Selection Properties checkbox; there is deliberately no
// canvas button, so the overlay keeps one unambiguous affordance.
const isSelectionPreviewEnabled = () => document.getElementById('setting-selection-preview')?.checked === true;

const setSelectionPreview = (active) => {
	const next = Boolean(active);
	if (next === selectionPreviewActive) return;
	selectionPreviewActive = next;
	// Repaint: `setSelection` redraws the float and (unless previewing) the frame,
	// and refreshes every handle's visibility.
	setSelection(canvasManager.selection);
};

// Selection appearance (handle size, outline colours) is owned by the stylesheet
// through CSS custom properties; the Settings controls only write them.
const selectionSettings = createSelectionSettings({
	onChange: () => {
		if (isSelectionPreviewEnabled()) setSelectionPreview(true);
		else setSelectionPreview(false);
	},
});
selectionSettings.start();

const commitFloatingPixels = (region) => {
	return commitLayerWithSourceOver(canvasManager.ctx, canvasManager.floatingCanvas, region);
}

const commitFloatingSelection = () => {
	if (canvasManager.floatingCanvas && canvasManager.selection) {
		commitFloatingPixels(canvasManager.selection);
		canvasManager.floatingCanvas = null;
		// One atomic history entry for the whole lift-and-place. Recording it
		// here (the commit) rather than at pointerdown keeps the "before" pixels
		// intact, so a single Ctrl+Z reverses the complete move.
		historyManager.commitTransaction();
		resetRotationState();
		setSelection(null);
		canvasManager.persistToStorage();
		// Restore the shape tool after a select-after-draw lift, so the user can
		// immediately draw another shape. ctx._deferShapeToolReactivate is set only
		// by ShapeTool.onUp when it lifts a shape, and is consumed once here.
		// When the commit is triggered by the click that places the shape, that
		// click is still mid-gesture: switching tools right now would leave the
		// SelectTool with a stale drag start and a leftover 0x0 marquee (its onUp
		// would never run), and the next mouse move would ghost-draw a phantom
		// selection. So defer the switch to that gesture's pointerup instead.
		if (toolContext._deferShapeToolReactivate === true) {
			toolContext._deferShapeToolReactivate = false;
			const prev = toolbar.getPreviousTool?.() || 'shape';
			const target = (prev === 'select' || prev === 'shape') ? 'shape' : prev;
			if (toolManager._dragging) toolContext._pendingToolRestore = target;
			else toolManager.setActive(target);
		}
	}
}

const discardFloatingSelection = () => {
	if (canvasManager.floatingCanvas) {
		canvasManager.floatingCanvas = null;
		historyManager.abortTransaction();
		resetRotationState();
		setSelection(null);
	}
}

// Finalize the float before history captures/replaces pixels. This commits a
// drag's single atomic transaction; undo then restores the exact pre-lift
// canvas in one step, while redo restores the dropped image.
historyManager.onBeforeRestore = () => {
	toolManager.cancelActiveGesture();
	commitFloatingSelection();
};

// Phase 2 step-04: one undo/redo path for every entry point (ribbon buttons,
// the History tab, keyboard). A floating selection is dropped first so undo
// restores the canvas, not the lifted shape.
const runUndo = () => {
	return historyManager.undo();
}
const runRedo = () => {
	return historyManager.redo();
}

// ---------- Shared tool context ----------
const saveToolSelection = (toolName) => {
	try {
		localStorage.setItem('paint:selected-tool', toolName);
	} catch (err) {
		console.warn('Unable to save tool selection:', err);
	}
}

const restoreToolSelection = () => {
	try {
		const saved = localStorage.getItem('paint:selected-tool');
		return saved || 'select';
	} catch (err) {
		console.warn('Unable to restore tool selection:', err);
		return 'select';
	}
}

// Text keeps its own remembered size even though it shares the visible size
// control with drawing tools. Never fall back to the legacy line-width key:
// that would make a 3px brush unexpectedly become the text default.
let currentFontSize = (() => {
	try {
		const saved = localStorage.getItem('paint:font-size');
		const parsed = saved ? parseInt(saved, 10) : 40;
		return Number.isFinite(parsed) ? Math.max(1, Math.min(300, parsed)) : 40;
	} catch {
		return 40;
	}
})();

const TEXT_FONT_FAMILY_KEY = 'paint:text-font-family';
let currentTextFontFamily = (() => {
	try {
		const saved = localStorage.getItem(TEXT_FONT_FAMILY_KEY);
		return TEXT_FONT_FAMILIES.some(({ value }) => value === saved)
			? saved
			: DEFAULT_TEXT_FONT_FAMILY;
	} catch {
		return DEFAULT_TEXT_FONT_FAMILY;
	}
})();
let fontFamilyPicker = null;

const TEXT_STYLES_KEY = 'paint:text-styles';
const TEXT_STROKE_WIDTH_KEY = 'paint:text-outline-stroke-width';
const TEXT_STROKE_COLOR_KEY = 'paint:text-outline-stroke-color';
const TEXT_STYLE_NAMES = ['outline', 'black-outline', 'shadow', 'neon', 'bold', 'italic', 'underline'];
let currentTextStrokeWidth = (() => {
	try {
		const value = Number(localStorage.getItem(TEXT_STROKE_WIDTH_KEY));
		return Number.isFinite(value) && value >= 1 && value <= 20 ? value : 1;
	} catch {
		return 1;
	}
})();
let currentTextStrokeColor = (() => {
	try {
		const value = localStorage.getItem(TEXT_STROKE_COLOR_KEY);
		return /^#[\da-f]{6}$/i.test(value || '') ? value : '#000000';
	} catch {
		return '#000000';
	}
})();
let selectedTextStyles = (() => {
	try {
		const saved = JSON.parse(localStorage.getItem(TEXT_STYLES_KEY) || 'null');
		if (Array.isArray(saved)) return saved.filter((style) => TEXT_STYLE_NAMES.includes(style));
		const legacy = localStorage.getItem('paint:text-style');
		return legacy && legacy !== 'plain' && TEXT_STYLE_NAMES.includes(legacy) ? [legacy] : [];
	} catch {
		return [];
	}
})();

const getTextStyles = () => {
	return [...selectedTextStyles];
}

const renderTextStyleControls = () => {
	const color = colorPalette.primary;
	document.querySelectorAll('.text-style-option').forEach((button) => {
		const active = selectedTextStyles.includes(button.dataset.textStyle);
		button.classList.toggle('active', active);
		button.setAttribute('aria-pressed', String(active));
		const sample = button.querySelector('.style-sample');
		if (sample) sample.style.color = color;
	});
	const preview = document.getElementById('text-style-preview');
	if (preview) {
		preview.dataset.style = selectedTextStyles.join(' ') || 'plain';
		preview.style.color = color;
	}
}

const saveTextStyles = () => {
	try { localStorage.setItem(TEXT_STYLES_KEY, JSON.stringify(selectedTextStyles)); } catch { }
	renderTextStyleControls();
}

const textStrokeWidthInput = document.getElementById('text-outline-stroke-width');
const textStrokeWidthOutput = document.getElementById('text-outline-stroke-width-value');
if (textStrokeWidthInput) {
	textStrokeWidthInput.value = String(currentTextStrokeWidth);
	if (textStrokeWidthOutput) textStrokeWidthOutput.value = `${currentTextStrokeWidth}px`;
	textStrokeWidthInput.addEventListener('input', () => {
		currentTextStrokeWidth = Math.max(1, Math.min(20, Number(textStrokeWidthInput.value) || 1));
		if (textStrokeWidthOutput) textStrokeWidthOutput.value = `${currentTextStrokeWidth}px`;
		try { localStorage.setItem(TEXT_STROKE_WIDTH_KEY, String(currentTextStrokeWidth)); } catch {}
		window.dispatchEvent(new Event('paint:text-stroke-style-change'));
	});
}
const textStrokeColorInput = document.getElementById('text-outline-stroke-color');
if (textStrokeColorInput) {
	textStrokeColorInput.value = currentTextStrokeColor;
	textStrokeColorInput.addEventListener('input', () => {
		currentTextStrokeColor = textStrokeColorInput.value;
		try { localStorage.setItem(TEXT_STROKE_COLOR_KEY, currentTextStrokeColor); } catch {}
		window.dispatchEvent(new Event('paint:text-stroke-style-change'));
	});
}

const toolContext = {
	canvasManager,
	historyManager,
	textDocumentStore,
	textHistoryStore,
	textLayerService,
	viewportManager,
	stage,
	scaleEl,
	colorInspector,
	getSelection,
	getBrushState: () => brushState.get(),
	setBrushState: (patch) => brushState.set(patch),
	setSelection,
	commitFloatingSelection,
	discardFloatingSelection,
	drawSelectionOutline,
	setMarqueeStatus,
	repaintSelectionFrame,
	setPrimaryColor: (hex, alpha = canvasManager.primaryAlpha) => colorPalette.setPrimary(hex, alpha),
	setSecondaryColor: (hex, alpha = canvasManager.secondaryAlpha) => colorPalette.setSecondary(hex, alpha),
	setActiveTool: (name) => toolManager.setActive(name),
	getPreviousTool: () => toolbar.getPreviousTool(),
	getShapeKind: () => toolbar.getShapeKind(),
	getShapeFillMode: () => toolbar.getFillMode(),
	getSelectAfterDraw: () => toolbar.getSelectAfterDraw(),
	getTextSelectAfterDraw: () => toolbar.getTextSelectAfterDraw?.() === true,
	selectTextObject: (id) => textSelectionOverlay?.select(id),
	flattenLayers: () => canvasManager.flattenLayers(),
	getEmoji: () => toolbar.getSelectedEmoji(),
	getFontSize: () => currentFontSize,
	getFontFamily: () => currentTextFontFamily,
	getTextStyle: getTextStyles,
	getTextStrokeWidth: () => currentTextStrokeWidth,
	getTextStrokeColor: () => currentTextStrokeColor,
	getTextHistoryToolbarVisible: () => toolbar.getTextHistoryToolbarVisible?.() !== false,
	setFontSize: (size) => {
		currentFontSize = Math.max(1, Math.min(300, parseInt(size, 10)));
		try {
			localStorage.setItem('paint:font-size', currentFontSize);
		} catch (err) {
			console.warn('Unable to save font size:', err);
		}
	},
	setFontFamily: (family) => {
		if (!TEXT_FONT_FAMILIES.some(({ value }) => value === family)) return;
		currentTextFontFamily = family;
		fontFamilyPicker?.setValue(family);
		try {
			localStorage.setItem(TEXT_FONT_FAMILY_KEY, currentTextFontFamily);
		} catch (err) {
			console.warn('Unable to save text font family:', err);
		}
		window.dispatchEvent(new Event(EVENTS.textFontFamilyChanged));
	},
};

fontFamilyPicker = createFontFamilyPicker({
	root: document.getElementById('text-font-family-picker'),
	families: TEXT_FONT_FAMILIES,
	value: currentTextFontFamily,
	onChange: (family) => toolContext.setFontFamily(family),
});

// ---------- Tools ----------
const toolManager = new ToolManager({ surface: overlayEl, viewportManager, toolContext, statusBar });
const brushCursorOverlay = createBrushCursorOverlay({
	root: scaleEl,
	surface: overlayEl,
	viewportManager,
	getLineWidth: () => canvasManager.lineWidth,
	getTipShape: () => brushTipShape,
	getRotation: () => brushRotation,
});
const selectTool = createSelectTool();
const adjustmentMaskTool = createAdjustmentMaskTool({ mask: adjustmentMask, getSelection });
[
	selectTool,
	createPencilTool(),
	createBrushTool(),
	createEraserTool(),
	createFillTool(),
	createShapeTool(),
	createTextTool(),
	createEyedropperTool(),
	createZoomTool(),
	createPanTool(),
	adjustmentMaskTool,
].forEach((t) => toolManager.register(t));

viewportManager.onZoomChange = () => {
	toolManager.tools.get('text')?.onZoomChange?.(toolContext);
};

// Wrap toolManager.setActive to automatically save tool selection
const originalSetActive = toolManager.setActive.bind(toolManager);
toolManager.setActive = (name) => {
	originalSetActive(name);
	saveToolSelection(name);
	appState.dispatch({ type: 'tool/changed', payload: name });
};
createSelectionModeController({
	selectTool,
	toolManager,
	rectangleButton: document.getElementById('btn-select-rectangle'),
	lassoButton: document.getElementById('btn-select-lasso'),
	selectionButtons: [...document.querySelectorAll('.tool-btn[data-tool="select"]')],
});

// Text-only clipboard paste opens the text tool prefilled at the same
// placement anchor as image paste: current pointer, or 0,0 on a clean doc.
const routeTextToTextTool = (text) => {
	const isClean = canvasManager.isCleanDocument?.() === true;
	const pt = isClean ? null : statusBar.currentPointer;
	const point = pt ? { x: Math.floor(pt.x), y: Math.floor(pt.y) } : { x: 0, y: 0 };
	toolManager.setActive('text');
	toolManager.tools.get('text')?.insertTextAt?.(text, point, toolContext);
};

const clipboardManager = new ClipboardManager({
	canvasManager,
	historyManager,
	getSelection,
	setSelection,
	statusBar,
	setActiveTool: (name) => toolManager.setActive(name),
	commitFloatingSelection,
	routeText: routeTextToTextTool,
});

// ---------- File operations ----------
const fileActions = initFileActions({
	canvasManager,
	historyManager,
	statusBar,
	sidebar,
	clipboardManager,
	setSelection,
	commitFloatingSelection,
	getSelection,
	setDialogUrl,
	shouldAutoSaveHistory,
	shouldAutoSaveOnNew,
	backgroundRemovalService,
	commitFloatingPixels,
	discardFloatingSelection,
	bgSelect,
});
const {
	fileInput,
	persistSession,
	backgroundRemovalController,
	selectAll: selectAllCanvas,
	deleteSelection,
	newFile,
	doNewFile,
	getDefaultCanvasSize,
	openFile,
	importFile,
	save,
	saveImageAs,
	showToast,
	crop,
} = fileActions;

const adjustmentService = createAdjustmentService({
	canvasManager,
	historyManager,
	getSelection,
	commitFloatingSelection,
	setSelection,
	persistSession,
	mask: adjustmentMask,
});
Object.entries(ADJUSTMENTS).forEach(([id, metadata]) => {
	document.getElementById('adjustment-select').append(createAdjustmentOption({
		id,
		labelKey: metadata.labelKey,
	}));
});
const adjustmentDropdown = createPersistentDropdown({
	select: document.getElementById('adjustment-select'),
	labelledBy: 'adjustment-label',
});
const adjustmentDialog = createAdjustmentsDialog({
	dialog: document.getElementById('adjustments-dialog'),
	adjustmentSelect: adjustmentDropdown,
	targetSelect: document.getElementById('adjustment-target'),
	valueInput: document.getElementById('adjustment-value'),
	valueNumberInput: document.getElementById('adjustment-value-number'),
	valueOutput: document.getElementById('adjustment-value-output'),
	targetButtons: [...document.querySelectorAll('[data-adjustment-target]')],
	previewCanvas: document.getElementById('adjustments-preview'),
	applyButton: document.getElementById('adjustment-apply'),
	resetButton: document.getElementById('adjustment-reset'),
	cancelButton: document.getElementById('adjustment-cancel'),
	paintMaskButton: document.getElementById('adjustment-paint-mask'),
	clearMaskButton: document.getElementById('adjustment-clear-mask'),
	invertMaskButton: document.getElementById('adjustment-invert-mask'),
	errorMessage: document.getElementById('adjustment-error'),
	apply: adjustmentService.apply,
	preview: adjustmentService.preview,
	getValue: (id) => readSettings().adjustParams?.[id]?.value,
	hasSelection: () => Boolean(getSelection()?.w && getSelection()?.h),
	hasBrushMask: () => adjustmentMask.hasContent(),
	onValueChange: ({ id, value }) => settingsStore.set({
		adjustParams: { ...readSettings().adjustParams, [id]: { value } },
	}),
	onPaintMask: () => {
		document.getElementById('adjustment-mask-finish').hidden = false;
		toolManager.setActive('adjustment-mask');
	},
	onClearMask: () => adjustmentMask.clear(),
	onInvertMask: () => adjustmentMask.invert(getSelection()),
	onCancel: () => {
		adjustmentMask.clear();
		document.getElementById('adjustment-mask-finish').hidden = true;
		if (toolManager.active?.name === 'adjustment-mask') toolManager.setActive('select');
	},
	onApplied: () => {
		adjustmentMask.clear();
		document.getElementById('adjustment-mask-finish').hidden = true;
		if (toolManager.active?.name === 'adjustment-mask') toolManager.setActive('select');
	},
});
const openAdjustments = (event) => adjustmentDialog.open({ id: event?.detail?.id });
window.addEventListener(EVENTS.openAdjustments, openAdjustments);
document.getElementById('btn-adjustments')?.addEventListener('click', () => adjustmentDialog.open());
document.getElementById('adjustment-mask-finish')?.addEventListener('click', () => {
	adjustmentMaskTool.preserveMaskOnDeactivate();
	toolManager.setActive('select');
	document.getElementById('adjustment-mask-finish').hidden = true;
	adjustmentDialog.open();
});

const selectAll = () => {
	commitFloatingSelection();
	if (toolManager.active?.name !== 'select') toolManager.setActive('select');
	selectAllCanvas();
}

const commandRegistry = createCommandRegistry({
	commands: {
		[SHORTCUT_ACTIONS.undo]: runUndo,
		[SHORTCUT_ACTIONS.redo]: runRedo,
		[SHORTCUT_ACTIONS.selectAll]: selectAll,
		[SHORTCUT_ACTIONS.copy]: () => clipboardService.copy(),
		[SHORTCUT_ACTIONS.cut]: () => clipboardService.cut(),
		[SHORTCUT_ACTIONS.paste]: () => clipboardService.paste(),
		[SHORTCUT_ACTIONS.save]: () => save(),
		[SHORTCUT_ACTIONS.open]: () => openFile(),
		[SHORTCUT_ACTIONS.newFile]: () => newFile(),
		[SHORTCUT_ACTIONS.deleteSelection]: () => textSelectionOverlay.deleteSelected?.() || deleteSelection(),
		[SHORTCUT_ACTIONS.selectTool]: () => toolManager.setActive('select'),
		[SHORTCUT_ACTIONS.pencilTool]: () => toolManager.setActive('pencil'),
		[SHORTCUT_ACTIONS.brushTool]: () => toolManager.setActive('brush'),
		[SHORTCUT_ACTIONS.fillTool]: () => toolManager.setActive('fill'),
		[SHORTCUT_ACTIONS.eraserTool]: () => toolManager.setActive('eraser'),
		[SHORTCUT_ACTIONS.textTool]: () => toolManager.setActive('text'),
		[SHORTCUT_ACTIONS.eyedropperTool]: () => toolManager.setActive('eyedropper'),
		[SHORTCUT_ACTIONS.zoomTool]: () => toolManager.setActive('zoom'),
		[SHORTCUT_ACTIONS.panTool]: () => toolManager.setActive('pan'),
		[SHORTCUT_ACTIONS.nudgeUp]: ({ event } = {}) => nudgeSelection(0, event?.shiftKey ? -10 : -1),
		[SHORTCUT_ACTIONS.nudgeDown]: ({ event } = {}) => nudgeSelection(0, event?.shiftKey ? 10 : 1),
		[SHORTCUT_ACTIONS.nudgeLeft]: ({ event } = {}) => nudgeSelection(event?.shiftKey ? -10 : -1, 0),
		[SHORTCUT_ACTIONS.nudgeRight]: ({ event } = {}) => nudgeSelection(event?.shiftKey ? 10 : 1, 0),
	},
});
const globalShortcutController = createGlobalShortcutController({
	commandRegistry,
	shortcutManager,
});
globalShortcutController.bind();

// ---------- Transformations ----------
const actionMenuController = createActionMenuController({ root: document });
actionMenuController.bind();
const transforms = initCanvasTransforms({
	canvasManager,
	historyManager,
	viewportManager,
	dialogService,
	setSelection,
	persistSession,
	crop,
	backgroundRemovalController,
	getActiveToolName: () => activeToolName,
});
const { applyTransformation, destroyRotateSelectionHandleBinding } = transforms;
const destroySelectionHandleBindings = selectionOverlayController.bindSelectionHandles();

// Panels that keep their own controls open (Shapes gallery, Text options) are
// declared in markup with .menu-stay-open. ActionMenuController owns that rule;
// stopping propagation here would starve the ribbon's delegated handlers.

// Native dialogs do not close on backdrop clicks by default. Keep the modal
// interactions lightweight and predictable, like the ribbon menus.
document.querySelectorAll('dialog').forEach((dialog) => dialog.addEventListener('click', (event) => {
	if (event.target === dialog) dialog.close();
}));

// ---------- Resize-canvas dialog ----------
const { openResizeDialog } = initResizeDialog({
	canvasManager,
	historyManager,
	statusBar,
	setSelection,
	commitFloatingSelection,
	persistSession,
	setDialogUrl,
});

// ---------- Settings dialog ----------
const settingsDialog = document.getElementById('settings-dialog');
const resetSettingsConfirmationFallback = 'Reset all settings to their defaults';
const settingsRegistry = createPaintSettingsRegistry({ colorPalette, sidebar });
// Phase 2 step-03: the Shapes mirror and the ribbon favorites row subscribe to
// this one SettingsStore value (favoriteShapes) - no second favorites source.
configureShapesFavorites(settingsStore);
initRibbonShapeFavorites();
const deterministicAi = createDeterministicCommandService({
	setTheme: (theme) => {
		dmCheckbox.checked = theme === 'dark';
		document.body.classList.toggle('dark-mode', dmCheckbox.checked);
		saveSettings();
	},
	setCanvasBackground: (background) => {
		bgSelect.value = background;
		bgSelect.dispatchEvent(new Event('change'));
	},
	setZoom: (zoom) => viewportManager.setZoom(zoom),
	flip: (direction) => applyTransformation((canvas) => flipCanvas(canvas, direction === 'horizontal')),
	rotate: (degrees) => applyTransformation((canvas) => rotateCanvasByAngle(canvas, degrees)),
	saveToHistory: () => sidebar.saveCurrentToHistory(),
	getImageContext: () => {
		const selection = canvasManager.selection;
		const selectionText = selection ? ` Selection: ${selection.w}×${selection.h}px.` : ' No active selection.';
		return `Current image: ${canvasManager.width}×${canvasManager.height}px.${selectionText}`;
	},
});
sidebar.setAiCommandService(deterministicAi);

const settingsDialogController = createSettingsDialog({
	dialog: settingsDialog,
	tabs: document.querySelectorAll('[data-settings-tab]'),
	panels: document.querySelectorAll('[data-settings-panel]'),
	onChange: (tab) => {
		try { localStorage.setItem(STORAGE_KEYS.settingsTab, tab); } catch {}
		if (tab === 'about') updateAboutStats();
		if (tab === 'browser') browserInfoPanel.activate();
		else browserInfoPanel.deactivate();
		if (settingsDialog.open) setDialogUrl('settings', { tab });
	},
});
settingsDialogController.bind();

const settingsSearch = createDialogSearch({
	dialog: settingsDialog,
	input: document.getElementById('settings-search-input'),
	status: document.getElementById('settings-search-status'),
	previousButton: document.getElementById('settings-search-prev'),
	nextButton: document.getElementById('settings-search-next'),
	tabs: document.querySelectorAll('[data-settings-tab]'),
	panels: document.querySelectorAll('[data-settings-panel]'),
	onSelectTab: (tab) => settingsDialogController.setTab(tab),
});
settingsSearch.bind();

// Locale selection is deliberately independent from the large settings object:
// it can evolve into lazy-loaded catalogs without changing paint preferences.
const localeController = createLocaleController({
	select: document.getElementById('setting-locale'),
	browserLanguageStatus: document.getElementById('browser-language-status'),
});
localeController.bind();

const browserInfoPanel = createBrowserInfoPanel({
	list: document.getElementById('browser-info-list'),
	locationButton: document.getElementById('browser-location-button'),
	locationStatus: document.getElementById('browser-location-status'),
	translate: (key, variables) => localeController.i18n.t(key, variables),
});
document.documentElement?.addEventListener('paint:locale-change', browserInfoPanel.refresh);
const checkboxRowController = createCheckboxRowController({ root: document });
checkboxRowController.bind();

const getLastSettingsTab = () => {
	try {
		return localStorage.getItem(STORAGE_KEYS.settingsTab) || 'general';
	} catch {
		return 'general';
	}
};

const pwaInstallManager = createPwaInstallManager({
	installButton: document.getElementById('pwa-install-button'),
	statusEl: document.getElementById('pwa-install-action-status'),
	updateStatusEl: document.getElementById('pwa-install-status'),
	updateButton: document.getElementById('pwa-update-button'),
	applyUpdateButton: document.getElementById('pwa-apply-update-button'),
	offlineButton: document.getElementById('pwa-offline-button'),
	offlineStatusEl: document.getElementById('pwa-offline-status'),
	translate: (key, fallback) => localeController.i18n.t(key) || fallback,
	canReload: () => !document.querySelector('.text-editor-shell') && !canvasManager.floatingCanvas,
	requireReloadGuard: true,
});
document.getElementById('pwa-current-version').textContent = APP_VERSION;
pwaInstallManager.start();

// app.js owns the working-canvas autosave lifecycle because it also owns
// recovery startup and pagehide flushing. It binds that controller here after
// both modules are ready, so PWA updates share one durable-save decision.
const setPwaUpdateSafetyGuard = (guard) => pwaInstallManager.setReloadGuard(guard);

const openSettingsDialog = (tab = getLastSettingsTab()) => {
	settingsDialogController.open(tab);
	setDialogUrl('settings', { tab });
}

const syncRibbonLayoutControls = (state) => {
	const show = document.getElementById('setting-show-ribbon');
	if (show) show.checked = state.visible;
	document.querySelectorAll('.ribbon-position-options [data-ribbon-position]').forEach((button) => {
		const selected = button.dataset.ribbonPosition === state.position;
		button.setAttribute('aria-checked', String(selected));
		button.tabIndex = selected ? 0 : -1;
	});
}

const applyAiChatVisibility = (visible) => {
	const enabled = Boolean(visible);
	if (aiCheckbox) aiCheckbox.checked = enabled;
	const aiButton = document.getElementById('btn-ai-chat');
	if (aiButton) {
		aiButton.hidden = !enabled;
		aiButton.style.display = enabled ? '' : 'none';
	}
	if (!enabled && sidebar.activeTab === 'ai') sidebar.hide();
}

// Built here, not with the other early settings bindings: the constructor runs
// `apply()` -> `onChange`, and `syncRibbonLayoutControls` only exists from here on.
const ribbonLayoutManager = new PanelLayoutManager({
	app: document.getElementById('app'),
	panel: document.getElementById('ribbon'),
	restoreBar: document.getElementById('ribbon-restore-bar'),
	restoreButton: document.getElementById('ribbon-restore-toggle'),
	settingsButton: document.getElementById('ribbon-restore-settings'),
	onChange: (state) => {
		syncRibbonLayoutControls(state);
		if (state.action !== 'settings') return;
		openSettingsDialog('ribbon');
	},
});
readRibbonLayout = () => ({ ...ribbonLayoutManager.state });

const settingsShowRibbon = document.getElementById('setting-show-ribbon');
const settingsRibbonPositionButtons = [...document.querySelectorAll('[data-ribbon-position]')];
document.getElementById('ribbon-restore-toggle')?.addEventListener('click', () => saveSettings());
settingsShowRibbon?.addEventListener('change', () => {
	ribbonLayoutManager.setVisible(settingsShowRibbon.checked);
	saveSettings();
});
settingsRibbonPositionButtons.forEach((button, index) => {
	button.addEventListener('click', () => {
		const position = button.dataset.ribbonPosition;
		if (!Object.values(RIBBON_POSITIONS).includes(position)) return;
		ribbonLayoutManager.setPosition(position);
		saveSettings();
	});
	button.addEventListener('keydown', (event) => {
		if (!KEYBOARD_KEYS.arrows.includes(event.key)) return;
		event.preventDefault();
		const forward = event.key === KEYBOARD_KEYS.arrowRight || event.key === KEYBOARD_KEYS.arrowDown;
		const nextIndex = (index + (forward ? 1 : -1) + settingsRibbonPositionButtons.length)
			% settingsRibbonPositionButtons.length;
		settingsRibbonPositionButtons[nextIndex]?.focus();
		settingsRibbonPositionButtons[nextIndex]?.click();
	});
});

const { updateAboutStats } = initAboutPanel();
const { syncRibbonSettingsControls } = initRibbonSettings({ sidebar, saveSettings });

document.getElementById('settings-reset').addEventListener('click', async () => {
	const confirmed = await dialogService.confirm({
		title: t('ui.resetSettings'),
		message: t('settings.resetConfirm') || resetSettingsConfirmationFallback,
		confirmLabel: t('ui.resetSettings'),
		danger: true,
	});
	if (!confirmed) return;
	const resetButton = document.getElementById('settings-reset');
	if (resetButton) resetButton.disabled = true;
	settingsRegistry.resetAll().finally(() => {
		settingsDialog.close();
		window.location.reload();
	});
});

settingsDialog.addEventListener('close', () => {
	browserInfoPanel.deactivate();
	if (router.param('dialog') === 'settings') setDialogUrl(null);
});
document.getElementById('settings-close').addEventListener('click', () => settingsDialog.close());
directionSelect?.addEventListener('change', () => {
	localeController.setDirection(directionSelect.value);
	saveSettings();
});

document.getElementById('settings-clear-data').addEventListener('click', async () => {
	const confirmed = await dialogService.confirm({
		title: t('settings.clearDataTitle'),
		message: t('settings.clearDataConfirm'),
		confirmLabel: t('ui.clearData'),
		danger: true,
	});
	if (!confirmed) return;
	localStorage.clear();
	indexedDB.deleteDatabase('omerpaint_global_history');
	indexedDB.deleteDatabase('paint-workspace');
	settingsDialog.close();
	window.location.reload();
});

const onRibbonChange = () => {
	saveSettings();
	syncRibbonSettingsControls();
};
window.addEventListener('paint:ribbon-change', onRibbonChange);

// ---------- History controls wiring (sidebar + settings tab) ----------
const historyControls = initHistoryControls({
	settingsStore,
	sidebar,
	statusBar,
	dialogService,
	readSettings,
	getHistoryPrefs,
	saveSettings,
	setLocalizedText,
});
const {
	syncHistoryControls,
	syncHistoryLimitSelect,
	exportAllHistory,
	exportHistoryItem,
	applyHistoryLimit,
	restoreHistoryLimit,
	applyHistoryState,
} = historyControls;
const hydration = initSettingsHydration({
	canvasManager,
	viewportManager,
	readSettings,
	getRibbonGroupKey,
	localeController,
	applyAiChatVisibility,
	ribbonLayoutManager,
	settingsShowRibbon,
	syncRibbonLayoutControls,
	renderShortcutSettings,
	syncHistoryControls,
	syncHistoryLimitSelect,
	syncRibbonSettingsControls,
	getDefaultCanvasSize,
});
const {
	applySavedSettings,
	renderSegmentedChoices,
	applyCanvasBackgroundMode,
	syncDefaultCanvasInputsFromSelect,
	syncDefaultZoomInputFromSelect,
} = hydration;

defaultZoomSelect?.addEventListener('change', () => {
	syncDefaultZoomInputFromSelect();
	const zoom = getDefaultZoom();
	viewportManager.setInitialZoom(zoom);
	viewportManager.setZoom(zoom);
	saveSettings();
});
defaultZoomCustomInput?.addEventListener('input', () => {
	defaultZoomSelect.value = 'custom';
	const zoom = getDefaultZoom();
	viewportManager.setInitialZoom(zoom);
	viewportManager.setZoom(zoom);
	renderSegmentedChoices();
	saveSettings();
});
defaultCanvasSizeSelect?.addEventListener('change', () => {
	if (defaultCanvasSizeSelect.value !== 'custom') syncDefaultCanvasInputsFromSelect();
	saveSettings();
});
defaultCanvasWidthInput?.addEventListener('input', () => {
	defaultCanvasSizeSelect.value = 'custom';
	renderSegmentedChoices();
	saveSettings();
});
defaultCanvasHeightInput?.addEventListener('input', () => {
	defaultCanvasSizeSelect.value = 'custom';
	renderSegmentedChoices();
	saveSettings();
});

document.getElementById('btn-settings').addEventListener('click', () => openSettingsDialog());
document.getElementById('settings-footer-close')?.addEventListener('click', () => settingsDialog.close());
document.getElementById('rotate-selection-toggle')?.addEventListener('change', (event) => {
	selectionOverlayController.updateSelectionHandles(canvasManager.selection);
	saveSettings();
});

// ---------- New file dialog ----------
const newFileDialog = document.getElementById('new-file-dialog');
if (newFileDialog) {
	document.getElementById('new-file-ok').addEventListener('click', doNewFile);
	document.getElementById('new-file-cancel').addEventListener('click', () => newFileDialog.close());
	newFileDialog.addEventListener('close', () => {
		if (router.param('dialog') === 'new') setDialogUrl(null);
	});
}

dmCheckbox.addEventListener('change', (e) => {
	document.body.classList.toggle('dark-mode', e.target.checked);
	saveSettings();
});
sbCheckbox.addEventListener('change', (e) => {
	document.querySelector('.status-bar').style.display = e.target.checked ? 'grid' : 'none';
	saveSettings();
});
ciCheckbox.addEventListener('change', (e) => {
	document.getElementById('color-inspector').style.display = e.target.checked ? 'flex' : 'none';
	const separator = document.querySelector('.color-inspector')?.nextElementSibling;
	if (separator?.classList.contains('separator')) separator.style.display = e.target.checked ? '' : 'none';
	saveSettings();
});
aiCheckbox?.addEventListener('change', (e) => {
	applyAiChatVisibility(e.target.checked);
	saveSettings();
});
window.addEventListener('paint:ai-chat-visibility-change', (event) => {
	applyAiChatVisibility(event.detail === true);
	saveSettings();
});
bgSelect.addEventListener('change', (e) => {
	applyCanvasBackgroundMode(e.target.value);
	saveSettings();
});
solidBackgroundColorInput?.addEventListener('input', (event) => {
	canvasManager.setBackgroundColor(event.target.value);
	saveSettings();
});

markBoot('boot:before-hydrate');
// One-time: the Clipboard group lives in File > More now, so collapse it for
// installs that still carry the old implicit "visible" default; "Show Entire
// Group" in the Clipboard ribbon settings brings it back. Runs immediately
// before hydration so no DOM-derived saveSettings() can revive the old value.
const migrateRibbonGroupVisibility = () => {
	const settings = readSettings();
	if (Number(settings.ribbonGroupVisibilityVersion) >= 1) return;
	settingsStore.set({
		ribbonVisibility: { ...settings.ribbonVisibility, clipboard: false },
		ribbonGroupVisibilityVersion: 1,
	});
};
migrateRibbonGroupVisibility();
applySavedSettings();
markBoot('boot:after-hydrate');

// Ribbon groups exist now, so a remembered sidebar panel can be reopened.
sidebar.restorePendingPanel();

const restoreDialogFromUrl = () => {
	const { dialog, tab } = router.resolveDeepLink();
	if (dialog === 'settings') openSettingsDialog(tab || getLastSettingsTab());
	else if (dialog === 'resize') openResizeDialog();
	else if (dialog === 'new' && newFileDialog && !newFileDialog.open) newFileDialog.showModal();
}
restoreDialogFromUrl();

// The app icon and the app name open Settings ▸ About. They used to cycle
// through icon formats on the clipboard, which surprised anyone who just wanted
// to see the version.
const appNameEntry = document.querySelector('.status-item.app-name');
const openAboutFromAppIdentity = () => openSettingsDialog('about');
appNameEntry?.addEventListener('click', openAboutFromAppIdentity);
appNameEntry?.addEventListener('keydown', (event) => {
	if (event.key !== 'Enter' && event.key !== ' ') return;
	event.preventDefault();
	openAboutFromAppIdentity();
});

const toolbar = new Toolbar({
	root: document.getElementById('ribbon'),
	toolManager,
	setLineWidth: (w) => {
		canvasManager.lineWidth = w;
		brushCursorOverlay.refresh();
	},
	setFontSize: (size) => toolContext.setFontSize(size),
	brushState,
	handlers: {
		newFile: () => commandRegistry.execute({ action: SHORTCUT_ACTIONS.newFile }),
		openFile: () => commandRegistry.execute({ action: SHORTCUT_ACTIONS.open }),
		importFile,
		save: () => commandRegistry.execute({ action: SHORTCUT_ACTIONS.save }),
		saveAs: saveImageAs,
		paste: () => commandRegistry.execute({ action: SHORTCUT_ACTIONS.paste }),
		cut: () => commandRegistry.execute({ action: SHORTCUT_ACTIONS.cut }),
		copy: () => commandRegistry.execute({ action: SHORTCUT_ACTIONS.copy }),
		crop,
		openResizeDialog,
		undo: () => commandRegistry.execute({ action: SHORTCUT_ACTIONS.undo }),
		redo: () => commandRegistry.execute({ action: SHORTCUT_ACTIONS.redo }),
		setPrimaryColor: (hex, alpha) => colorPalette.setPrimary(hex, alpha),
		openBrushStudio: () => {
			sidebar.openGroupSettings(document.querySelector('[data-ribbon-key="tools"]'));
			requestAnimationFrame(() => {
				const advancedTab = document.getElementById('sidebar-mirror-tab-advanced');
				advancedTab?.click();
				document.querySelector('[data-tag="sidebar-mirror-brush-size"] input')?.focus();
			});
		},
	},
});
brushState.subscribe((state) => {
	canvasManager.lineWidth = state.size;
	brushTipShape = state.tipShape;
	brushRotation = { angle: state.angle, angleJitter: state.angleJitter };
	toolbar.syncBrushState(state);
	brushCursorOverlay.refresh();
	sidebar.syncRibbonMirror();
});

// Toolbar owns the visual tool state; keep selection handles in sync with it
// so rotate/resize affordances only appear while Select is the active tool.
const toolbarToolChange = toolManager.onToolChange;
toolManager.onToolChange = (name) => {
	activeToolName = name;
	brushCursorOverlay.setTool(name);
	toolbarToolChange?.(name);
	selectionOverlayController.updateSelectionHandles(canvasManager.selection);
};

document.querySelectorAll('.text-style-option').forEach((button) => {
	button.addEventListener('click', (event) => {
		// Keep More Tools open while styles are previewed and combined.
		event.stopPropagation();
		const style = button.dataset.textStyle;
		if (!TEXT_STYLE_NAMES.includes(style)) return;
		if (selectedTextStyles.includes(style)) {
			selectedTextStyles = selectedTextStyles.filter((value) => value !== style);
		} else {
			// Outline colors are alternatives, while effects such as shadow/bold can
			// be composed with one of them.
			const outlineStyles = ['outline', 'black-outline'];
			if (outlineStyles.includes(style)) {
				selectedTextStyles = selectedTextStyles.filter((value) => !outlineStyles.includes(value));
			}
			selectedTextStyles = [...selectedTextStyles, style];
		}
		saveTextStyles();
	});
});
document.querySelector('.text-style-picker')?.addEventListener('click', (event) => event.stopPropagation());
window.addEventListener('paint:primary-color-change', renderTextStyleControls);
renderTextStyleControls();

// ---------- Sidebar Init ----------
document.getElementById('btn-history-panel').addEventListener('click', () => sidebar.toggleHistory());
// Phase 2 step-04: the History tab's undo/redo buttons use the same path as
// data-tag="btn-undo" / "btn-redo" and Ctrl+Z / Ctrl+Shift+Z.
document.getElementById('history-undo-btn')?.addEventListener('click', () => commandRegistry.execute({ action: SHORTCUT_ACTIONS.undo }));
document.getElementById('history-redo-btn')?.addEventListener('click', () => commandRegistry.execute({ action: SHORTCUT_ACTIONS.redo }));
sidebar.setHistoryDeepLinks({ openPreferences: () => openSettingsDialog('history') });
document.getElementById('btn-ai-chat').addEventListener('click', () => sidebar.toggleAi());
document.getElementById('history-settings-link')?.addEventListener('click', () => openSettingsDialog('history'));
// Select All lives in the Image ▸ More menu and in the Image sidebar mirror;
// both reach the same implementation as the Ctrl+A binding.
document.getElementById('btn-select-all')?.addEventListener('click', () => commandRegistry.execute({ action: SHORTCUT_ACTIONS.selectAll }));

document.querySelectorAll('.ribbon-group-title').forEach(titleEl => {
	titleEl.addEventListener('click', () => {
		const groupSection = titleEl.closest('.ribbon-group');
		if (groupSection) {
			sidebar.openGroupSettings(groupSection);
		}
	});
});

// ---------- File / Storage logic ----------
// Phase 2 step-04: one state event feeds the ribbon buttons, the sidebar
// History tab, and any mounted mirror action (no polling on any surface).
window.addEventListener(EVENTS.historyChanged, (event) => {
	const canUndo = event.detail?.canUndo === true;
	const canRedo = event.detail?.canRedo === true;
	toolbar.setUndoRedoEnabled(canUndo, canRedo);
	sidebar.syncHistoryControls(canUndo, canRedo);
	sidebar.syncRibbonMirror();
	appState.dispatch({ type: 'history/changed', payload: { canUndo, canRedo } });
});

let lifecycleSnapshotQueued = false;
const queueLifecycleHistorySnapshot = () => {
	if (lifecycleSnapshotQueued || !sidebar.globalHistory.historyEnabled) return;
	lifecycleSnapshotQueued = true;
	try {
		localStorage.setItem('paint:pending-history-save', JSON.stringify({
			dataUrl: canvasManager.toDataURL('image/png'),
			width: canvasManager.width,
			height: canvasManager.height,
			queuedAt: Date.now(),
		}));
	} catch (error) {
		console.warn('Unable to queue lifecycle history snapshot:', error);
	}
}

window.addEventListener('beforeunload', () => {
	// A shape lifted by "select after draw" exists only as a floating layer until
	// the selection is left. Closing or refreshing IS leaving it, so bake it onto
	// the canvas first - otherwise the refresh would silently discard the shape
	// that was just drawn (the canvas holds the pre-lift pixels, not the shape).
	commitFloatingSelection();
	persistSession();
	if (shouldAutoSaveOnClose()) sidebar.saveCurrentToHistory();
	if (shouldAutoSaveOnClose()) queueLifecycleHistorySnapshot();
});
window.addEventListener('pagehide', () => {
	commitFloatingSelection();
	if (shouldAutoSaveOnClose()) queueLifecycleHistorySnapshot();
}, { once: true });
let historySaveTimer = 0;
window.addEventListener('paint:changed', () => {
	if (!shouldAutoSaveHistory()) return;
	window.clearTimeout(historySaveTimer);
	historySaveTimer = window.setTimeout(() => sidebar.saveCurrentToHistory(), 700);
});

// Default tool, per the brief: Select (not Pencil, unlike real Windows Paint).
// But restore the user's last selected tool if available
const savedTool = restoreToolSelection();
toolManager.setActive(savedTool);
saveToolSelection(savedTool);

// Finish sidebar initialization after globalHistory is ready
(async () => {
	await sidebar.finishInit();
	await sidebar.flushPendingAutoSave();
	restoreHistoryLimit();
	renderSegmentedChoices();
})();

// Click outside the paint area to commit and clear selection
const viewportEl = document.getElementById('canvas-viewport');
document.addEventListener('pointerdown', (event) => {
	const target = event.target instanceof Element ? event.target : null;
	if (target?.closest('.text-object-focus-target')) return;
	const selectedTextId = textSelectionOverlay.getSelectedId?.();
	textSelectionOverlay.clear();
	// A committed text object temporarily activates Select so it can be moved.
	// Clicking elsewhere in the canvas finishes that interaction and returns to
	// Text. Stop the same pointerdown from entering SelectTool and starting a
	// pixel marquee underneath the text affordance.
	if (selectedTextId && target?.closest('#canvas-viewport')) {
		setSelection(null);
		toolManager.setActive('text');
		event.stopPropagation();
	}
}, true);
if (viewportEl) {
	viewportEl.addEventListener('pointerdown', (e) => {
		if (e.target === viewportEl || e.target === stage) {
			commitFloatingSelection();
			setSelection(null);
			textSelectionOverlay.clear();
		}
	});
}

// ---------- Canvas context menu ----------
// Right-click on the paint area opens the menu; the split gesture (clean
// right click vs. right drag) is decided inside the module with the same
// shared threshold ToolManager uses, and every item routes through the
// existing commandRegistry / saveImageAs flows.
const canvasContextMenu = initCanvasContextMenu({
	viewport: viewportEl,
	menu: document.getElementById('canvas-context-menu'),
	execute: (action) => commandRegistry.execute({ action }),
	saveAs: saveImageAs,
	getSelection,
});

// ---------- Clipboard ----------
// One service owns copy/cut/paste for every trigger: the ribbon buttons, the
// custom bindings below, and the browser's native clipboard events.
const clipboardService = createClipboardService({
	clipboardManager,
	routeText: routeTextToTextTool,
	statusBar,
});
clipboardService.attach();

// ---------- Drag and Drop ----------
const imageDropController = createImageDropController({
	insertImageBlob: (file, options) => clipboardManager.insertImageBlob(file, options),
	onImageImported: () => { fileHandle = null; },
});

let editorDestroyed = false;
const destroyEditor = () => {
	if (editorDestroyed) return;
	editorDestroyed = true;
	// Pagehide is normally terminal, but this explicit ownership boundary also
	// makes a future document/tab host safe to dispose without retaining canvas
	// pointer handlers, geometry observers, history Blob URLs, or panel frames.
	historyManager.persistSession();
	dataTagObserver?.disconnect();
	imageDropController.destroy();
	destroySelectionHandleBindings();
	destroyRotateSelectionHandleBinding();
	toolManager.destroy();
	brushCursorOverlay.destroy();
	adjustmentDialog.destroy();
	adjustmentDropdown.destroy();
	adjustmentTargetDropdown.destroy();
	adjustmentMask.destroy();
	canvasResizer.destroy();
	viewportManager.destroy();
	directionEventTarget.removeEventListener('paint:locale-change', refreshCanvasDirectionGeometry);
	hydration.destroy();
	document.documentElement?.removeEventListener('paint:locale-change', browserInfoPanel.refresh);
	document.documentElement?.removeEventListener('paint:locale-change', refreshAboutOnLocaleChange);
	document.documentElement?.removeEventListener('paint:locale-change', refreshReleaseNotesOnLocaleChange);
	window.removeEventListener('paint:ribbon-change', onRibbonChange);
	window.removeEventListener(EVENTS.openAdjustments, openAdjustments);
	ribbonLayoutManager.destroy();
	actionMenuController.destroy();
	canvasContextMenu.destroy();
	backgroundRemovalController.destroy();
	pwaInstallManager.destroy();
	toolbar.destroy();
	browserInfoPanel.destroy();
	checkboxRowController.destroy();
	textSelectionOverlay.destroy();
	textLayerService.destroy();
	historyManager.dispose();
	clipboardService.destroy();
	selectionSettings.destroy();
};

const shouldRestoreLastImage = () => settingsStore.get().restoreLastImage === true;

export { canvasManager, eventBus, statusBar, dialogService, destroyEditor, setPwaUpdateSafetyGuard, shouldRestoreLastImage };
