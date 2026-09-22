// js/main.js
import { CanvasManager, commitLayerWithSourceOver } from './canvas/CanvasManager.js';
import { ViewportManager } from './canvas/ViewportManager.js';
import { CanvasResizer } from './canvas/CanvasResizer.js';
import { HistoryManager } from './history/HistoryManager.js';
import { ClipboardManager } from './clipboard/ClipboardManager.js';
import { ToolManager } from './tools/ToolManager.js';
import { createSelectTool } from './tools/SelectTool.js';
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
import { PanelLayoutManager } from './ui/PanelLayoutManager.js';
import { createSegmentedChoice } from './ui/SegmentedChoice.js';
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
	HISTORY_VIEWS,
	KEYBOARD_KEYS,
	RIBBON_POSITIONS,
	SHORTCUT_ACTIONS,
	SHORTCUT_DEFINITIONS,
	STORAGE_KEYS,
} from './core/constants.js';
import { createSettingsStore } from './settings/SettingsStore.js';
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
import { createLocaleController } from './i18n/LocaleController.js';
import { t } from './i18n/messages.js';
import { formatUnambiguousDate, formatUnambiguousDateTime } from './utils/datetime.js';
import { createPwaInstallManager } from './pwa/PwaInstallManager.js';
import { assessImageAdmission } from './storage/ImageAdmission.js';
import { createEventBus } from './core/EventBus.js';
import { createBackgroundRemovalService } from './background/BackgroundRemovalProvider.js';
import { createLocalColorKeyProvider } from './background/LocalColorKeyProvider.js';
import { createBackgroundRemovalController } from './background/BackgroundRemovalController.js';
import { createBackgroundMaskEditor } from './background/BackgroundMaskEditor.js';
import { createPaintDocument } from './core/DocumentContract.js';
import { createSessionService } from './session/SessionService.js';

// ---------- DOM refs ----------
// Every addressable UI element gets a stable inspection hook. Explicit
// data-tag values remain authoritative; id values provide the safe fallback.
const ensureDataTags = (root = document) => {
	root.querySelectorAll?.('[id]').forEach((element) => {
		if (!element.dataset.tag) element.dataset.tag = element.id;
	});
};
ensureDataTags();

const isEmbeddedPaint = new URLSearchParams(globalThis.location?.search || '').get('embedded') === '1';
document.documentElement.classList.toggle('embedded-paint-app', isEmbeddedPaint);

const stage = document.getElementById('canvas-stage');
const canvasEl = document.getElementById('paint-canvas');
const overlayEl = document.getElementById('overlay-canvas');
const scaleEl = document.getElementById('canvas-scale');
const dialogService = createDialogService({
	dialog: document.getElementById('app-dialog'),
	title: document.getElementById('app-dialog-title'),
	message: document.getElementById('app-dialog-message'),
	input: document.getElementById('app-dialog-input'),
	confirmButton: document.getElementById('app-dialog-confirm'),
	cancelButton: document.getElementById('app-dialog-cancel'),
	form: document.getElementById('app-dialog-form'),
});

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
	button.innerHTML = `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="${collapsed ? 'M14 4l-8 6 8 6' : 'M6 4l8 6-8 6'}" /></svg>`;
	button.setAttribute('aria-expanded', String(!collapsed));
	button.title = collapsed ? 'Expand color inspector' : 'Collapse color inspector';
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

const aiConnectionStore = createAiConnectionStore();
const sidebar = new Sidebar({ canvasManager, historyManager, statusBar, palette: colorPalette, dialogService, aiConnectionStore });

