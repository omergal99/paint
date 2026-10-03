// js/main.js
import { CanvasManager, commitLayerWithSourceOver } from './canvas/CanvasManager.js';
import { ViewportManager } from './canvas/ViewportManager.js';
import { CanvasResizer } from './canvas/CanvasResizer.js';
import { HistoryManager } from './history/HistoryManager.js';
import { ClipboardManager } from './clipboard/ClipboardManager.js';
import { createClipboardService } from './services/clipboard/clipboardService.js';
import { paintSelectionFrame, readSelectionAppearance } from './services/selection/selectionAppearance.js';
import { createSelectionSettings } from './services/selection/selectionSettings.js';
import { ToolManager } from './tools/ToolManager.js';
import { createSelectTool } from './tools/SelectTool.js';
import { appState } from './app/appState.js';
import { router } from './app/router.js';
import { initResizeDialog } from './app/resizeDialog.js';
import { initFileActions } from './app/fileActions.js';
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
import { rotateCanvas, rotateCanvasByAngle, flipCanvas, scaleCanvas } from './utils/transform.js';
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
} from './core/constants.js';
import { createPaintSettingsStore } from './app/settingsStore.js';
import { createShortcutManager, formatShortcut, shortcutFromEvent } from './settings/ShortcutManager.js';
import { createTextDocumentStore } from './document/TextDocumentStore.js';
import { createTextHistoryStore } from './document/TextHistoryStore.js';
import { createTextLayerService } from './document/TextLayerService.js';
import { createTextSelectionOverlay } from './ui/TextSelectionOverlay.js';
import { createTabBar } from './ui/TabBar.js';
import { createSplitView } from './ui/SplitView.js';
import { createWorkspaceStripController } from './ui/WorkspaceStrip.js';
import { createActionMenuController } from './ui/ActionMenuController.js';
import { createDialogSearch } from './ui/DialogSearch.js';
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

// ---------- DOM refs ----------
// Every addressable UI element gets a stable inspection hook. Explicit
// data-tag values remain authoritative; id values provide the safe fallback.
const dataTagCounts = new Map();
const ensureDataTags = (root = document) => {
	const elements = root.matches?.('*') ? [root, ...root.querySelectorAll('*')] : [...(root.querySelectorAll?.('*') || [])];
	elements.forEach((element) => {
		if (element.dataset.tag) return;
		const base = element.id || element.tagName.toLowerCase();
		if (!element.dataset.tag) element.dataset.tag = element.id;
		if (element.id) return;
		const count = (dataTagCounts.get(base) || 0) + 1;
		dataTagCounts.set(base, count);
		element.dataset.tag = `dom-${base}-${count}`;
	});
};
ensureDataTags();
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
const historyManager = new HistoryManager(canvasManager);
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
const sidebar = new Sidebar({ canvasManager, historyManager, statusBar, palette: colorPalette, dialogService, aiConnectionStore });

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
const isFloatingSelection = () => Boolean(canvasManager.floatingCanvas);

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

const drawSelectionOutline = (region) => {
	paintSelectionFrame(canvasManager.octx, region, {
		appearance: readSelectionAppearance(),
		active: isFloatingSelection(),
		preview: selectionPreviewActive,
		zoom: viewportManager.zoom / 100,
	});
}

const getSelection = () => {
	return canvasManager.selection;
}

const updateCropActionState = () => {
	const button = document.getElementById('btn-crop');
	if (!button) return;
	const enabled = Boolean(canvasManager.selection?.w && canvasManager.selection?.h);
	button.disabled = !enabled;
	button.setAttribute('aria-disabled', String(!enabled));
	const label = enabled ? 'Crop to selection' : 'No Selection Area to Crop';
	button.title = label;
	button.setAttribute('aria-label', label);
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
	updateSelectionHandles(region);
	updateCropActionState();
}

updateCropActionState();

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
	});
	return true;
}

const selectionHandles = [...document.querySelectorAll('[data-selection-handle]')];
const rotateSelectionHandle = document.getElementById('selection-rotate');
const selectionActionsBar = document.querySelector('.selection-overlay-actions');
let activeToolName = 'select';
let activeSelectionHandleDragCleanup = null;

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

const stopSelectionHandleDrag = () => {
	const cleanup = activeSelectionHandleDragCleanup;
	activeSelectionHandleDragCleanup = null;
	cleanup?.();
};