// ---------- Selection state + overlay drawing ----------
const drawSelectionOutline = (region) => {
	const g = canvasManager.octx;
	g.save();
	g.strokeStyle = '#0078d4';
	g.lineWidth = 1;
	g.setLineDash([4, 3]);
	g.strokeRect(region.x + 0.5, region.y + 0.5, region.w, region.h);
	g.restore();
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

let selectionRotation = null;
const sameRegion = (a, b) => {
	return a && b && ['x', 'y', 'w', 'h'].every((key) => a[key] === b[key]);
}
const sameRotationCenter = (a, b) => {
	if (!a || !b) return false;
	return Math.abs((a.x + a.w / 2) - (b.x + b.w / 2)) < 0.5
		&& Math.abs((a.y + a.h / 2) - (b.y + b.h / 2)) < 0.5;
}

const setSelection = (region, opts = {}) => {
	// Quarter-turn rotations legitimately swap the selection dimensions. Keep
	// the original pixel snapshot while the center remains anchored, otherwise
	// the next rotation would use an already fitted/shrunk result as its base.
	if (selectionRotation && !sameRegion(selectionRotation.selection, region)
		&& !sameRotationCenter(selectionRotation.selection, region)) selectionRotation = null;
	canvasManager.selection = region;
	statusBar.setSelection(region);
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
	const maxX = Math.max(0, canvasManager.width - width);
	const maxY = Math.max(0, canvasManager.height - height);
	setSelection({
		x: Math.max(0, Math.min(maxX, selection.x + dx)),
		y: Math.max(0, Math.min(maxY, selection.y + dy)),
		w: width,
		h: height,
	});
	return true;
}

const selectionHandles = [...document.querySelectorAll('[data-selection-handle]')];
const rotateSelectionHandle = document.getElementById('selection-rotate');
let activeToolName = 'select';
let activeSelectionHandleDragCleanup = null;
let activeSelectionRotationDragCleanup = null;

const stopSelectionHandleDrag = () => {
	const cleanup = activeSelectionHandleDragCleanup;
	activeSelectionHandleDragCleanup = null;
	cleanup?.();
};

const stopSelectionRotationDrag = () => {
	const cleanup = activeSelectionRotationDragCleanup;
	activeSelectionRotationDragCleanup = null;
	cleanup?.();
};

const updateSelectionHandles = (region) => {
	const selectionToolActive = activeToolName === 'select';
	selectionHandles.forEach((handle) => {
		handle.hidden = !selectionToolActive || !region || !region.w || !region.h;
	});
	if (rotateSelectionHandle) {
		const enabled = document.getElementById('rotate-selection-toggle')?.checked === true;
		rotateSelectionHandle.hidden = !selectionToolActive || !enabled || !region || !region.w || !region.h;
		if (region?.w && region?.h) {
			rotateSelectionHandle.style.left = `${region.x + region.w / 2 - 12}px`;
			rotateSelectionHandle.style.top = `${Math.max(0, region.y - 28)}px`;
		}
	}
	if (!region || !region.w || !region.h) return;
	const points = {
		nw: [region.x, region.y], n: [region.x + region.w / 2, region.y], ne: [region.x + region.w, region.y],
		e: [region.x + region.w, region.y + region.h / 2], se: [region.x + region.w, region.y + region.h],
		s: [region.x + region.w / 2, region.y + region.h], sw: [region.x, region.y + region.h], w: [region.x, region.y + region.h / 2],
	};
	selectionHandles.forEach((handle) => {
		const [x, y] = points[handle.dataset.selectionHandle];
		handle.style.left = `${x - 4}px`;
		handle.style.top = `${y - 4}px`;
	});
}

const bindSelectionHandles = () => {
	const handleBindings = [];
	selectionHandles.forEach((handle) => {
		const onPointerDown = (event) => {
			stopSelectionHandleDrag();
			event.preventDefault();
			event.stopPropagation();
			historyManager.snapshot();
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
		selectionRotation = null;
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
		selectionRotation = null;
		setSelection(null);
	}
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
const TEXT_STYLE_NAMES = ['outline', 'black-outline', 'shadow', 'neon', 'bold', 'italic', 'underline'];
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
};

const clipboardManager = new ClipboardManager({
	canvasManager,
	historyManager,
	getSelection,
	setSelection,
	statusBar,
	setActiveTool: (name) => toolManager.setActive(name),
	commitFloatingSelection,
});

// ---------- File operations ----------
let fileHandle = null;
const fileInput = document.getElementById('file-input');

const persistSession = () => {
	canvasManager.persistToStorage();
}

const canvasToPngBlob = (source) => new Promise((resolve) => {
		if (typeof source?.toBlob !== 'function') return resolve(null);
		source.toBlob((blob) => resolve(blob || null), 'image/png');
});

const getBackgroundRemovalInput = async () => {
	const region = canvasManager.selection?.w && canvasManager.selection?.h
		? { ...canvasManager.selection }
		: null;
	const target = canvasManager.floatingCanvas ? 'floating' : (region ? 'selection' : 'canvas');
	const source = canvasManager.floatingCanvas
		? canvasManager.floatingCanvas
		: (region ? canvasManager.extractRegion(region) : canvasManager.createCompositeCanvas());
	const blob = await canvasToPngBlob(source);
	if (!blob) throw new Error('This browser could not prepare the image preview.');
	return { blob, region, target };
};

const backgroundMaskEditor = createBackgroundMaskEditor({
	root: document.getElementById('background-removal-preview-stage'),
	overlay: document.getElementById('background-removal-mask-overlay'),
});

const applyBackgroundRemovalResult = async (result) => {
	historyManager.snapshot({ force: true });
	if (result?.target === 'floating' && canvasManager.floatingCanvas && typeof createImageBitmap === 'function') {
		let bitmap = null;
		try {
			// A pasted selection is a temporary layer and is not part of the
			// snapshot stream. Commit it only after Apply (the snapshot above still
			// represents the pre-Apply document), then replace its region with the
			// processed output so undo remains reliable.
			const region = result.region || canvasManager.selection;
			if (!region) return false;
			commitFloatingPixels(region);
			canvasManager.floatingCanvas = null;
			canvasManager.flattenLayers();
			bitmap = await createImageBitmap(result.imageBlob);
			canvasManager.fillRegion(region, canvasManager.backgroundColor);
			canvasManager.ctx.drawImage(bitmap, region.x, region.y, region.w, region.h);
			canvasManager.clearOverlay();
			setSelection(null);
			canvasManager.markDocumentDirty();
			persistSession();
			statusBar.flash('Background preview applied to the active selection');
			return true;
		} catch {
			return false;
		} finally {
			bitmap?.close?.();
		}
	}
	// The preview is composed from raster and text layers. Flatten only after
	// Apply so cancelling never changes the working document.
	canvasManager.flattenLayers();
	if (!result?.region) {
		const loaded = await canvasManager.loadImageBlob(result.imageBlob, result.width, result.height);
		if (loaded) persistSession();
		return loaded;
	}
	if (typeof createImageBitmap !== 'function') return false;
	let bitmap = null;
	try {
		bitmap = await createImageBitmap(result.imageBlob);
		canvasManager.fillRegion(result.region, canvasManager.backgroundColor);
		canvasManager.ctx.drawImage(bitmap, result.region.x, result.region.y, result.region.w, result.region.h);
		canvasManager.clearOverlay();
		setSelection(null);
		canvasManager.markDocumentDirty();
		persistSession();
		return true;
	} catch {
		return false;
	} finally {
		bitmap?.close?.();
	}
};

const backgroundRemovalController = createBackgroundRemovalController({
	dialog: document.getElementById('background-removal-dialog'),
	message: document.getElementById('background-removal-message'),
	phase: document.getElementById('background-removal-phase'),
	progress: document.getElementById('background-removal-progress'),
	preview: document.getElementById('background-removal-preview'),
	applyButton: document.getElementById('background-removal-apply'),
	cancelButton: document.getElementById('background-removal-cancel'),
	closeButton: document.getElementById('background-removal-close'),
	previewButton: document.getElementById('background-removal-preview-button'),
	service: backgroundRemovalService,
	getInput: getBackgroundRemovalInput,
	getOptions: () => ({
		tolerance: Number(document.getElementById('background-removal-tolerance')?.value || 30),
		backgroundColor: document.getElementById('background-removal-color')?.value || '#ffffff',
		mode: document.getElementById('background-removal-mode')?.value || 'color-key',
		edgeSoftness: Number(document.getElementById('background-removal-softness')?.value || 25),
		...backgroundMaskEditor.getRegions(),
	}),
	applyResult: applyBackgroundRemovalResult,
	onOpen: () => backgroundMaskEditor.clear(),
	onClose: () => backgroundMaskEditor.clear(),
});

document.getElementById('background-removal-tolerance')?.addEventListener('input', (event) => {
	const value = document.getElementById('background-removal-tolerance-value');
	if (value) value.value = event.target.value;
	if (value) value.textContent = event.target.value;
});
document.getElementById('background-removal-softness')?.addEventListener('input', (event) => {
	const value = document.getElementById('background-removal-softness-value');
	if (value) value.textContent = event.target.value;
});
document.getElementById('background-removal-sample')?.addEventListener('click', () => {
	const source = canvasManager.floatingCanvas || canvasManager.canvas;
	try {
		const pixel = source?.getContext?.('2d', { willReadFrequently: true })?.getImageData(0, 0, 1, 1)?.data;
		if (!pixel || pixel[3] === 0) return;
		const hex = [...pixel.slice(0, 3)].map((channel) => Number(channel).toString(16).padStart(2, '0')).join('');
		const color = document.getElementById('background-removal-color');
		if (color) color.value = `#${hex}`;
	} catch {
		statusBar.flash('Could not sample the source color');
	}
});
const setBackgroundMaskTool = (tool) => {
	backgroundMaskEditor.setTool(tool);
	document.getElementById('background-removal-keep')?.setAttribute('aria-pressed', String(tool === 'keep'));
	document.getElementById('background-removal-remove')?.setAttribute('aria-pressed', String(tool === 'remove'));
};
document.getElementById('background-removal-keep')?.addEventListener('click', () => setBackgroundMaskTool('keep'));
document.getElementById('background-removal-remove')?.addEventListener('click', () => setBackgroundMaskTool('remove'));
document.getElementById('background-removal-clear-mask')?.addEventListener('click', () => backgroundMaskEditor.clear());
document.getElementById('background-removal-expand')?.addEventListener('click', (event) => {
	const dialog = document.getElementById('background-removal-dialog');
	const expanded = dialog?.classList.toggle('is-expanded') === true;
	event.currentTarget.setAttribute('aria-pressed', String(expanded));
	event.currentTarget.textContent = expanded ? 'Compact' : 'Expand';
});
document.getElementById('background-removal-zoom')?.addEventListener('input', (event) => {
	const scale = Math.max(0.5, Number(event.target.value) / 100);
	const stage = document.getElementById('background-removal-preview-stage');
	if (stage) stage.style.setProperty('--background-preview-scale', String(scale));
});

const selectAll = () => {
	setSelection({ x: 0, y: 0, w: canvasManager.width, h: canvasManager.height });
}

const deleteSelection = () => {
	const sel = getSelection();
	if (!sel || !sel.w || !sel.h) return false;
	if (canvasManager.floatingCanvas) {
		canvasManager.floatingCanvas = null;
		setSelection(null);
	} else {
		historyManager.snapshot();
		canvasManager.fillRegion(sel, canvasManager.backgroundColor);
		setSelection(null);
	}
	persistSession();
	statusBar.flash('Deleted selection');
	return true;
}

const newFile = () => {
	if (shouldAutoSaveOnNew()) {
		void doNewFile();
		return;
	}
	const dialog = document.getElementById('new-file-dialog');
	const button = document.getElementById('btn-new').getBoundingClientRect();
	dialog.style.left = '';
	dialog.style.right = '';
	if (document.documentElement?.dir === 'rtl') {
		dialog.style.right = `${Math.max(12, Math.round(window.innerWidth - button.right))}px`;
	} else {
		dialog.style.left = `${Math.max(12, Math.round(button.left))}px`;
	}
	dialog.style.top = `${Math.round(button.bottom + 8)}px`;
	dialog.showModal();
	setDialogUrl('new');
	document.getElementById('new-file-ok')?.focus();
}

const doNewFile = async () => {
	const { width, height } = getDefaultCanvasSize();
	const admission = assessImageAdmission({ width, height });
	if (!admission.ok) {
		statusBar.flash(admission.message);
		return;
	}
	if (shouldAutoSaveOnNew()) await sidebar.saveCurrentToHistory();
	else if (shouldAutoSaveHistory()) await sidebar.saveCurrentToHistory();
	discardFloatingSelection();
	historyManager.clear();
	fileHandle = null;
	canvasManager.loadFromSource(makeBlankSource(width, height));
	setSelection(null);
	persistSession();
	document.getElementById('new-file-dialog').close();
	if (new URLSearchParams(window.location.search).get('dialog') === 'new') setDialogUrl(null);
}

const makeBlankSource = (w, h) => {
	const c = document.createElement('canvas');
	c.width = w;
	c.height = h;
	const ctx = c.getContext('2d');
	if (canvasManager.backgroundMode !== 'transparent') {
		ctx.fillStyle = canvasManager.backgroundColor;
		ctx.fillRect(0, 0, w, h);
	} else {
		ctx.clearRect(0, 0, w, h);
	}
	return c;
}

const getDefaultCanvasSize = () => {
	const value = document.getElementById('setting-default-canvas-size')?.value || '800x600';
	const customWidth = Number(document.getElementById('setting-default-canvas-width')?.value);
	const customHeight = Number(document.getElementById('setting-default-canvas-height')?.value);
	const source = value === 'custom' && customWidth > 0 && customHeight > 0
		? `${customWidth}x${customHeight}`
		: value;
	const [width, height] = source.split('x').map(Number);
	return Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0
		? { width, height }
		: { width: 800, height: 600 };
}

const openFile = () => {
	fileInput.dataset.mode = 'open';
	fileInput.click();
}

const importFile = () => {
	fileInput.dataset.mode = 'import';
	fileInput.click();
}

const openImageFile = async (file) => {
	let bitmap = null;
	try {
		bitmap = await createImageBitmap(file);
		const admission = assessImageAdmission({ width: bitmap.width, height: bitmap.height });
		if (!admission.ok) {
			statusBar.flash(admission.message);
			return false;
		}
		discardFloatingSelection();
		historyManager.snapshot();
		if (!canvasManager.loadFromSource(bitmap)) return false;
		fileHandle = null;
		setSelection(null);
		persistSession();
		statusBar.flash(`Opened ${file.name}`);
		return true;
	} catch (error) {
		console.error('Open image failed:', error);
		statusBar.flash('Image could not be decoded');
		return false;
	} finally {
		bitmap?.close?.();
	}
}

const importImageFile = async (file) => {
	const result = await clipboardManager.insertImageBlob(file, {
		sourceLabel: `Imported ${file.name}`,
	});
	if (result) fileHandle = null;
	return result;
}

fileInput.addEventListener('change', async (e) => {
	const file = e.target.files[0];
	const mode = fileInput.dataset.mode || 'open';
	e.target.value = '';
	fileInput.dataset.mode = '';
	if (!file) return;
	try {
		if (mode === 'import') {
			await importImageFile(file);
			return;
		}
		await openImageFile(file);
	} catch (error) {
		console.error('Image import failed:', error);
		statusBar.flash('Image could not be decoded');
	}
});

const save = async () => {
	commitFloatingSelection();
	if (shouldAutoSaveHistory()) sidebar.saveCurrentToHistory();
	if (window.showSaveFilePicker) {
		try {
			if (!fileHandle) {
				fileHandle = await window.showSaveFilePicker({
					suggestedName: 'untitled.png',
					types: [{ description: 'PNG image', accept: { 'image/png': ['.png'] } }],
				});
			}
			const writable = await fileHandle.createWritable();
			const blob = await canvasManager.toBlob('image/png');
			await writable.write(blob);
			await writable.close();
			persistSession();
			statusBar.flash('Saved');
			document.title = 'paint - ' + fileHandle.name;
			showToast('Successfully saved to ' + fileHandle.name, true);
			return;
		} catch (err) {
			if (err.name === 'AbortError') return;
			console.warn('File System Access save failed, falling back to download:', err);
		}
	}
	await downloadPNG();
}

const downloadPNG = async () => {
	const blob = await canvasManager.toBlob('image/png');
	if (!(blob instanceof Blob) || !globalThis.URL?.createObjectURL) {
		statusBar.flash('PNG download could not be prepared');
		return false;
	}
	const url = URL.createObjectURL(blob);
	try {
		const a = document.createElement('a');
		a.href = url;
		a.download = 'untitled.png';
		a.click();
		statusBar.flash('Downloaded as PNG');
		document.title = 'paint - untitled.png';
		showToast('Successfully downloaded untitled.png', true);
		return true;
	} finally {
		window.setTimeout(() => URL.revokeObjectURL(url), 0);
	}
}

const showToast = (msg, success = true) => {
	const toast = document.createElement('div');
	toast.className = 'toast ' + (success ? 'toast-success' : 'toast-error');
	toast.textContent = msg;
	document.body.appendChild(toast);
	setTimeout(() => {
		toast.classList.add('hide');
		setTimeout(() => toast.remove(), 300);
	}, 3000);
}

const crop = () => {
	const sel = getSelection();
	if (!sel || !sel.w || !sel.h) {
		statusBar.flash('Select an area first');
		return;
	}
	if (canvasManager.floatingCanvas) {
		commitFloatingPixels(sel);
		canvasManager.floatingCanvas = null;
	}
	canvasManager.flattenLayers();
	historyManager.snapshot();
	const region = canvasManager.extractRegion(sel);
	canvasManager.loadFromSource(region);
	setSelection(null);
	persistSession();
}

// ---------- Transformations ----------
const applyTransformation = (transformFn) => {
	// A menu transform starts a new operation; do not use a previous rotate
	// handle's base canvas for it.
	selectionRotation = null;
	canvasManager.flattenLayers();
	historyManager.snapshot();
	const selection = canvasManager.selection;
	if (selection && !canvasManager.floatingCanvas) {
		canvasManager.floatingCanvas = canvasManager.extractRegion(selection);
		canvasManager.fillRegion(selection, canvasManager.backgroundColor);
	}
	if (canvasManager.floatingCanvas && canvasManager.selection) {
		const newCanvas = transformFn(canvasManager.floatingCanvas);
		canvasManager.floatingCanvas = newCanvas;

		// Update selection region to match new dimensions
		const sel = canvasManager.selection;
		const cx = sel.x + sel.w / 2;
		const cy = sel.y + sel.h / 2;
		const nw = newCanvas.width;
		const nh = newCanvas.height;

		setSelection({
			x: cx - nw / 2,
			y: cy - nh / 2,
			w: nw,
			h: nh
		});
	} else {
		// Transform entire canvas
		const newCanvas = transformFn(canvasManager.canvas);
		canvasManager.loadFromSource(newCanvas);
	}
	persistSession();
}

const actionMenuController = createActionMenuController({ root: document });
actionMenuController.bind();
document.getElementById('btn-rotate-90').addEventListener('click', () => applyTransformation(c => rotateCanvas(c, 1)));
document.getElementById('btn-rotate-180').addEventListener('click', () => applyTransformation(c => rotateCanvas(c, 2)));
document.getElementById('btn-rotate-270').addEventListener('click', () => applyTransformation(c => rotateCanvas(c, 3)));
document.getElementById('btn-rotate-free').addEventListener('click', async () => {
	const value = await dialogService.prompt({
		title: t('ui.freeRotate'),
		message: t('ui.freeRotatePrompt'),
		value: '15',
		type: 'number',
		confirmLabel: t('ui.rotate'),
	});
	const degrees = Number.parseFloat(value);
	if (Number.isFinite(degrees)) applyTransformation(c => rotateCanvasByAngle(c, degrees));
});
document.getElementById('btn-flip-horizontal').addEventListener('click', () => applyTransformation(c => flipCanvas(c, true)));
document.getElementById('btn-flip-vertical').addEventListener('click', () => applyTransformation(c => flipCanvas(c, false)));
document.getElementById('btn-crop').addEventListener('click', crop);
document.getElementById('btn-remove-bg').addEventListener('click', () => { void backgroundRemovalController.open(); });
const bindRotateSelectionHandle = () => {
	if (!rotateSelectionHandle) return () => {};
	const onClick = (event) => {
		event.preventDefault();
		event.stopPropagation();
		if (rotateSelectionHandle._dragged) {
			rotateSelectionHandle._dragged = false;
			return;
		}
		if (document.getElementById('rotate-selection-toggle')?.checked) {
			rotateSelectionByAngle(90, { prepared: rotateSelectionHandle._rotationPrepared === true });
			rotateSelectionHandle._rotationPrepared = false;
		}
	};
	const onPointerDown = (event) => {
		if (activeToolName !== 'select' || !document.getElementById('rotate-selection-toggle')?.checked || !canvasManager.selection) return;
		stopSelectionRotationDrag();
		event.preventDefault();
		event.stopPropagation();
		const originalSelection = { ...canvasManager.selection };
		historyManager.snapshot();
		if (!canvasManager.floatingCanvas) {
			canvasManager.floatingCanvas = canvasManager.extractRegion(originalSelection);
			canvasManager.fillRegion(originalSelection, canvasManager.backgroundColor);
			setSelection(originalSelection);
		}
		const rotationState = beginSelectionRotation(originalSelection);
		const startDegrees = rotationState.degrees;
		rotateSelectionHandle._rotationPrepared = true;
		const center = { x: originalSelection.x + originalSelection.w / 2, y: originalSelection.y + originalSelection.h / 2 };
		const startPoint = viewportManager.clientToImage(event.clientX, event.clientY);
		const startAngle = Math.atan2(startPoint.y - center.y, startPoint.x - center.x);
		let moved = false;
		const onMove = (moveEvent) => {
			const point = viewportManager.clientToImage(moveEvent.clientX, moveEvent.clientY);
			const angle = Math.atan2(point.y - center.y, point.x - center.x);
			const degrees = snapRotation(startDegrees + (angle - startAngle) * 180 / Math.PI);
			if (Math.abs(degrees - startDegrees) > 1) moved = true;
			rotationState.degrees = degrees;
			const rendered = renderSelectionRotation(rotationState);
			canvasManager.floatingCanvas = rendered.canvas;
			setSelection(rendered.region);
		};
		let finished = false;
		const cleanup = () => {
			if (finished) return;
			finished = true;
			window.removeEventListener('pointermove', onMove);
			window.removeEventListener('pointerup', onUp);
			window.removeEventListener('pointercancel', onCancel);
			if (activeSelectionRotationDragCleanup === cleanup) activeSelectionRotationDragCleanup = null;
		};
		const onUp = () => {
			cleanup();
			if (moved) {
				rotateSelectionHandle._dragged = true;
				rotateSelectionHandle._rotationPrepared = false;
				canvasManager.persistToStorage();
			}
		};
		const onCancel = () => cleanup();
		window.addEventListener('pointermove', onMove);
		window.addEventListener('pointerup', onUp, { once: true });
		window.addEventListener('pointercancel', onCancel, { once: true });
		activeSelectionRotationDragCleanup = cleanup;
	};
	rotateSelectionHandle.addEventListener('click', onClick);
	rotateSelectionHandle.addEventListener('pointerdown', onPointerDown);
	return () => {
		stopSelectionRotationDrag();
		rotateSelectionHandle.removeEventListener('click', onClick);
		rotateSelectionHandle.removeEventListener('pointerdown', onPointerDown);
	};
};
const destroyRotateSelectionHandleBinding = bindRotateSelectionHandle();

const rotateSelectionByAngle = (degrees, { prepared = false } = {}) => {
	const selection = canvasManager.selection;
	if (!selection?.w || !selection?.h) return;
	if (!prepared) historyManager.snapshot();
	if (!prepared && !canvasManager.floatingCanvas) {
		canvasManager.floatingCanvas = canvasManager.extractRegion(selection);
		canvasManager.fillRegion(selection, canvasManager.backgroundColor);
	}
	const rotationState = beginSelectionRotation(selection);
	rotationState.degrees += degrees;
	rotationState.degrees = snapRotation(rotationState.degrees);
	const rendered = renderSelectionRotation(rotationState);
	canvasManager.floatingCanvas = rendered.canvas;
	setSelection(rendered.region);
	persistSession();
}

const beginSelectionRotation = (selection) => {
	if (!canvasManager.floatingCanvas) return null;
	if (!selectionRotation || !sameRotationCenter(selectionRotation.selection, selection)) {
		selectionRotation = {
			baseCanvas: scaleCanvas(canvasManager.floatingCanvas, canvasManager.floatingCanvas.width, canvasManager.floatingCanvas.height),
			selection: { ...selection },
			center: { x: selection.x + selection.w / 2, y: selection.y + selection.h / 2 },
			degrees: 0,
		};
	}
	return selectionRotation;
}

const snapRotation = (degrees) => {
	const quarterTurn = Math.round(degrees / 90) * 90;
	return Math.abs(degrees - quarterTurn) < 0.75 ? quarterTurn : degrees;
}

const renderSelectionRotation = (rotationState) => {
	const { center, degrees, baseCanvas } = rotationState;
	const quarterTurn = Math.round(degrees / 90) * 90;
	// Always rotate the untouched source at its natural size. Fitting an
	// already-rotated canvas into the old rectangle changes the shape's scale
	// and can clip its corners. The resulting canvas is the true rotated
	// bounding box, so the selection travels with the pixels.
	const canvas = rotateCanvasByAngle(baseCanvas, degrees);
	return {
		canvas,
		region: {
			x: center.x - canvas.width / 2,
			y: center.y - canvas.height / 2,
			w: canvas.width,
			h: canvas.height,
		},
	};
}
const destroySelectionHandleBindings = bindSelectionHandles();

document.querySelector('.shape-gallery')?.addEventListener('click', (event) => event.stopPropagation());
document.querySelector('.text-tool-menu-items')?.addEventListener('click', (event) => event.stopPropagation());

// Native dialogs do not close on backdrop clicks by default. Keep the modal
// interactions lightweight and predictable, like the ribbon menus.
document.querySelectorAll('dialog').forEach((dialog) => dialog.addEventListener('click', (event) => {
	if (event.target === dialog) dialog.close();
}));

// ---------- Resize-canvas dialog ----------
const resizeDialog = document.getElementById('resize-dialog');
const resizeWidthInput = document.getElementById('resize-width');
const resizeHeightInput = document.getElementById('resize-height');
const resizePercentInput = document.getElementById('resize-percent');
const resizeTargetStatus = document.getElementById('resize-target-status');
const keepAspectInput = document.getElementById('resize-keep-aspect');
let aspectRatio = 1;
let resizeTarget = { kind: 'canvas', x: 0, y: 0, width: 800, height: 600 };

const activeResizeTarget = () => {
	const selection = canvasManager.selection;
	if (selection?.w > 0 && selection?.h > 0) {
		return {
			kind: 'selection',
			x: selection.x,
			y: selection.y,
			width: selection.w,
			height: selection.h,
		};
	}
	return { kind: 'canvas', x: 0, y: 0, width: canvasManager.width, height: canvasManager.height };
}

const syncResizePercent = () => {
	if (!resizePercentInput || !resizeTarget.width) return;
	const width = Number(resizeWidthInput.value);
	resizePercentInput.value = String(Math.max(1, Math.round((width / resizeTarget.width) * 100)));
}

const setResizeTargetFields = () => {
	resizeWidthInput.value = resizeTarget.width;
	resizeHeightInput.value = resizeTarget.height;
	aspectRatio = resizeTarget.width / Math.max(1, resizeTarget.height);
	keepAspectInput.checked = true;
	resizePercentInput.value = '100';
	if (resizeTargetStatus) {
		resizeTargetStatus.textContent = resizeTarget.kind === 'selection'
			? `Selection ${resizeTarget.width} × ${resizeTarget.height}px`
			: 'Whole canvas';
	}
}

const openResizeDialog = () => {
	resizeTarget = activeResizeTarget();
	setResizeTargetFields();
	resizeDialog.showModal();
	setDialogUrl('resize');
}

document.querySelectorAll('[data-resize-preset]').forEach((button) => {
	button.addEventListener('click', () => {
		const [width, height] = button.dataset.resizePreset.split('x').map(Number);
		resizeWidthInput.value = width;
		resizeHeightInput.value = height;
		syncResizePercent();
		document.querySelectorAll('[data-resize-preset]').forEach((item) => item.classList.toggle('selected', item === button));
	});
});

resizeWidthInput.addEventListener('input', () => {
	if (keepAspectInput.checked) resizeHeightInput.value = Math.round(resizeWidthInput.value / aspectRatio);
	syncResizePercent();
});
resizeHeightInput.addEventListener('input', () => {
	if (keepAspectInput.checked) resizeWidthInput.value = Math.round(resizeHeightInput.value * aspectRatio);
	syncResizePercent();
});
resizePercentInput.addEventListener('input', () => {
	const percent = Math.max(1, Math.min(1000, Number(resizePercentInput.value) || 100));
	resizePercentInput.value = String(percent);
	resizeWidthInput.value = Math.max(1, Math.round(resizeTarget.width * percent / 100));
	resizeHeightInput.value = Math.max(1, Math.round(resizeTarget.height * percent / 100));
});

document.getElementById('resize-cancel').addEventListener('click', () => resizeDialog.close());
resizeDialog.addEventListener('close', () => {
	if (new URLSearchParams(window.location.search).get('dialog') === 'resize') setDialogUrl(null);
});
document.getElementById('resize-form').addEventListener('submit', () => {
	const w = parseInt(resizeWidthInput.value, 10);
	const h = parseInt(resizeHeightInput.value, 10);
	if (w > 0 && h > 0) {
		const requiredWidth = resizeTarget.kind === 'selection'
			? Math.max(canvasManager.width, resizeTarget.x + w)
			: w;
		const requiredHeight = resizeTarget.kind === 'selection'
			? Math.max(canvasManager.height, resizeTarget.y + h)
			: h;
		const admission = assessImageAdmission({
			width: w,
			height: h,
			targetWidth: requiredWidth,
			targetHeight: requiredHeight,
		});
		if (!admission.ok) {
			statusBar.flash(admission.message);
			return;
		}
		historyManager.snapshot();
		if (resizeTarget.kind === 'selection') {
			const source = canvasManager.floatingCanvas || canvasManager.extractRegion({
				x: resizeTarget.x,
				y: resizeTarget.y,
				w: resizeTarget.width,
				h: resizeTarget.height,
			});
			if (!canvasManager.floatingCanvas) {
				canvasManager.fillRegion({
					x: resizeTarget.x,
					y: resizeTarget.y,
					w: resizeTarget.width,
					h: resizeTarget.height,
				}, canvasManager.backgroundColor);
				canvasManager.floatingCanvas = source;
			}
			if (requiredWidth !== canvasManager.width || requiredHeight !== canvasManager.height) {
				if (!canvasManager.resize(requiredWidth, requiredHeight)) return;
			}
			canvasManager.floatingCanvas = scaleCanvas(source, w, h);
			setSelection({ x: resizeTarget.x, y: resizeTarget.y, w, h });
		} else {
			commitFloatingSelection();
			if (!canvasManager.resize(w, h)) return;
		}
		persistSession();
	}
});

// ---------- Settings dialog ----------
const settingsDialog = document.getElementById('settings-dialog');
const dmCheckbox = document.getElementById('setting-dark-mode');
const sbCheckbox = document.getElementById('setting-show-status-bar');
const ciCheckbox = document.getElementById('setting-show-color-inspector');
const aiCheckbox = document.getElementById('setting-show-ai-chat');
const directionSelect = document.getElementById('setting-direction');
const bgSelect = document.getElementById('setting-canvas-bg');
const solidBackgroundColorInput = document.getElementById('setting-solid-background-color');
const defaultCanvasSizeSelect = document.getElementById('setting-default-canvas-size');
const defaultCanvasWidthInput = document.getElementById('setting-default-canvas-width');
const defaultCanvasHeightInput = document.getElementById('setting-default-canvas-height');
const defaultZoomSelect = document.getElementById('setting-default-zoom');
const defaultZoomCustomInput = document.getElementById('setting-default-zoom-custom');
const SETTINGS_KEY = STORAGE_KEYS.settings;
const settingsStore = createSettingsStore({
	storage: globalThis.localStorage,
	key: SETTINGS_KEY,
	defaults: DEFAULT_SETTINGS,
	validators: {
		canvasBackground: (value) => ['none', 'solid', 'transparent', 'checkerboard', 'grid'].includes(value),
		solidBackgroundColor: (value) => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value),
		defaultZoom: (value) => Number.isFinite(Number(value)) && Number(value) > 0,
		interfaceDirection: (value) => ['auto', 'ltr', 'rtl'].includes(value),
		historyAutoSaveMode: (value) => ['all', 'close', 'lifecycle'].includes(value),
	},
});
const shortcutManager = createShortcutManager({ bindings: settingsStore.get().shortcuts });
settingsStore.subscribe((state) => shortcutManager.replace(state.shortcuts));
const settingsRegistry = createSettingsRegistry();
settingsRegistry.registerStorageKey(STORAGE_KEYS.textHistory);
settingsRegistry.registerStorageKey(STORAGE_KEYS.settingsTab);
settingsRegistry.registerResetHandler(() => colorPalette.resetToDefaults());
settingsRegistry.registerResetHandler(() => sidebar.resetSettings());
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

const setDialogUrl = (dialog, extra = {}) => {
	const params = new URLSearchParams(window.location.search);
	if (dialog) params.set('dialog', dialog);
	else {
		params.delete('dialog');
		params.delete('tab');
	}
	if (dialog !== 'settings') params.delete('tab');
	Object.entries(extra).forEach(([key, value]) => {
		if (value) params.set(key, value);
		else params.delete(key);
	});
	const query = params.toString();
	window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`);
}

const settingsDialogController = createSettingsDialog({
	dialog: settingsDialog,
	tabs: document.querySelectorAll('[data-settings-tab]'),
	panels: document.querySelectorAll('[data-settings-panel]'),
	onChange: (tab) => {
		try { localStorage.setItem(STORAGE_KEYS.settingsTab, tab); } catch {}
		if (tab === 'about') updateAboutStats();
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

const getLastSettingsTab = () => {
	try {
		return localStorage.getItem(STORAGE_KEYS.settingsTab) || 'general';
	} catch {
		return 'general';
	}
};

const pwaInstallManager = createPwaInstallManager({
	installButton: document.getElementById('pwa-install-button'),
	statusEl: document.getElementById('pwa-install-status'),
	updateButton: document.getElementById('pwa-update-button'),
	offlineButton: document.getElementById('pwa-offline-button'),
	offlineStatusEl: document.getElementById('pwa-offline-status'),
	translate: (key, fallback) => localeController.i18n.t(key) || fallback,
	canReload: () => !document.querySelector('.text-editor-shell') && !canvasManager.floatingCanvas,
	requireReloadGuard: true,
});
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

const segmentedChoices = [...document.querySelectorAll('.choice-summary')].map((root) => createSegmentedChoice({
	root,
	select: document.getElementById(root.dataset.selectId),
}));
const renderSegmentedChoices = () => { segmentedChoices.forEach((choice) => choice.render()); }
document.documentElement?.addEventListener('paint:locale-change', renderSegmentedChoices);

const readSettings = () => {
	return settingsStore.get();
}

const getRibbonGroupKey = (groupSection) => groupSection?.dataset.ribbonKey
	|| [...(groupSection?.classList || [])].find((name) => name.startsWith('ribbon-group-'))?.slice('ribbon-group-'.length)
	|| groupSection?.querySelector('.ribbon-group-title')?.textContent.trim();

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
			restoreLastImage: document.getElementById('setting-restore-last-image')?.checked === true,
			ribbonLayout: { ...ribbonLayoutManager.state },
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

const syncHistoryControls = (saved) => {
	const prefs = saved
		? { autoSave: saved.historyAutoSave !== false, mode: saved.historyAutoSaveMode === 'close' ? 'lifecycle' : (saved.historyAutoSaveMode || 'lifecycle') }
		: getHistoryPrefs();
	const t1 = document.getElementById('history-auto-save-toggle');
	const t2 = document.getElementById('setting-history-auto-save');
	const m = document.getElementById('setting-history-auto-save-mode');
	const restore = document.getElementById('setting-restore-last-image');
	if (t1) t1.checked = prefs.autoSave;
	if (t2) t2.checked = prefs.autoSave;
	if (m) m.value = prefs.mode;
	if (restore) restore.checked = readSettings().restoreLastImage === true;
	const status = document.getElementById('history-auto-status');
	const labels = { lifecycle: t('ui.autoSaveLifecycle'), all: t('ui.allAutomaticEvents'), manual: t('ui.onlyManualShort') };
	if (status) status.textContent = prefs.autoSave ? (labels[prefs.mode] || prefs.mode) : t('ui.off');
	renderSegmentedChoices();
}

const syncHistoryLimitSelect = (value) => {
	const sidebarSel = document.getElementById('history-save-limit');
	const settingsSel = document.getElementById('setting-history-save-limit');
	if (sidebarSel) sidebarSel.value = String(value);
	if (settingsSel) settingsSel.value = String(value);
	const limitStatus = document.getElementById('history-limit-status');
	if (limitStatus) limitStatus.textContent = value > 0 ? t('ui.countImages', { count: value }) : t('ui.off');
	renderSegmentedChoices();
}

const exportHistoryItem = async (session, index) => {
	const stamp = session.timestamp
		? new Date(session.timestamp).toISOString().replace(/[:.]/g, '-').slice(0, 19)
		: 'session-step';
	const name = `history-${index + 1}-${stamp}.png`;
	const a = document.createElement('a');
	a.href = session.dataUrl;
	a.download = name;
	document.body.appendChild(a);
	a.click();
	a.remove();
}

const exportSessionEntry = async (entry, index) => {
	const a = document.createElement('a');
	a.href = entry.dataUrl;
	a.download = `session-${index + 1}.png`;
	document.body.appendChild(a);
	a.click();
	a.remove();
}

const exportAllHistory = async () => {
	const sessionView = sidebar.historyView === HISTORY_VIEWS.session;
	if (sessionView) {
		const entries = sidebar.historyManager?.getSessionEntries?.() || [];
		if (!entries.length) {
			statusBar.flash('No session steps to export');
			return;
		}
		for (let i = 0; i < entries.length; i += 1) {
			await exportSessionEntry(entries[i], i);
			await new Promise((resolve) => setTimeout(resolve, 250));
		}
		statusBar.flash(`Exported ${entries.length} session images`);
		return;
	}
	const sessions = await sidebar.globalHistory.getSessions();
	if (!sessions.length) {
		statusBar.flash('No history to export');
		return;
	}
	// Preferred: let the user pick a folder and write every image into it.
	if (window.showDirectoryPicker) {
		try {
			const dir = await window.showDirectoryPicker({ mode: 'readwrite' });
			for (let i = 0; i < sessions.length; i += 1) {
				const stamp = new Date(sessions[i].timestamp).toISOString().replace(/[:.]/g, '-').slice(0, 19);
				const name = `history-${sessions.length - i}-${stamp}.png`;
				const blob = await (await fetch(sessions[i].dataUrl)).blob();
				const handle = await dir.getFileHandle(name, { create: true });
				const writable = await handle.createWritable();
				await writable.write(blob);
				await writable.close();
			}
			statusBar.flash(`Exported ${sessions.length} images to folder`);
			return;
		} catch (err) {
			if (err && err.name === 'AbortError') return;
			console.warn('Directory export failed, falling back to downloads:', err);
		}
	}
	// Fallback: sequential downloads (newest first, matching grid order).
	for (let i = 0; i < sessions.length; i += 1) {
		await exportHistoryItem(sessions[i], sessions.length - 1 - i);
		await new Promise((resolve) => setTimeout(resolve, 250));
	}
	statusBar.flash(`Exported ${sessions.length} images`);
}

const applyHistoryLimit = (val) => {
	const parsed = parseInt(val, 10);
	const safe = Number.isNaN(parsed) ? 50 : parsed;
	syncHistoryLimitSelect(safe);
	if (sidebar?.globalHistory?.db) {
		sidebar.globalHistory.saveSettings(safe, safe > 0);
	}
}

const applyHistoryState = () => {
	const { autoSave } = getHistoryPrefs();
	statusBar?.flash?.(autoSave ? 'History auto-save on' : 'History auto-save off');
	syncHistoryControls();
}

const applyCanvasBackgroundMode = (mode) => {
	const value = mode || 'none';
	canvasManager.setBackgroundMode(value === 'transparent' ? 'transparent' : 'solid');
	const solidColorControl = document.querySelector('[data-solid-color-control]');
	if (solidColorControl) solidColorControl.hidden = !['none', 'solid'].includes(value);
	const viewport = document.getElementById('canvas-viewport');
	viewport.classList.remove('bg-checkerboard', 'bg-grid', 'bg-transparent');
	if (value === 'transparent') viewport.classList.add('bg-transparent');
	else if (value === 'checkerboard') viewport.classList.add('bg-checkerboard');
	else if (value === 'grid') viewport.classList.add('bg-grid');
}

const getDefaultZoom = () => {
	const raw = defaultZoomSelect?.value === 'custom'
		? defaultZoomCustomInput?.value
		: defaultZoomSelect?.value;
	const value = Number(raw);
	return Number.isFinite(value) ? Math.min(800, Math.max(10, Math.round(value))) : 100;
}

const syncDefaultCanvasInputsFromSelect = () => {
	const [width, height] = String(defaultCanvasSizeSelect?.value || '800x600').split('x').map(Number);
	if (Number.isFinite(width) && width > 0 && defaultCanvasWidthInput) defaultCanvasWidthInput.value = width;
	if (Number.isFinite(height) && height > 0 && defaultCanvasHeightInput) defaultCanvasHeightInput.value = height;
}

const syncDefaultZoomInputFromSelect = () => {
	const value = Number(defaultZoomSelect?.value);
	if (Number.isFinite(value) && value > 0 && defaultZoomCustomInput) defaultZoomCustomInput.value = value;
}

// ---------- Settings dialog ----------
const applySavedSettings = () => {
	const saved = readSettings();
	dmCheckbox.checked = Boolean(saved.darkMode);
	sbCheckbox.checked = saved.showStatusBar !== false;
	ciCheckbox.checked = saved.showColorInspector !== false;
	if (aiCheckbox) aiCheckbox.checked = saved.showAiChat === true;
	if (directionSelect) directionSelect.value = ['auto', 'ltr', 'rtl'].includes(saved.interfaceDirection)
		? saved.interfaceDirection : 'auto';
	bgSelect.value = saved.canvasBackground || 'none';
	const solidColor = /^#[0-9a-f]{6}$/i.test(saved.solidBackgroundColor || '')
		? saved.solidBackgroundColor.toLowerCase()
		: DEFAULT_SETTINGS.solidBackgroundColor;
	if (solidBackgroundColorInput) solidBackgroundColorInput.value = solidColor;
	canvasManager.setBackgroundColor(solidColor);
	defaultCanvasSizeSelect.value = saved.defaultCanvasSize || '800x600';
	const restoreLastImage = document.getElementById('setting-restore-last-image');
	if (restoreLastImage) restoreLastImage.checked = saved.restoreLastImage === true;
	if (![...defaultCanvasSizeSelect.options].some((option) => option.value === defaultCanvasSizeSelect.value)) {
		defaultCanvasSizeSelect.value = 'custom';
	}
	if (Number.isFinite(Number(saved.defaultCanvasWidth)) && Number(saved.defaultCanvasWidth) > 0) {
		defaultCanvasWidthInput.value = saved.defaultCanvasWidth;
	}
	if (Number.isFinite(Number(saved.defaultCanvasHeight)) && Number(saved.defaultCanvasHeight) > 0) {
		defaultCanvasHeightInput.value = saved.defaultCanvasHeight;
	}
	if (defaultCanvasSizeSelect.value !== 'custom') syncDefaultCanvasInputsFromSelect();
	const savedZoom = Number(saved.defaultZoom || 100);
	defaultZoomSelect.value = [...defaultZoomSelect.options].some((option) => option.value === String(savedZoom))
		? String(savedZoom)
		: 'custom';
	if (defaultZoomCustomInput) defaultZoomCustomInput.value = Math.min(800, Math.max(10, Math.round(savedZoom)));
	applyCanvasBackgroundMode(bgSelect.value);
	viewportManager.setInitialZoom(getDefaultZoom());
	if (!localStorage.getItem('paint:zoom')) viewportManager.setZoom(getDefaultZoom());
	// Startup begins from the configured blank size. app.js restores the
	// canonical IndexedDB working record afterwards, so this must not inspect
	// the retired localStorage canvas key or it can make restore timing depend
	// on stale fallback data.
	const { width, height } = getDefaultCanvasSize();
	if (width !== canvasManager.width || height !== canvasManager.height) canvasManager.resize(width, height);
	syncHistoryControls(saved);
	document.body.classList.toggle('dark-mode', dmCheckbox.checked);
	localeController.setDirection(directionSelect?.value || 'auto');
	document.querySelector('.status-bar').style.display = sbCheckbox.checked ? 'grid' : 'none';
	document.getElementById('color-inspector').style.display = ciCheckbox.checked ? 'flex' : 'none';
	const ribbonVisibility = saved.ribbonVisibility || {};
	document.querySelectorAll('.ribbon-group').forEach((groupSection) => {
		const title = groupSection.querySelector('.ribbon-group-title');
		if (!title) return;
		const stableKey = getRibbonGroupKey(groupSection);
		const legacyKey = title.textContent.trim();
		const storedVisibility = ribbonVisibility[stableKey] ?? ribbonVisibility[legacyKey];
		if (storedVisibility === undefined) return;
		const visible = storedVisibility;
		groupSection.hidden = !visible;
		[...groupSection.children]
			.filter((child) => !child.classList.contains('ribbon-group-title') && child.id !== 'file-input')
			.forEach((child) => {
				child.hidden = !visible;
				child.style.display = visible ? '' : 'none';
			});
		const separator = groupSection.nextElementSibling;
		if (separator?.classList.contains('separator')) separator.style.display = visible ? '' : 'none';
	});
	const buttonVisibility = saved.buttonVisibility || {};
	document.querySelectorAll('.rbtn[id]').forEach((button) => {
		if (buttonVisibility[button.id] === undefined) return;
		button.hidden = !buttonVisibility[button.id];
		button.style.display = buttonVisibility[button.id] ? '' : 'none';
	});
	const fileInput = document.getElementById('file-input');
	if (fileInput) {
		fileInput.hidden = true;
		fileInput.style.display = 'none';
	}
	const rotateToggle = document.getElementById('rotate-selection-toggle');
	if (rotateToggle) {
		rotateToggle.checked = saved.showRotateInSelection !== false;
	}
	// Settings is the stable escape hatch for ribbon configuration.
	const settingsButton = document.getElementById('btn-settings');
	if (settingsButton) { settingsButton.hidden = false; settingsButton.style.display = ''; }
	const extrasGroup = document.querySelector('.ribbon-group-extras');
	if (extrasGroup) {
		extrasGroup.hidden = false;
		extrasGroup.style.display = '';
		[...extrasGroup.children]
			.filter((child) => !child.classList.contains('ribbon-group-title'))
			.forEach((child) => { child.hidden = false; child.style.display = child.classList.contains('rbtn-row') ? 'flex' : ''; });
	}
	applyAiChatVisibility(aiCheckbox?.checked === true);
	const inspectorSeparator = document.querySelector('.color-inspector')?.nextElementSibling;
	if (inspectorSeparator?.classList.contains('separator')) {
		inspectorSeparator.style.display = ciCheckbox.checked ? '' : 'none';
	}
	renderShortcutSettings();
	const layout = saved.ribbonLayout || ribbonLayoutManager.state;
	ribbonLayoutManager.setPosition(layout.position || 'top');
	ribbonLayoutManager.setVisible(layout.visible !== false);
	if (settingsShowRibbon) settingsShowRibbon.checked = ribbonLayoutManager.state.visible;
	syncRibbonLayoutControls(ribbonLayoutManager.state);
	renderSegmentedChoices();
	syncRibbonSettingsControls();
}

const syncRibbonSettingsControls = () => {
	document.querySelectorAll('[data-ribbon-group-setting]').forEach((checkbox) => {
		const group = document.querySelector(`.${checkbox.dataset.ribbonGroupSetting}`);
		if (!group) return;
		checkbox.checked = [...group.children]
			.filter((child) => !child.classList.contains('ribbon-group-title') && child.id !== 'file-input')
			.some((child) => !child.hidden && child.style.display !== 'none');
	});
}

const normalizeStorageEstimate = (value) => {
	const usage = Number(value?.usage);
	const quota = Number(value?.quota);
	if (!Number.isFinite(usage) || !Number.isFinite(quota) || usage < 0 || quota <= 0 || usage > quota) return null;
	return { usage, quota, checkedAt: Number(value?.checkedAt) || Date.now() };
}

const getStorageEstimate = async () => {
	const estimate = await navigator.storage?.estimate?.();
	return normalizeStorageEstimate({ ...estimate, checkedAt: Date.now() });
}

const updateAboutStats = async () => {
	const loading = document.getElementById('about-loading-state');
	const aboutValues = document.querySelectorAll('[data-about-value]');
	if (loading) loading.hidden = false;
	aboutValues.forEach((element) => element.setAttribute('aria-busy', 'true'));
	const version = document.getElementById('about-version');
	const activity = document.getElementById('about-activity');
	if (version) version.textContent = APP_VERSION;
	if (activity) activity.textContent = formatUnambiguousDateTime(new Date());
		// Storage numbers are estimates, not disk truth. Read a fresh validated
	// browser estimate every time the About tab is opened.
	const MB = 1024 * 1024;
	const formatBytes = (bytes) => {
		const value = Number(bytes);
		if (!Number.isFinite(value) || value < 0) return 'Unavailable';
		const units = value >= 1024 ** 3 ? ['GiB', 1024 ** 3]
			: value >= MB ? ['MiB', MB]
			: value >= 1024 ? ['KiB', 1024]
			: ['B', 1];
		return `${(value / units[1]).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${units[0]}`;
	};
	try {
		const estimate = await getStorageEstimate();
		const usageBytes = estimate?.usage || 0;
		const quotaBytes = estimate?.quota || 0;
		// This is the browser's storage quota estimate, not free space on the
		// user's disk. Keep the raw estimate and label the result accordingly;
		// never present a made-up fixed 10 GB capacity.
		const storage = document.getElementById('about-storage');
		if (storage) storage.textContent = estimate ? formatBytes(usageBytes) : 'Unavailable';
		const quotaEl = document.getElementById('about-storage-quota');
		if (quotaEl) {
			quotaEl.textContent = estimate ? formatBytes(quotaBytes) : 'Unavailable';
		}
		const fill = document.getElementById('about-storage-bar-fill');
		const usageLabel = document.getElementById('about-storage-usage-label');
		if (fill) {
			let pct = 0;
			if (estimate && quotaBytes > 0 && usageBytes > 0) {
				pct = Math.min(100, Math.max(1, Math.ceil((usageBytes / quotaBytes) * 100)));
			}
			fill.style.width = `${pct}%`;
			if (usageLabel) usageLabel.textContent = estimate
				? t('ui.usagePercent', { percent: Math.round((usageBytes / quotaBytes) * 100) })
				: t('ui.usage');
		}
	} catch {
		const storage = document.getElementById('about-storage');
		if (storage) storage.textContent = 'Unavailable';
		const quotaEl = document.getElementById('about-storage-quota');
		if (quotaEl) quotaEl.textContent = 'Unavailable';
		const usageLabel = document.getElementById('about-storage-usage-label');
		if (usageLabel) usageLabel.textContent = t('ui.usage');
	} finally {
		aboutValues.forEach((element) => element.removeAttribute('aria-busy'));
		if (loading) loading.hidden = true;
	}
}

const renderReleaseNotes = () => {
	const host = document.getElementById('release-notes-list');
	if (!host) return;
	host.innerHTML = '';
	for (const note of getReleaseNotes()) {
		const card = document.createElement('div');
		card.className = 'release-note-card';
		const head = document.createElement('div');
		head.className = 'release-note-head';
		const ver = document.createElement('strong');
		ver.textContent = note.version === 'Unreleased' ? 'Unreleased' : `v${note.version}`;
		head.appendChild(ver);
		if (note.date) {
			const date = document.createElement('span');
			date.className = 'release-note-date';
			date.textContent = /^\d{4}-\d{2}-\d{2}$/.test(note.date)
				? formatUnambiguousDate(new Date(`${note.date}T00:00:00`))
				: note.date;
			head.appendChild(date);
		}
		const list = document.createElement('ul');
		for (const key of note.highlightKeys) {
			const li = document.createElement('li');
			li.textContent = t(key);
			list.appendChild(li);
		}
		card.append(head, list);
		host.appendChild(card);
	}
}
const refreshAboutOnLocaleChange = () => {
	if (!document.querySelector('[data-settings-panel="about"]')?.hidden) void updateAboutStats();
};
document.documentElement?.addEventListener('paint:locale-change', refreshAboutOnLocaleChange);
renderReleaseNotes();

const shortcutSettingsStatus = document.getElementById('shortcut-settings-status');
const persistShortcutSettings = () => settingsStore.set({ shortcuts: shortcutManager.get() });
const renderShortcutSettings = () => {
	const host = document.getElementById('shortcut-settings-list');
	if (!host) return;
	host.replaceChildren();
	for (const definition of SHORTCUT_DEFINITIONS) {
		const row = document.createElement('div');
		row.className = 'shortcut-setting-row';
		const label = document.createElement('label');
		label.textContent = definition.label;
		const input = document.createElement('input');
		input.type = 'text';
		input.readOnly = true;
		input.className = 'shortcut-setting-input';
		input.id = `shortcut-${definition.action}`;
		input.dataset.shortcutAction = definition.action;
		input.setAttribute('aria-label', `${definition.label} shortcut`);
		input.value = formatShortcut(shortcutManager.get()[definition.action]);
		input.title = 'Focus this field and press the shortcut you want';
		input.addEventListener('keydown', (event) => {
			if (event.key === 'Escape') {
				input.blur();
				return;
			}
			const next = shortcutFromEvent(event);
			if (!next) return;
			event.preventDefault();
			event.stopPropagation();
			const result = shortcutManager.assign(definition.action, next);
			if (!result.ok) {
				input.setCustomValidity('That shortcut is already assigned.');
				if (shortcutSettingsStatus) shortcutSettingsStatus.textContent = 'That shortcut is already assigned.';
				return;
			}
			input.setCustomValidity('');
			input.value = formatShortcut(result.value);
			persistShortcutSettings();
			if (shortcutSettingsStatus) shortcutSettingsStatus.textContent = `${definition.label} shortcut saved.`;
		});
		const reset = document.createElement('button');
		reset.type = 'button';
		reset.className = 'settings-link-button shortcut-reset';
		reset.textContent = 'Default';
		reset.addEventListener('click', () => {
			const result = shortcutManager.reset(definition.action);
			if (!result.ok) return;
			input.setCustomValidity('');
			input.value = formatShortcut(result.value);
			persistShortcutSettings();
			if (shortcutSettingsStatus) shortcutSettingsStatus.textContent = `${definition.label} reset to default.`;
		});
		label.htmlFor = input.id;
		row.append(label, input, reset);
		host.appendChild(row);
	}
};
renderShortcutSettings();

const RIBBON_GROUP_ORDER = Object.freeze([
	'ribbon-group-file',
	'ribbon-group-clipboard',
	'ribbon-group-image',
	'ribbon-group-tools',
	'ribbon-group-shapes',
	'ribbon-group-colors',
	'ribbon-group-history',
	'ribbon-group-extras',
]);

const populateRibbonSettings = () => {
	const container = document.getElementById('ribbon-settings-list');
	if (!container) return;
	container.innerHTML = '';
	const groups = RIBBON_GROUP_ORDER.map((className) => document.querySelector(`.${className}`)).filter(Boolean);
	document.querySelectorAll('.ribbon-group').forEach((groupSection) => {
		if (!groups.includes(groupSection)) groups.push(groupSection);
	});
	groups.forEach((groupSection) => {
		const title = groupSection.querySelector('.ribbon-group-title');
		if (!title) return;
		const row = document.createElement('div');
		row.className = 'ribbon-setting-row';
		const label = document.createElement('div');
		label.className = 'checkbox-row';
		label.dataset.tag = `ribbon-group-visibility-row-${groups.indexOf(groupSection)}`;
		const checkbox = document.createElement('input');
		checkbox.type = 'checkbox';
		checkbox.id = `ribbon-group-visibility-${groups.indexOf(groupSection)}`;
		checkbox.dataset.tag = checkbox.id;
		const checkboxLabel = document.createElement('label');
		checkboxLabel.htmlFor = checkbox.id;
		checkboxLabel.dataset.tag = `${checkbox.id}-label`;
		checkbox.dataset.ribbonGroupSetting = [...groupSection.classList].find((name) => name.startsWith('ribbon-group-')) || '';
		checkbox.checked = [...groupSection.children]
			.filter((child) => !child.classList.contains('ribbon-group-title') && child.id !== 'file-input')
			.some((child) => !child.hidden && child.style.display !== 'none');
		const isExtras = groupSection.classList.contains('ribbon-group-extras');
		if (isExtras) checkbox.disabled = true;
		checkbox.addEventListener('change', () => {
			if (isExtras) return;
			[...groupSection.children]
				.filter((child) => !child.classList.contains('ribbon-group-title') && child.id !== 'file-input')
				.forEach((child) => {
					child.hidden = !checkbox.checked;
					child.style.display = checkbox.checked ? '' : 'none';
				});
			const separator = groupSection.nextElementSibling;
			groupSection.hidden = !checkbox.checked;
			if (separator?.classList.contains('separator')) separator.style.display = checkbox.checked ? '' : 'none';
			saveSettings();
		});
		checkboxLabel.textContent = isExtras ? t('ui.settingsAlwaysVisible', { group: title.textContent }) : title.textContent;
		label.append(checkbox, checkboxLabel);
		const details = document.createElement('button');
		details.type = 'button';
		details.className = 'ribbon-setting-details';
		details.dataset.tag = `ribbon-group-details-${groups.indexOf(groupSection)}`;
		details.textContent = t('ui.details');
		details.addEventListener('click', () => sidebar.showGroupSettings(title.textContent, groupSection));
		row.append(label, details);
		container.appendChild(row);
	});
}

populateRibbonSettings();

document.getElementById('settings-reset').addEventListener('click', async () => {
	const confirmed = await dialogService.confirm({
		title: t('ui.resetSettings'),
		message: t('settings.resetConfirm'),
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
	if (new URLSearchParams(window.location.search).get('dialog') === 'settings') setDialogUrl(null);
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
		confirmLabel: t('settings.clearData'),
		danger: true,
	});
	if (!confirmed) return;
	localStorage.clear();
	indexedDB.deleteDatabase('omerpaint_global_history');
	indexedDB.deleteDatabase('paint-workspace');
	settingsDialog.close();
	window.location.reload();
});

window.addEventListener('paint:ribbon-change', saveSettings);
window.addEventListener('paint:ribbon-change', syncRibbonSettingsControls);

// ---------- History controls wiring (sidebar + settings tab) ----------
const autoSaveToggle = document.getElementById('history-auto-save-toggle');
const settingAutoSave = document.getElementById('setting-history-auto-save');
const settingAutoMode = document.getElementById('setting-history-auto-save-mode');
const historyLimitSel = document.getElementById('history-save-limit');
const settingLimit = document.getElementById('setting-history-save-limit');

const persistHistoryPrefs = () => {
	const state = {
		historyAutoSave: autoSaveToggle ? autoSaveToggle.checked : (settingAutoSave ? settingAutoSave.checked : true),
		historyAutoSaveMode: settingAutoMode ? settingAutoMode.value : 'all',
	};
	try {
		settingsStore.set(state);
	} catch (err) {
		console.warn('Unable to save history prefs:', err);
	}
}

const onAutoSaveChange = (event) => {
	const enabled = event?.target?.checked ?? settingAutoSave?.checked ?? autoSaveToggle?.checked ?? true;
	if (settingAutoSave) settingAutoSave.checked = enabled;
	if (autoSaveToggle) autoSaveToggle.checked = enabled;
	persistHistoryPrefs();
	applyHistoryState();
	saveSettings();
};
autoSaveToggle?.addEventListener('change', onAutoSaveChange);
settingAutoSave?.addEventListener('change', onAutoSaveChange);
settingAutoMode?.addEventListener('change', () => {
	persistHistoryPrefs();
	syncHistoryControls();
	renderSegmentedChoices();
});
document.getElementById('setting-restore-last-image')?.addEventListener('change', saveSettings);
historyLimitSel?.addEventListener('change', (e) => applyHistoryLimit(e.target.value));
settingLimit?.addEventListener('change', (e) => applyHistoryLimit(e.target.value));

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

document.getElementById('history-export-all-btn')?.addEventListener('click', () => exportAllHistory());
window.addEventListener('paint:history-export-item', (e) => {
	exportHistoryItem(e.detail.session, e.detail.index);
	statusBar.flash(t('status.historySaved'));
});
document.getElementById('settings-history-export-all')?.addEventListener('click', () => exportAllHistory());
document.getElementById('settings-history-clear')?.addEventListener('click', async () => {
	const confirmed = await dialogService.confirm({
		title: t('history.clearTitle'),
		message: t('history.clearConfirm'),
		confirmLabel: t('history.clearTitle'),
		danger: true,
	});
	if (!confirmed) return;
	await sidebar.globalHistory.clearAll();
	if (sidebar.activeTab === HISTORY_VIEWS.history) await sidebar.refreshHistory();
	statusBar.flash(t('status.historyCleared'));
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
		if (new URLSearchParams(window.location.search).get('dialog') === 'new') setDialogUrl(null);
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

applySavedSettings();

const restoreDialogFromUrl = () => {
	const params = new URLSearchParams(window.location.search);
	const dialog = params.get('dialog');
	if (dialog === 'settings') openSettingsDialog(params.get('tab') || getLastSettingsTab());
	else if (dialog === 'resize') openResizeDialog();
	else if (dialog === 'new' && newFileDialog && !newFileDialog.open) newFileDialog.showModal();
}
restoreDialogFromUrl();

const iconCopyFormats = ['SVG', 'PNG 26x26', 'PNG 100x100', 'PNG 300x300', 'PNG 500x500'];
let iconCopyIndex = 0;
const appIcon = document.querySelector('.app-icon');

const copyAppIcon = async () => {
	const format = iconCopyFormats[iconCopyIndex];
	try {
		const svgText = await fetch(appIcon.src).then((response) => response.text());
		if (format === 'SVG') {
			const svgBlob = new Blob([svgText], { type: 'image/svg+xml' });
			await navigator.clipboard.write([
				new ClipboardItem({
					'image/svg+xml': svgBlob,
					'text/plain': new Blob([svgText], { type: 'text/plain' }),
				}),
			]);
		} else {
			const size = Number(format.match(/\d+/)[0]);
			const image = await createImageBitmap(new Blob([svgText], { type: 'image/svg+xml' }));
			const output = document.createElement('canvas');
			output.width = size;
			output.height = size;
			output.getContext('2d').drawImage(image, 0, 0, size, size);
			const blob = await new Promise((resolve, reject) => output.toBlob((value) => value ? resolve(value) : reject(new Error('PNG encoding failed')), 'image/png'));
			await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
			image.close?.();
		}
		statusBar.flash(`Copied app icon as ${format}`);
		showToast(`Copied ${format}`, true);
	} catch (error) {
		console.warn('Unable to copy app icon:', error);
		statusBar.flash('Clipboard permission is required');
	} finally {
		iconCopyIndex = (iconCopyIndex + 1) % iconCopyFormats.length;
	}
}

appIcon?.addEventListener('click', copyAppIcon);

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
		paste: () => clipboardManager.paste(),
		cut: () => clipboardManager.cut(),
		copy: () => clipboardManager.copy(),
		crop,
		openResizeDialog,
		undo: () => { discardFloatingSelection(); historyManager.undo(); },
		redo: () => { discardFloatingSelection(); historyManager.redo(); },
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
document.getElementById('btn-ai-chat').addEventListener('click', () => sidebar.toggleAi());
document.getElementById('history-settings-link')?.addEventListener('click', () => openSettingsDialog('history'));

document.querySelectorAll('.ribbon-group-title').forEach(titleEl => {
	titleEl.addEventListener('click', () => {
		const groupSection = titleEl.closest('.ribbon-group');
		if (groupSection) {
			sidebar.showGroupSettings(titleEl.textContent, groupSection);
		}
	});
});

// ---------- File / Storage logic ----------
historyManager.onChange = (canUndo, canRedo) => toolbar.setUndoRedoEnabled(canUndo, canRedo);

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
	syncHistoryLimitSelect(sidebar.globalHistory.maxHistory);
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
		if (typing) return;
		e.preventDefault();
		discardFloatingSelection();
		if (action === SHORTCUT_ACTIONS.undo) historyManager.undo();
		else historyManager.redo();
		return;
	}
	if (action === SHORTCUT_ACTIONS.selectAll) {
		if (editable) return;
		e.preventDefault();
		selectAll();
		return;
	}
	if (action === SHORTCUT_ACTIONS.copy || action === SHORTCUT_ACTIONS.cut) {
		if (editable && hasTextSelection) return;
		e.preventDefault();
		if (action === SHORTCUT_ACTIONS.copy) clipboardManager.copy();
		else clipboardManager.cut();
		return;
	}
	if (action === SHORTCUT_ACTIONS.paste) {
		// The default Ctrl/Cmd+V remains the native paste event below for Safari
		// and permission-free clipboard image transfer. Custom bindings use the
		// explicit clipboard-read fallback while preserving user activation.
		if (shortcutManager.isDefault(action, shortcut) || typing) return;
		e.preventDefault();
		void clipboardManager.paste();
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

// ---------- Native paste events (Cmd/Ctrl+V on any OS, incl. macOS) ----------
// The browser dispatches a real 'paste' event for Cmd+V with clipboard contents
// attached - no async clipboard-read permission needed (Safari on Mac blocks
// navigator.clipboard.read() most of the time).
document.addEventListener('paste', async (e) => {
	const target = e.target;
	const editingText = target instanceof HTMLElement &&
		(target.tagName === 'TEXTAREA' || target.tagName === 'INPUT' || target.isContentEditable);
	if (editingText) return; // let form fields receive normal text paste

	const items = e.clipboardData?.items;
	if (items) {
		for (const item of items) {
			if (!item.type.startsWith('image/')) continue;
			const file = item.getAsFile();
			if (!file) continue;
			e.preventDefault();
			try {
				await clipboardManager.insertImageBlob(file, { sourceLabel: 'Pasted' });
			} catch (err) {
				console.error('Paste failed:', err);
				statusBar.flash('Paste failed - unsupported image data');
			}
			return;
		}
	}
	statusBar.flash('Clipboard has no image to paste');
});

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
	destroySelectionHandleBindings();
	destroyRotateSelectionHandleBinding();
	toolManager.destroy();
	canvasResizer.destroy();
	viewportManager.destroy();
	directionEventTarget.removeEventListener('paint:locale-change', refreshCanvasDirectionGeometry);
	document.documentElement?.removeEventListener('paint:locale-change', renderSegmentedChoices);
	document.documentElement?.removeEventListener('paint:locale-change', refreshAboutOnLocaleChange);
	ribbonLayoutManager.destroy();
	actionMenuController.destroy();
	backgroundRemovalController.destroy();
	pwaInstallManager.destroy();
	textSelectionOverlay.destroy();
	textLayerService.destroy();
	historyManager.dispose();
};

const shouldRestoreLastImage = () => settingsStore.get().restoreLastImage === true;

export { canvasManager, eventBus, statusBar, dialogService, destroyEditor, setPwaUpdateSafetyGuard, shouldRestoreLastImage };