const updateSelectionHandles = (region) => {
	const selectionToolActive = activeToolName === 'select';
	// Preview hides every affordance: nothing should suggest the selection can
	// still be dragged while the user is judging the composite.
	const hidden = selectionPreviewActive || !selectionToolActive || !region || !region.w || !region.h;
	selectionHandles.forEach((handle) => {
		handle.hidden = hidden;
	});
	// The rotate + preview pair travels together above the selection.
	if (selectionActionsBar) {
		const actionsVisible = !selectionPreviewActive && selectionToolActive && region && region.w && region.h;
		selectionActionsBar.hidden = !actionsVisible;
		if (actionsVisible) {
			// Centre with a transform, not arithmetic on `offsetWidth`: the bar is
			// `hidden` while previewing, and a hidden element measures 0, so
			// subtracting half of it shifted the rotate handle right when the
			// frame came back.
			selectionActionsBar.style.left = `${region.x + region.w / 2}px`;
			selectionActionsBar.style.top = `${Math.max(0, region.y - 40)}px`;
		}
	}
	if (rotateSelectionHandle) {
		rotateSelectionHandle.hidden = hidden || !document.getElementById('rotate-selection-toggle')?.checked;
	}
	if (hidden) return;
	const points = {
		nw: [region.x, region.y], n: [region.x + region.w / 2, region.y], ne: [region.x + region.w, region.y],
		e: [region.x + region.w, region.y + region.h / 2], se: [region.x + region.w, region.y + region.h],
		s: [region.x + region.w / 2, region.y + region.h], sw: [region.x, region.y + region.h], w: [region.x, region.y + region.h / 2],
	};
	// Half the handle size, so the square's *centre* lands on the corner/edge point.
// The old code hardcoded 4 (half of the 9px default), which centred correctly
// only at that one size: growing the handle in Settings pushed every affordance
// down and right by half the growth. The handle is scaled about its own centre
// by `--zoom-inverse`, so dividing by zoom here would double-correct - the
// layout width is what matters.
const handleHalfSize = () => {
	const raw = getComputedStyle(document.documentElement).getPropertyValue('--selection-handle-size').trim();
	const size = parseFloat(raw);
	return (Number.isFinite(size) ? size : 9) / 2;
};
selectionHandles.forEach((handle) => {
		const [x, y] = points[handle.dataset.selectionHandle];
		const half = handleHalfSize();
		handle.style.left = `${x - half}px`;
		handle.style.top = `${y - half}px`;
	});
}

const bindSelectionHandles = () => {
	const handleBindings = [];
	selectionHandles.forEach((handle) => {
		const onPointerDown = (event) => {
			stopSelectionHandleDrag();
			event.preventDefault();
			event.stopPropagation();
			const original = { ...canvasManager.selection };
			const direction = handle.dataset.selectionHandle;
			const start = viewportManager.clientToImage(event.clientX, event.clientY);
			const fixed = {
				x: direction.includes('w') ? original.x + original.w : original.x,
				y: direction.includes('n') ? original.y + original.h : original.y,
			};
			const onMove = (moveEvent) => {
				const point = viewportManager.clientToImage(moveEvent.clientX, moveEvent.clientY);
				let x = original.x;
				let y = original.y;
				let w = original.w;
				let h = original.h;
				if (direction.includes('e')) w = Math.max(1, Math.round(point.x - original.x));
				if (direction.includes('w')) { w = Math.max(1, Math.round(fixed.x - point.x)); x = fixed.x - w; }
				if (direction.includes('s')) h = Math.max(1, Math.round(point.y - original.y));
				if (direction.includes('n')) { h = Math.max(1, Math.round(fixed.y - point.y)); y = fixed.y - h; }
				// Word-style: hold Shift to keep the aspect ratio while resizing.
				if (moveEvent.shiftKey && w > 0 && h > 0) {
					const ratio = original.w / Math.max(1, original.h);
					if (direction.length === 1) {
						// Edge handle: derive the other dimension from the ratio.
						if (direction === 'e' || direction === 'w') h = Math.max(1, Math.round(w / ratio));
						else w = Math.max(1, Math.round(h * ratio));
					} else {
						// Corner handle: fit the dragged box into the ratio.
						if (w / h > ratio) w = Math.max(1, Math.round(h * ratio));
						else h = Math.max(1, Math.round(w / ratio));
					}
					if (direction.includes('w')) x = fixed.x - w;
					if (direction.includes('n')) y = fixed.y - h;
				}
				if (canvasManager.floatingCanvas) canvasManager.floatingCanvas = scaleCanvas(canvasManager.floatingCanvas, w, h);
				setSelection({ x, y, w, h }, { preview: true });
			};
			let finished = false;
			const cleanup = () => {
				if (finished) return;
				finished = true;
				window.removeEventListener('pointermove', onMove);
				window.removeEventListener('pointerup', onUp);
				window.removeEventListener('pointercancel', onCancel);
				if (activeSelectionHandleDragCleanup === cleanup) activeSelectionHandleDragCleanup = null;
			};
			const onUp = () => {
				cleanup();
				canvasManager.persistToStorage();
			};
			const onCancel = () => cleanup();
			window.addEventListener('pointermove', onMove);
			window.addEventListener('pointerup', onUp, { once: true });
			window.addEventListener('pointercancel', onCancel, { once: true });
			activeSelectionHandleDragCleanup = cleanup;
			void start;
		};
		handle.addEventListener('pointerdown', onPointerDown);
		handleBindings.push(() => handle.removeEventListener('pointerdown', onPointerDown));
	});
	return () => {
		stopSelectionHandleDrag();
		handleBindings.forEach((dispose) => dispose());
	};
}

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
	historyManager.undo();
}
const runRedo = () => {
	historyManager.redo();
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

const TEXT_STYLES_KEY = 'paint:text-styles';
const TEXT_STROKE_WIDTH_KEY = 'paint:text-outline-stroke-width';
const TEXT_STROKE_COLOR_KEY = 'paint:text-outline-stroke-color';
const TEXT_STYLE_NAMES = ['outline', 'black-outline', 'shadow', 'neon', 'bold', 'italic', 'underline'];
let currentTextStrokeWidth = (() => {
	try {
		const value = Number(localStorage.getItem(TEXT_STROKE_WIDTH_KEY));
		return Number.isFinite(value) && value >= 1 && value <= 20 ? value : 2;
	} catch {
		return 2;
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
		currentTextStrokeWidth = Math.max(1, Math.min(20, Number(textStrokeWidthInput.value) || 2));
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
	getFontFamily: () => "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
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
};

// ---------- Tools ----------
const toolManager = new ToolManager({ surface: overlayEl, viewportManager, toolContext, statusBar });
[
	createSelectTool(),
	createPencilTool(),
	createBrushTool(),
	createEraserTool(),
	createFillTool(),
	createShapeTool(),
	createTextTool(),
	createEyedropperTool(),
	createZoomTool(),
	createPanTool(),
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
	selectAll,
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
const destroySelectionHandleBindings = bindSelectionHandles();

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
	updateSelectionHandles(canvasManager.selection);
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
	setLineWidth: (w) => (canvasManager.lineWidth = w),
	setFontSize: (size) => toolContext.setFontSize(size),
	handlers: {
		newFile,
		openFile,
		importFile,
		save,
		saveAs: saveImageAs,
		paste: () => clipboardService.paste(),
		cut: () => clipboardService.cut(),
		copy: () => clipboardService.copy(),
		crop,
		openResizeDialog,
		undo: runUndo,
		redo: runRedo,
		setPrimaryColor: (hex, alpha) => colorPalette.setPrimary(hex, alpha),
	},
});

// Toolbar owns the visual tool state; keep selection handles in sync with it
// so rotate/resize affordances only appear while Select is the active tool.
const toolbarToolChange = toolManager.onToolChange;
toolManager.onToolChange = (name) => {
	activeToolName = name;
	toolbarToolChange?.(name);
	updateSelectionHandles(canvasManager.selection);
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
document.getElementById('history-undo-btn')?.addEventListener('click', runUndo);
document.getElementById('history-redo-btn')?.addEventListener('click', runRedo);
sidebar.setHistoryDeepLinks({ openPreferences: () => openSettingsDialog('history') });
document.getElementById('btn-ai-chat').addEventListener('click', () => sidebar.toggleAi());
document.getElementById('history-settings-link')?.addEventListener('click', () => openSettingsDialog('history'));
// Select All lives in the Image ▸ More menu and in the Image sidebar mirror;
// both reach the same implementation as the Ctrl+A binding.
document.getElementById('btn-select-all')?.addEventListener('click', () => fileActions.selectAll());

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

// ---------- Keyboard shortcuts ----------
const SHORTCUT_TOOL_TARGETS = Object.freeze({
	[SHORTCUT_ACTIONS.selectTool]: 'select',
	[SHORTCUT_ACTIONS.pencilTool]: 'pencil',
	[SHORTCUT_ACTIONS.brushTool]: 'brush',
	[SHORTCUT_ACTIONS.fillTool]: 'fill',
	[SHORTCUT_ACTIONS.eraserTool]: 'eraser',
	[SHORTCUT_ACTIONS.textTool]: 'text',
	[SHORTCUT_ACTIONS.eyedropperTool]: 'eyedropper',
	[SHORTCUT_ACTIONS.zoomTool]: 'zoom',
	[SHORTCUT_ACTIONS.panTool]: 'pan',
});

const SHORTCUT_NUDGE_DELTAS = Object.freeze({
	[SHORTCUT_ACTIONS.nudgeUp]: [0, -1],
	[SHORTCUT_ACTIONS.nudgeDown]: [0, 1],
	[SHORTCUT_ACTIONS.nudgeLeft]: [-1, 0],
	[SHORTCUT_ACTIONS.nudgeRight]: [1, 0],
});

// Only genuine text fields own the browser's native edit-undo stack. Range
// sliders, checkboxes, color wells, and numeric spinners are drawing controls:
// keyboard focus stays on them while the user keeps painting (the canvas
// pointerdown is prevented), so they must never swallow Ctrl/Cmd+Z.
const TEXT_EDITING_INPUT_TYPES = Object.freeze(['text', 'search', 'email', 'url', 'password', 'tel']);
const ownsTextEditing = (element) => element instanceof HTMLTextAreaElement
	|| Boolean(element?.isContentEditable)
	|| (element instanceof HTMLInputElement && TEXT_EDITING_INPUT_TYPES.includes(element.type));

window.addEventListener('keydown', (e) => {
	if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'a') {
		e.preventDefault();
		e.stopPropagation();
		selectAll();
	}
}, true);

window.addEventListener('keydown', (e) => {
	if (e.defaultPrevented) return;
	const tag = document.activeElement?.tagName;
	const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
	const shortcut = shortcutFromEvent(e);
	const action = shortcutManager.resolve(shortcut);
	if (!action) return;
	const activeElement = document.activeElement;
	const editable = activeElement instanceof HTMLTextAreaElement || activeElement?.isContentEditable ||
		(activeElement instanceof HTMLInputElement &&
			!['checkbox', 'radio', 'range', 'color', 'button', 'submit'].includes(activeElement.type));
	const hasTextSelection = editable && typeof activeElement.selectionStart === 'number'
		&& activeElement.selectionStart !== activeElement.selectionEnd;

	if (action === SHORTCUT_ACTIONS.undo || action === SHORTCUT_ACTIONS.redo) {
		if (ownsTextEditing(activeElement)) return;
		e.preventDefault();
		if (action === SHORTCUT_ACTIONS.undo) runUndo();
		else runRedo();
		return;
	}
	if (action === SHORTCUT_ACTIONS.copy || action === SHORTCUT_ACTIONS.cut) {
		if (editable && hasTextSelection) return;
		e.preventDefault();
		// The native copy/cut events route here too, so the keyboard and the
		// ribbon button share one implementation.
		if (action === SHORTCUT_ACTIONS.copy) clipboardService.copy();
		else clipboardService.cut();
		return;
	}
	if (action === SHORTCUT_ACTIONS.paste) {
		// The default Ctrl/Cmd+V stays on the native paste event owned by the
		// clipboard service (no permission prompt, works on Safari). Custom
		// bindings use the explicit clipboard-read fallback while preserving
		// user activation.
		if (shortcutManager.isDefault(action, shortcut) || typing) return;
		e.preventDefault();
		void clipboardService.paste();
		return;
	}
	if (typing) return;
	if (action === SHORTCUT_ACTIONS.save) {
		e.preventDefault();
		save();
		return;
	}
	if (action === SHORTCUT_ACTIONS.open) {
		e.preventDefault();
		openFile();
		return;
	}
	if (action === SHORTCUT_ACTIONS.newFile) {
		e.preventDefault();
		newFile();
		return;
	}
	if (action === SHORTCUT_ACTIONS.deleteSelection) {
		if (deleteSelection()) e.preventDefault();
		return;
	}
	const tool = SHORTCUT_TOOL_TARGETS[action];
	if (tool) {
		e.preventDefault();
		toolManager.setActive(tool);
		return;
	}
	const delta = SHORTCUT_NUDGE_DELTAS[action];
	if (delta && canvasManager.selection?.w && canvasManager.selection?.h) {
		e.preventDefault();
		const step = e.shiftKey ? 10 : 1;
		nudgeSelection(delta[0] * step, delta[1] * step);
	}
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
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', async (e) => {
	e.preventDefault();
	const file = e.dataTransfer?.files?.[0];
	if (file && file.type.startsWith('image/')) {
		const result = await clipboardManager.insertImageBlob(file, {
			sourceLabel: `Dropped ${file.name}`,
		});
		if (result) fileHandle = null;
	}
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
	destroySelectionHandleBindings();
	destroyRotateSelectionHandleBinding();
	toolManager.destroy();
	canvasResizer.destroy();
	viewportManager.destroy();
	directionEventTarget.removeEventListener('paint:locale-change', refreshCanvasDirectionGeometry);
	hydration.destroy();
	document.documentElement?.removeEventListener('paint:locale-change', browserInfoPanel.refresh);
	document.documentElement?.removeEventListener('paint:locale-change', refreshAboutOnLocaleChange);
	document.documentElement?.removeEventListener('paint:locale-change', refreshReleaseNotesOnLocaleChange);
	window.removeEventListener('paint:ribbon-change', onRibbonChange);
	ribbonLayoutManager.destroy();
	actionMenuController.destroy();
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
