import assert from 'node:assert/strict';
import test from 'node:test';

import { createEventBus } from '../js/core/EventBus.js';
import { CanvasManager } from '../js/canvas/CanvasManager.js';
import { CanvasResizer } from '../js/canvas/CanvasResizer.js';
import { ViewportManager } from '../js/canvas/ViewportManager.js';
import { ClipboardManager } from '../js/clipboard/ClipboardManager.js';
import { createPaintDocument, isPaintDocument } from '../js/core/DocumentContract.js';
import { HistoryManager, MAX_HISTORY_SNAPSHOT_PIXELS } from '../js/history/HistoryManager.js';
import { createSettingsStore } from '../js/settings/SettingsStore.js';
import { createTextDocumentStore } from '../js/document/TextDocumentStore.js';
import { createTextHistoryStore } from '../js/document/TextHistoryStore.js';
import { createTelemetry } from '../js/telemetry.js';
import { ToolManager } from '../js/tools/ToolManager.js';
import { createStatusBar } from '../js/ui/StatusBar.js';
import { createActionMenuController } from '../js/ui/ActionMenuController.js';
import { PanelLayoutManager } from '../js/ui/PanelLayoutManager.js';
import { colorStateToCss, normalizeRgba } from '../js/utils/colorContract.js';
import { estimateDataUrlBytes, makeMemoryReport } from '../js/storage/MemoryBudget.js';
import { assessImageAdmission, IMAGE_ADMISSION_REASONS } from '../js/storage/ImageAdmission.js';
import {
	classifyStorageError,
	installCanvasAutosave,
	loadCanvasState,
	normalizeWorkingRecord,
	saveCanvasState,
	STORAGE_FAILURE_KINDS,
	WORKING_CANVAS_MAX_AUTOSAVE_PIXELS,
	WORKING_CANVAS_SCHEMA_VERSION,
} from '../js/storage.js';
import { EVENTS, LIMITS } from '../js/core/constants.js';

const memoryStorage = () => {
	const values = new Map();
	return {
		getItem: (key) => values.get(key) ?? null,
		setItem: (key, value) => values.set(key, String(value)),
		removeItem: (key) => values.delete(key),
	};
}

const eventTarget = () => {
	const listeners = new Map();
	return {
		style: {},
		addEventListener: (name, listener) => {
			const entries = listeners.get(name) || new Set();
			entries.add(listener);
			listeners.set(name, entries);
		},
		removeEventListener: (name, listener) => {
			const entries = listeners.get(name);
			entries?.delete(listener);
			if (entries?.size === 0) listeners.delete(name);
		},
		dispatch: (name, payload = {}) => [...(listeners.get(name) || [])].forEach((listener) => listener(payload)),
		listenerCount: () => [...listeners.values()].reduce((count, entries) => count + entries.size, 0),
	};
}

const waitForTasks = (milliseconds = 0) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const createFakeIndexedDb = ({ records = new Map(), writeError = null } = {}) => {
	const stores = new Set();
	let closed = 0;
	const database = {
		objectStoreNames: { contains: (name) => stores.has(name) },
		createObjectStore: (name) => { stores.add(name); },
		close: () => { closed += 1; },
		transaction: (_name, mode) => {
			const transaction = {};
			const operation = (run) => {
				const request = {};
				queueMicrotask(() => {
					try {
						request.result = run();
						request.onsuccess?.();
						transaction.oncomplete?.();
					} catch (error) {
						request.error = error;
						request.onerror?.();
						transaction.onerror?.();
					}
				});
				return request;
			};
			transaction.objectStore = () => ({
				get: (key) => operation(() => records.get(key)),
				put: (value, key) => operation(() => {
					if (mode !== 'readwrite') throw new Error('readonly');
					if (writeError) throw writeError;
					records.set(key, value);
					return key;
				}),
				delete: (key) => operation(() => {
					if (mode !== 'readwrite') throw new Error('readonly');
					if (writeError) throw writeError;
					records.delete(key);
					return undefined;
				}),
			});
			return transaction;
		},
	};
	return {
		records,
		get closed() { return closed; },
		open: () => {
			const request = {};
			queueMicrotask(() => {
				request.result = database;
				if (!stores.has('documents')) request.onupgradeneeded?.();
				request.onsuccess?.();
			});
			return request;
		},
	};
}

test('EventBus supports unsubscribe, once, and destroy', () => {
	const bus = createEventBus();
	const received = [];
	const off = bus.on('paint:test', (value) => received.push(`on:${value}`));
	bus.once('paint:test', (value) => received.push(`once:${value}`));
	bus.emit('paint:test', 1);
	off();
	bus.emit('paint:test', 2);
	bus.destroy();
	bus.emit('paint:test', 3);
	assert.deepEqual(received, ['on:1', 'once:1']);
});

test('ToolManager coalesces pointer work, flushes before up, and cancels safely', () => {
	const surface = eventTarget();
	const fallback = eventTarget();
	const captured = [];
	const released = [];
	surface.setPointerCapture = (pointerId) => captured.push(pointerId);
	surface.releasePointerCapture = (pointerId) => released.push(pointerId);
	const frames = [];
	const cancelledFrames = [];
	const calls = [];
	const points = [];
	let persisted = 0;
	const manager = new ToolManager({
		surface,
		eventTarget: fallback,
		viewportManager: {
			clientToImage: (x, y) => {
				points.push([x, y]);
				return { x: x / 2, y: y / 2 };
			},
		},
		toolContext: { canvasManager: { persistToStorage: () => { persisted += 1; } } },
		statusBar: { setPointer: (point) => calls.push(['status', point?.x ?? null, point?.y ?? null]) },
		requestFrame: (callback) => {
			frames.push(callback);
			return frames.length;
		},
		cancelFrame: (handle) => cancelledFrames.push(handle),
	});
	manager.register({
		name: 'test',
		onDown: (point) => calls.push(['down', point.x, point.y]),
		onMove: (point) => calls.push(['move', point.x, point.y]),
		onUp: (point) => calls.push(['up', point.x, point.y]),
		onCancel: (point) => calls.push(['cancel', point.x, point.y]),
	});
	manager.setActive('test');
	surface.dispatch('pointerdown', { pointerId: 7, button: 0, clientX: 4, clientY: 8, preventDefault: () => {} });
	surface.dispatch('pointermove', {
		pointerId: 7,
		button: 0,
		clientX: 28,
		clientY: 32,
		getCoalescedEvents: () => [
			{ pointerId: 7, button: 0, clientX: 12, clientY: 16 },
			{ pointerId: 7, button: 0, clientX: 28, clientY: 32 },
		],
	});
	assert.equal(frames.length, 1, 'a burst schedules one animation frame');
	surface.dispatch('pointerup', { pointerId: 7, button: 0, clientX: 30, clientY: 34 });
	assert.deepEqual(calls.slice(0, 5), [
		['down', 2, 4],
		['move', 6, 8],
		['move', 14, 16],
		['status', 14, 16],
		['up', 15, 17],
	]);
	assert.equal(persisted, 1, 'only a completed pointer gesture persists');
	assert.deepEqual(captured, [7]);
	assert.deepEqual(released, [7]);
	assert.deepEqual(cancelledFrames, [1], 'the pending frame is cancelled after its synchronous final flush');
	assert.equal(points.length, 4, 'the final status point reuses its conversion');

	surface.dispatch('pointerdown', { pointerId: 8, button: 0, clientX: 2, clientY: 2, preventDefault: () => {} });
	surface.dispatch('pointerup', { pointerId: 9, button: 0, clientX: 6, clientY: 6 });
	assert.equal(calls.some(([kind]) => kind === 'cancel'), false, 'a foreign pointer cannot finish the active gesture');
	surface.dispatch('pointercancel', { pointerId: 8, button: 0, clientX: 8, clientY: 8 });
	assert.ok(calls.some(([kind]) => kind === 'cancel'), 'the active gesture reaches the tool cancel hook');
	assert.equal(persisted, 1, 'a cancelled gesture is not persisted');

	surface.dispatch('pointermove', { pointerId: 8, button: 0, clientX: 10, clientY: 10 });
	manager.destroy();
	assert.equal(surface.listenerCount(), 0, 'destroy removes all surface listeners');
	assert.equal(fallback.listenerCount(), 0, 'destroy leaves no temporary window fallback');
	assert.ok(cancelledFrames.includes(2), 'destroy cancels an outstanding animation frame');
});

test('ToolManager keeps a drag rAF queue owned by its active pointer', () => {
	const surface = eventTarget();
	const frames = [];
	const cancelledFrames = [];
	const calls = [];
	const manager = new ToolManager({
		surface,
		viewportManager: { clientToImage: (x, y) => ({ x, y }) },
		toolContext: { canvasManager: { persistToStorage: () => {} } },
		statusBar: { setPointer: () => {} },
		requestFrame: (callback) => {
			frames.push(callback);
			return frames.length;
		},
		cancelFrame: (handle) => cancelledFrames.push(handle),
	});
	manager.register({
		name: 'test',
		onDown: (point) => calls.push(['down', point.x]),
		onMove: (point) => calls.push(['move', point.x]),
		onUp: (point) => calls.push(['up', point.x]),
	});
	manager.setActive('test');

	surface.dispatch('pointerdown', { pointerId: 1, button: 0, clientX: 1, clientY: 0, preventDefault: () => {} });
	surface.dispatch('pointermove', { pointerId: 1, button: 0, clientX: 10, clientY: 0 });
	surface.dispatch('pointermove', { pointerId: 2, button: 0, clientX: 20, clientY: 0 });
	surface.dispatch('pointerup', { pointerId: 1, button: 0, clientX: 11, clientY: 0 });

	// Invoke the cancelled callback too: a stale scheduled callback must have no
	// foreign packet left to apply after the owner finishes.
	frames[0]();
	assert.deepEqual(calls, [
		['down', 1],
		['move', 10],
		['up', 11],
	]);
	assert.deepEqual(cancelledFrames, [1], 'the owner flushes and cancels its pending frame');
});

test('ViewportManager caches canvas geometry until an invalidation', () => {
	const viewport = eventTarget();
	const stage = { style: {}, parentElement: viewport };
	const scaleEl = { style: { setProperty: () => {} } };
	const button = eventTarget();
	const input = eventTarget();
	input.value = 100;
	input.blur = () => {};
	const slider = eventTarget();
	slider.value = 100;
	let rectReads = 0;
	const manager = new ViewportManager({
		stage,
		scaleEl,
		canvasManager: {
			width: 800,
			height: 600,
			canvas: { getBoundingClientRect: () => ({ left: (++rectReads) * 10, top: 20 }) },
		},
		zoomInBtn: button,
		zoomOutBtn: eventTarget(),
		zoomInput: input,
		zoomSlider: slider,
	});
	assert.deepEqual(manager.clientToImage(30, 40), { x: 20, y: 20 });
	assert.deepEqual(manager.clientToImage(40, 50), { x: 30, y: 30 });
	assert.equal(rectReads, 1, 'moves reuse the cached canvas rect');
	viewport.dispatch('scroll');
	assert.deepEqual(manager.clientToImage(40, 50), { x: 20, y: 30 });
	assert.equal(rectReads, 2, 'scroll invalidates the canvas rect');
	manager.destroy();
	assert.equal(viewport.listenerCount(), 0, 'destroy removes viewport geometry listeners');
});

test('CanvasResizer releases permanent and active-drag listeners on destroy', () => {
	const previousDocument = globalThis.document;
	const documentTarget = eventTarget();
	documentTarget.body = { dataset: {} };
	globalThis.document = documentTarget;
	try {
		const makeHandle = () => {
			const handle = eventTarget();
			handle.setPointerCapture = (pointerId) => { handle.captured = pointerId; };
			handle.releasePointerCapture = (pointerId) => { handle.released = pointerId; };
			return handle;
		};
		const handleRight = makeHandle();
		const handleBottom = makeHandle();
		const handleCorner = makeHandle();
		const viewportEl = {
			classList: { add: () => {}, remove: () => {} },
		};
		const ghost = { style: {} };
		const resizer = new CanvasResizer({
			stage: {},
			scaleEl: { style: {} },
			canvasManager: { width: 800, height: 600 },
			viewportManager: { zoom: 100, viewportEl, syncStageSize: () => {} },
			historyManager: { snapshot: () => { throw new Error('destroy must cancel, not commit'); } },
			handleRight,
			handleBottom,
			handleCorner,
			ghost,
		});

		assert.equal(handleRight.listenerCount(), 1, 'each handle owns one permanent pointer-down listener');
		assert.equal(handleBottom.listenerCount(), 1);
		assert.equal(handleCorner.listenerCount(), 1);
		handleRight.dispatch('pointerdown', {
			button: 0,
			pointerId: 9,
			clientX: 10,
			clientY: 10,
			preventDefault: () => {},
			stopPropagation: () => {},
		});
		assert.equal(documentTarget.listenerCount(), 1, 'an active resize owns its document wheel listener');
		assert.equal(handleRight.listenerCount(), 5, 'the active handle owns four temporary pointer listeners');
		assert.equal(documentTarget.body.dataset.resizing, 'true');

		resizer.destroy();
		assert.equal(handleRight.listenerCount(), 0, 'destroy releases both permanent and temporary right-handle listeners');
		assert.equal(handleBottom.listenerCount(), 0, 'destroy releases bottom-handle listener');
		assert.equal(handleCorner.listenerCount(), 0, 'destroy releases corner-handle listener');
		assert.equal(documentTarget.listenerCount(), 0, 'destroy releases the active document wheel listener');
		assert.equal(handleRight.released, 9, 'destroy releases active pointer capture');
		assert.equal(documentTarget.body.dataset.resizing, undefined);
		assert.equal(ghost.style.display, 'none', 'destroy hides an in-progress resize ghost');
		resizer.destroy();
	} finally {
		if (previousDocument) globalThis.document = previousDocument;
		else delete globalThis.document;
	}
});

test('CanvasResizer keeps RTL left-edge geometry bidirectional', () => {
	const previousDocument = globalThis.document;
	const documentTarget = eventTarget();
	documentTarget.body = { dataset: {} };
	documentTarget.documentElement = { dir: 'rtl' };
	globalThis.document = documentTarget;
	try {
		const makeHandle = () => {
			const handle = eventTarget();
			handle.setPointerCapture = () => {};
			handle.releasePointerCapture = () => {};
			return handle;
		};
		const handleRight = makeHandle();
		const handleBottom = makeHandle();
		const handleCorner = makeHandle();
		const ghost = { style: {} };
		const resizes = [];
		const resizer = new CanvasResizer({
			stage: {},
			scaleEl: { style: {} },
			canvasManager: {
				width: 800,
				height: 600,
				resize: (width, height, _fillColor, options) => { resizes.push({ width, height, options }); return true; },
			},
			viewportManager: { zoom: 100, viewportEl: { classList: { add: () => {}, remove: () => {} } }, syncStageSize: () => {} },
			historyManager: { snapshot: () => {} },
			handleRight,
			handleBottom,
			handleCorner,
			ghost,
		});

		handleRight.dispatch('pointerdown', { button: 0, pointerId: 1, clientX: 100, clientY: 10, preventDefault: () => {}, stopPropagation: () => {} });
		handleRight.dispatch('pointermove', { pointerId: 1, clientX: 40, clientY: 10 });
		assert.equal(ghost.style.width, '860px', 'dragging the RTL left edge left grows the canvas');
		handleRight.dispatch('pointerup', { pointerId: 1, clientX: 40, clientY: 10 });

		handleRight.dispatch('pointerdown', { button: 0, pointerId: 2, clientX: 100, clientY: 10, preventDefault: () => {}, stopPropagation: () => {} });
		handleRight.dispatch('pointermove', { pointerId: 2, clientX: 160, clientY: 10 });
		assert.equal(ghost.style.width, '740px', 'dragging the RTL left edge right shrinks the canvas');
		handleRight.dispatch('pointerup', { pointerId: 2, clientX: 160, clientY: 10 });
		assert.deepEqual(resizes, [
			{ width: 860, height: 600, options: { anchorX: 'right' } },
			{ width: 740, height: 600, options: { anchorX: 'right' } },
		]);
		resizer.destroy();
	} finally {
		if (previousDocument) globalThis.document = previousDocument;
		else delete globalThis.document;
	}
});

test('telemetry pauses hidden work and destroys only its own resources', () => {
	const target = eventTarget();
	const documentTarget = eventTarget();
	documentTarget.hidden = false;
	const frames = [];
	const cancelledFrames = [];
	const observers = [];
	target.performance = { now: () => 100 };
	target.requestAnimationFrame = (callback) => {
		frames.push(callback);
		return frames.length;
	};
	target.cancelAnimationFrame = (handle) => cancelledFrames.push(handle);
	class FakeObserver {
		constructor() { observers.push(this); }
		observe() {}
		disconnect() { this.disconnected = true; }
	}
	const telemetry = createTelemetry({
		target,
		documentTarget,
		PerformanceObserverCtor: FakeObserver,
	});
	assert.equal(frames.length, 1, 'visible telemetry schedules one frame loop');
	assert.equal(observers.length, 3, 'each metric observer belongs to this instance');
	documentTarget.hidden = true;
	documentTarget.dispatch('visibilitychange');
	assert.deepEqual(cancelledFrames, [1], 'hidden tabs cancel the active frame');
	documentTarget.hidden = false;
	documentTarget.dispatch('visibilitychange');
	assert.equal(frames.length, 2, 'visible tabs resume a fresh frame loop');
	telemetry.destroy();
	assert.deepEqual(cancelledFrames, [1, 2], 'destroy cancels the resumed frame');
	assert.ok(observers.every((observer) => observer.disconnected === true), 'destroy disconnects this instance observers');
	assert.equal(target.listenerCount(), 0, 'destroy removes error listeners');
	assert.equal(documentTarget.listenerCount(), 0, 'destroy removes visibility listeners');
	telemetry.destroy();
});

test('status and menu UI avoid redundant startup work and release their listeners', () => {
	let canvasSize = '800 × 600px';
	let canvasWrites = 0;
	const status = createStatusBar({
		pointerEl: { textContent: '' },
		selectionEl: { textContent: '' },
		canvasSizeEl: {
			get textContent() { return canvasSize; },
			set textContent(value) { canvasWrites += 1; canvasSize = value; },
		},
		flashEl: { textContent: '' },
	});
	status.setCanvasSize(800, 600);
	assert.equal(canvasWrites, 0, 'the static default canvas-size label is not written again at startup');
	status.setCanvasSize(801, 600);
	assert.equal(canvasWrites, 1, 'a genuine resize still updates the label');

	const trigger = eventTarget();
	const root = eventTarget();
	root.querySelectorAll = (selector) => selector === '.action-menu-trigger' ? [trigger] : [];
	const menus = createActionMenuController({ root });
	menus.bind();
	assert.equal(root.listenerCount(), 3, 'the menu owner registers its three root handlers');
	assert.equal(trigger.listenerCount(), 1, 'the trigger is bound once');
	menus.destroy();
	assert.equal(root.listenerCount(), 0, 'menu destroy removes root handlers');
	assert.equal(trigger.listenerCount(), 0, 'menu destroy removes trigger handlers');
});

test('action menus place fixed popups on the RTL inline-end side', () => {
	const previousDocument = globalThis.document;
	const previousWindow = globalThis.window;
	const style = {
		removeProperty(name) { delete this[name]; },
	};
	const items = {
		style,
		dataset: {},
		getBoundingClientRect: () => ({ width: 180, height: 80 }),
		querySelector: () => null,
	};
	const classes = new Set();
	const menu = {
		hidden: true,
		dataset: {},
		classList: {
			add: (name) => classes.add(name),
			remove: (name) => classes.delete(name),
			contains: (name) => classes.has(name),
		},
		querySelector: (selector) => selector === '.action-menu-items' ? items : null,
	};
	const root = {
		documentElement: { dir: 'rtl' },
		querySelectorAll: (selector) => selector === '.action-menu.open' && classes.has('open') ? [menu] : [],
		addEventListener: () => {},
		removeEventListener: () => {},
	};
	globalThis.document = root;
	globalThis.window = { innerWidth: 1000, innerHeight: 700 };
	try {
		const menus = createActionMenuController({ root });
		assert.equal(menus.openAt(menu, { x: 220, y: 100 }), true);
		assert.equal(style.right, '600px', 'RTL context menus use a physical right anchor');
		assert.equal(style.left, '', 'RTL context menus clear the physical left anchor');
		menus.closeAll();
		assert.equal(style.right, undefined, 'closing clears the RTL anchor');
	} finally {
		if (previousDocument === undefined) delete globalThis.document;
		else globalThis.document = previousDocument;
		if (previousWindow === undefined) delete globalThis.window;
		else globalThis.window = previousWindow;
	}
});

test('PanelLayoutManager releases ribbon pointer and control listeners', () => {
	const handle = eventTarget();
	const restoreButton = eventTarget();
	const settingsButton = eventTarget();
	const app = {
		classList: { add: () => {}, remove: () => {} },
		dataset: {},
	};
	const panel = {
		...eventTarget(),
		style: { removeProperty: () => {} },
		querySelector: (selector) => selector === '#ribbon-drag-handle' ? handle : null,
		setAttribute: () => {},
	};
	const layout = new PanelLayoutManager({ app, panel, restoreButton, settingsButton });
	assert.equal(handle.listenerCount(), 1, 'the floating ribbon has one named pointer-down handler');
	assert.equal(restoreButton.listenerCount(), 1);
	assert.equal(settingsButton.listenerCount(), 1);
	layout.destroy();
	assert.equal(handle.listenerCount(), 0, 'destroy releases the pointer handler');
	assert.equal(restoreButton.listenerCount(), 0, 'destroy releases restore control');
	assert.equal(settingsButton.listenerCount(), 0, 'destroy releases settings control');
});

test('SettingsStore validates, persists, and notifies one contract', () => {
	const storage = memoryStorage();
	const changes = [];
	const store = createSettingsStore({
		storage,
		key: 'test:settings',
		defaults: { zoom: 100, background: 'solid' },
		validators: { zoom: (value) => Number.isFinite(value) && value > 0, background: (value) => ['solid', 'transparent'].includes(value) },
	});
	const unsubscribe = store.subscribe((value) => changes.push(value));
	store.set({ zoom: 150, background: 'invalid' });
	assert.deepEqual(store.get(), { zoom: 150, background: 'solid' });
	assert.equal(JSON.parse(storage.getItem('test:settings')).schemaVersion, 1);
	unsubscribe();
	store.reset();
	assert.equal(changes.length, 1);
});

test('PaintDocument establishes durable future ownership boundaries', () => {
	const document = createPaintDocument({ id: 'doc-test', width: 20, height: 30 });
	assert.equal(document.pixels.width, 20);
	assert.deepEqual(document.textObjects, []);
	assert.equal(isPaintDocument(document), true);
	assert.equal(isPaintDocument({}), false);
});

test('History session entries are current/newest first and delete by stable ID', () => {
	let serial = 0;
	const canvasManager = {
		width: 20,
		height: 10,
		canvas: { toDataURL: () => `data:image/png;base64,${++serial}` },
		_pixelsSignature: () => null,
	};
	const history = new HistoryManager(canvasManager);
	history.snapshot({ force: true });
	history.snapshot({ force: true });
	const entries = history.getSessionEntries();
	assert.deepEqual(entries.map((entry) => entry.kind), ['current', 'session', 'session']);
	const newestSnapshot = entries[1];
	assert.equal(history.removeSessionEntry(newestSnapshot.id), true);
	assert.equal(history.getSessionEntries().some((entry) => entry.id === newestSnapshot.id), false);
	assert.equal(history.removeSessionEntry('current'), true);
	assert.equal(history.getSessionEntries()[0].kind, 'session');
});

test('HistoryManager captures Blob snapshots before mutation, revokes owned URLs, and skips oversized encodes', async () => {
	const captures = [];
	const resolvers = [];
	const loaded = [];
	const revoked = [];
	let marker = 'before';
	const canvasManager = {
		width: 10,
		height: 10,
		_pixelsSignature: () => marker,
		toBlob: () => {
			captures.push(marker);
			return new Promise((resolve) => resolvers.push(resolve));
		},
		loadImageDataUrl: async (url) => {
			loaded.push(url);
			return true;
		},
		persistToStorage: () => {},
	};
	let urlId = 0;
	const history = new HistoryManager(canvasManager, {
		urlApi: {
			createObjectURL: () => `blob:history-${++urlId}`,
			revokeObjectURL: (url) => revoked.push(url),
		},
		sessionStorage: memoryStorage(),
	});
	assert.equal(history.snapshot({ force: true }), true);
	assert.deepEqual(captures, ['before'], 'toBlob starts synchronously before a tool can mutate pixels');
	marker = 'after';
	const undo = history.undo();
	await Promise.resolve();
	assert.deepEqual(captures, ['before', 'after'], 'undo captures current pixels before waiting for the old PNG');
	resolvers.shift()(new Blob(['before'], { type: 'image/png' }));
	assert.equal(await undo, true);
	assert.equal(loaded[0], 'blob:history-1');
	resolvers.shift()(new Blob(['after'], { type: 'image/png' }));
	await waitForTasks();
	history.clear();
	assert.deepEqual(revoked.sort(), ['blob:history-1', 'blob:history-2']);

	let largeCaptureCalls = 0;
	const rejections = [];
	const largeHistory = new HistoryManager({
		width: 4097,
		height: 4096,
		toBlob: () => { largeCaptureCalls += 1; return Promise.resolve(new Blob(['large'], { type: 'image/png' })); },
	}, { sessionStorage: memoryStorage() });
	largeHistory.onSnapshotRejected = (rejection) => rejections.push(rejection);
	assert.equal(4097 * 4096 > MAX_HISTORY_SNAPSHOT_PIXELS, true);
	assert.equal(largeHistory.snapshot({ force: true }), false);
	assert.equal(largeCaptureCalls, 0, 'oversized history never begins a PNG encode');
	assert.match(rejections[0].message, /protect memory/);
});

test('color contract normalizes alpha without losing legacy hex input', () => {
	assert.deepEqual(normalizeRgba('#336699'), { r: 51, g: 102, b: 153, a: 1 });
	assert.equal(colorStateToCss({ hex: '#336699', alpha: 0.5 }), 'rgba(51, 102, 153, 0.5)');
});

test('text document store keeps revisions and serializable editable objects', () => {
	const store = createTextDocumentStore();
	const added = store.add({ text: 'Hello', x: 4, y: 8, styles: ['bold', 'bold'] });
	assert.equal(added.text, 'Hello');
	assert.deepEqual(store.getAll()[0].styles, ['bold']);
	const updated = store.update(added.id, { text: 'Hello world' });
	assert.equal(updated.revision, 1);
	assert.match(store.serialize(), /Hello world/);
	assert.equal(store.remove(added.id), true);
});

test('text history is newest-first, de-duplicated, persisted, and bounded', () => {
	const storage = memoryStorage();
	const store = createTextHistoryStore({ storage, maxEntries: 3 });
	store.record({ text: 'first', fontSize: 20 });
	store.record({ text: 'second', fontSize: 20 });
	store.record({ text: 'third', fontSize: 20 });
	store.record({ text: 'fourth', fontSize: 20 });
	assert.deepEqual(store.getAll().map((entry) => entry.text), ['fourth', 'third', 'second']);
	store.record({ text: 'third', fontSize: 20 });
	assert.deepEqual(store.getAll().map((entry) => entry.text), ['third', 'fourth', 'second']);
	assert.equal(JSON.parse(storage.getItem('paint:text-history')).length, 3);
	const restored = createTextHistoryStore({ storage, maxEntries: 3 });
	assert.equal(restored.getAll()[0].text, 'third');
	assert.equal(restored.clear(), true);
	assert.equal(storage.getItem('paint:text-history'), null);
});

test('memory report separates known history bytes from browser quota', () => {
	const dataUrl = `data:image/png;base64,${'A'.repeat(400)}`;
	assert.ok(estimateDataUrlBytes(dataUrl) > 0);
	const report = makeMemoryReport({ historyEntries: [{ dataUrl, width: 10, height: 10 }], objectUrlCount: 2 });
	assert.equal(report.storageQuotaIsSeparate, true);
	assert.equal(report.objectUrlCount, 2);
});

test('image admission accepts bounded decoded sources and leaves target optional', () => {
	const result = assessImageAdmission({ width: 4096, height: 8192 });
	assert.deepEqual(result, {
		ok: true,
		reason: null,
		message: '',
		width: 4096,
		height: 8192,
		targetWidth: null,
		targetHeight: null,
	});
	assert.equal(4096 * 8192, LIMITS.maxImportPixels);
	const placement = assessImageAdmission({ width: 10, height: 10, targetWidth: 500, targetHeight: 400 });
	assert.equal(placement.ok, true);
	assert.equal(placement.targetWidth, 500);
	assert.equal(placement.targetHeight, 400);
});

test('image admission rejects invalid, oversized, and over-pixel decoded sources', () => {
	assert.equal(
		assessImageAdmission({ width: 0, height: 10 }).reason,
		IMAGE_ADMISSION_REASONS.invalidDimensions,
	);
	assert.equal(
		assessImageAdmission({ width: LIMITS.maxCanvasDimension + 1, height: 1 }).reason,
		IMAGE_ADMISSION_REASONS.sourceDimensionLimit,
	);
	assert.equal(
		assessImageAdmission({ width: 4096, height: 8193 }).reason,
		IMAGE_ADMISSION_REASONS.sourcePixelLimit,
	);
});

test('image admission independently validates a final target canvas', () => {
	assert.equal(
		assessImageAdmission({ width: 10, height: 10, targetWidth: LIMITS.maxCanvasDimension + 1, targetHeight: 10 }).reason,
		IMAGE_ADMISSION_REASONS.targetDimensionLimit,
	);
	assert.equal(
		assessImageAdmission({ width: 10, height: 10, targetWidth: 4096, targetHeight: 8193 }).reason,
		IMAGE_ADMISSION_REASONS.targetPixelLimit,
	);
	assert.equal(
		assessImageAdmission({ width: 10, height: 10, targetWidth: 10 }).reason,
		IMAGE_ADMISSION_REASONS.invalidDimensions,
	);
});

test('CanvasManager rejects unsafe resizes before replacing the current canvas', () => {
	const context = {
		fillRect: () => {},
		clearRect: () => {},
		getImageData: (_x, _y, width, height) => ({ data: new Uint8ClampedArray(width * height * 4) }),
		save: () => {},
		restore: () => {},
	};
	const canvas = { width: 0, height: 0, getContext: () => context };
	const overlay = { width: 0, height: 0, getContext: () => context };
	const previousDocument = globalThis.document;
	globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => context }) };
	try {
		const manager = new CanvasManager({ canvas, overlay, width: 40, height: 20 });
		let rejection = null;
		manager.onAdmissionRejected = (result) => { rejection = result; };
		assert.equal(manager.resize(LIMITS.maxCanvasDimension + 1, 20), false);
		assert.deepEqual([manager.width, manager.height], [40, 20]);
		assert.equal(rejection.reason, IMAGE_ADMISSION_REASONS.sourceDimensionLimit);
	} finally {
		if (previousDocument) globalThis.document = previousDocument;
		else delete globalThis.document;
	}
});

test('CanvasManager revokes a temporary object URL after loading a saved Blob', async () => {
	const context = {
		fillRect: () => {},
		clearRect: () => {},
		drawImage: () => {},
		getImageData: (_x, _y, width, height) => ({ data: new Uint8ClampedArray(width * height * 4) }),
		save: () => {},
		restore: () => {},
	};
	const canvas = { width: 0, height: 0, getContext: () => context };
	const overlay = { width: 0, height: 0, getContext: () => context };
	const previousDocument = globalThis.document;
	const previousImage = globalThis.Image;
	globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => context }) };
	globalThis.Image = class {
		constructor() { this.width = 24; this.height = 12; }
		set src(_value) { queueMicrotask(() => this.onload?.()); }
	};
	try {
		const manager = new CanvasManager({ canvas, overlay, width: 20, height: 10 });
		const revoked = [];
		const loaded = await manager.loadImageBlob(new Blob(['paint'], { type: 'image/png' }), 24, 12, {
			urlApi: {
				createObjectURL: () => 'blob:working-canvas',
				revokeObjectURL: (url) => revoked.push(url),
			},
		});
		assert.equal(loaded, true);
		assert.deepEqual([manager.width, manager.height], [24, 12]);
		assert.deepEqual(revoked, ['blob:working-canvas']);
	} finally {
		if (previousDocument) globalThis.document = previousDocument;
		else delete globalThis.document;
		if (previousImage) globalThis.Image = previousImage;
		else delete globalThis.Image;
	}
});

test('ClipboardManager rejects an unsafe image before committing or snapshotting work', async () => {
	let commits = 0;
	let snapshots = 0;
	let closed = 0;
	const messages = [];
	const clipboard = new ClipboardManager({
		canvasManager: {
			width: 100,
			height: 100,
			isCleanDocument: () => true,
			resize: () => { throw new Error('unsafe image must not resize'); },
		},
		historyManager: { snapshot: () => { snapshots += 1; } },
		getSelection: () => null,
		setSelection: () => {},
		statusBar: { flash: (message) => messages.push(message) },
		setActiveTool: () => {},
		commitFloatingSelection: () => { commits += 1; },
	});
	const result = await clipboard.insertBitmapAsFloatingSelection({
		width: LIMITS.maxCanvasDimension + 1,
		height: 1,
		close: () => { closed += 1; },
	});
	assert.equal(result, null);
	assert.equal(commits, 0);
	assert.equal(snapshots, 0);
	assert.equal(closed, 1);
	assert.match(messages[0], /10000px limit/);
});

test('canvas autosave exposes a teardown handle for its change listener', () => {
	const listeners = new Map();
	const eventTarget = {
		addEventListener: (name, listener) => listeners.set(name, listener),
		removeEventListener: (name, listener) => {
			if (listeners.get(name) === listener) listeners.delete(name);
		},
	};
	const cleanup = installCanvasAutosave({ canvas: {}, eventTarget });
	assert.equal(listeners.size, 1);
	cleanup();
	assert.equal(listeners.size, 0);
});

test('working-canvas records accept v1 and legacy records but reject damaged data', () => {
	const now = 1_700_000_000_000;
	const blob = new Blob(['png'], { type: 'image/png' });
	const current = normalizeWorkingRecord({
		schemaVersion: WORKING_CANVAS_SCHEMA_VERSION,
		kind: 'working-raster',
		blob,
		width: 20,
		height: 10,
		updatedAt: now,
	}, { now });
	assert.equal(current.ok, true);
	assert.equal(current.legacy, false);
	assert.equal(current.record.blob, blob);

	const legacy = normalizeWorkingRecord({ blob, width: 20, height: 10, updatedAt: now }, { now });
	assert.equal(legacy.ok, true);
	assert.equal(legacy.legacy, true, 'unversioned IndexedDB records remain readable');

	const corrupt = normalizeWorkingRecord({ blob, width: '20', height: 10, updatedAt: now }, { now });
	assert.equal(corrupt.ok, false, 'string dimensions are not silently coerced');
	assert.equal(
		classifyStorageError(new DOMException('storage full', 'QuotaExceededError'), 'write').kind,
		STORAGE_FAILURE_KINDS.quota,
	);
});

test('working-canvas save/load uses the versioned IndexedDB record and exposes quota failure', async () => {
	const indexedDb = createFakeIndexedDb();
	const blob = new Blob(['paint'], { type: 'image/png' });
	const saved = await saveCanvasState({
		getBlob: async () => blob,
		metadata: { width: 24, height: 12 },
		indexedDb,
	});
	assert.equal(saved.ok, true);
	assert.equal(saved.record.schemaVersion, WORKING_CANVAS_SCHEMA_VERSION);
	assert.equal(saved.record.kind, 'working-raster');
	assert.equal(indexedDb.records.get('last-canvas').blob, blob);

	const loaded = await loadCanvasState({ indexedDb, maxAgeMs: Infinity });
	assert.equal(loaded.ok, true);
	assert.equal(loaded.record.width, 24);
	assert.equal(loaded.record.height, 12);
	assert.equal(loaded.record.blob, blob);
	assert.ok(indexedDb.closed >= 2, 'every IDB operation closes its database handle');

	const quotaError = new DOMException('quota', 'QuotaExceededError');
	const quota = await saveCanvasState({
		getBlob: async () => blob,
		metadata: { width: 24, height: 12 },
		indexedDb: createFakeIndexedDb({ writeError: quotaError }),
	});
	assert.equal(quota.ok, false);
	assert.equal(quota.failure.kind, STORAGE_FAILURE_KINDS.quota);

	let encoded = false;
	const tooLarge = await saveCanvasState({
		getBlob: async () => {
			encoded = true;
			return blob;
		},
		metadata: { width: 4097, height: 4096 },
		indexedDb,
	});
	assert.equal(4097 * 4096 > WORKING_CANVAS_MAX_AUTOSAVE_PIXELS, true);
	assert.equal(tooLarge.ok, false);
	assert.equal(tooLarge.failure.kind, STORAGE_FAILURE_KINDS.encode);
	assert.equal(encoded, false, 'large canvases are rejected before PNG encoding allocates memory');
});

test('canvas autosave serializes a newer change behind an active save', async () => {
	const bus = createEventBus();
	const calls = [];
	const pending = [];
	const dispose = installCanvasAutosave({
		eventBus: bus,
		debounceMs: 0,
		getBlob: async () => new Blob(['paint'], { type: 'image/png' }),
		getMetadata: () => ({ width: 10, height: 10 }),
		save: () => new Promise((resolve) => {
			calls.push('save');
			pending.push(resolve);
		}),
	});
	bus.emit('paint:document-changed');
	await waitForTasks();
	assert.deepEqual(calls, ['save']);
	bus.emit('paint:document-changed');
	await waitForTasks();
	assert.deepEqual(calls, ['save'], 'a second change waits for the active write');
	pending.shift()({ ok: true });
	await waitForTasks();
	assert.deepEqual(calls, ['save', 'save'], 'the final write captures the newest state');
	pending.shift()({ ok: true });
	await dispose.flush();
	dispose();
});

test('canvas autosave permits reload only after the latest revision is durable', async () => {
	const bus = createEventBus();
	const saves = [];
	const autosave = installCanvasAutosave({
		eventBus: bus,
		debounceMs: 60_000,
		getBlob: async () => new Blob(['paint'], { type: 'image/png' }),
		getMetadata: () => ({ width: 10, height: 10 }),
		save: () => new Promise((resolve) => saves.push(resolve)),
	});

	assert.equal(autosave.isSafeToReload(), true, 'a clean document needs no write before reload');
	bus.emit(EVENTS.documentChanged);
	assert.equal(autosave.getState().reason, 'autosave-pending');
	assert.equal(autosave.isSafeToReload(), false, 'a debounced change is not durable');

	const persisted = autosave.prepareForReload();
	assert.equal(saves.length, 1, 'reload preparation flushes the debounce once');
	assert.equal(autosave.getState().reason, 'autosave-saving');
	saves.shift()({ ok: true });
	assert.equal((await persisted).ok, true);
	assert.equal(autosave.isSafeToReload(), true, 'only a completed write clears the reload guard');

	bus.emit(EVENTS.documentChanged);
	const rejected = autosave.prepareForReload();
	assert.equal(saves.length, 1);
	saves.shift()({
		ok: false,
		failure: { kind: STORAGE_FAILURE_KINDS.quota, message: 'Autosave storage is full.' },
	});
	const failed = await rejected;
	assert.equal(failed.ok, false);
	assert.equal(failed.reason, 'autosave-failed');
	assert.equal(autosave.getState().failed, true);
	assert.equal(autosave.isSafeToReload(), false, 'a failed current write stays blocked');
	assert.equal((await autosave.prepareForReload()).reason, 'autosave-failed');
	assert.equal(saves.length, 0, 'a PWA update never hides a storage failure with an implicit retry');

	autosave();
	const unavailable = installCanvasAutosave({ canvas: {}, eventTarget: null });
	assert.equal(unavailable.isSafeToReload(), false);
	assert.equal((await unavailable.prepareForReload()).reason, 'autosave-unavailable');
});

test('canvas autosave publishes a quota failure to the EventBus and callback', async () => {
	const bus = createEventBus();
	const busFailures = [];
	const callbackFailures = [];
	bus.on(EVENTS.storageError, (failure) => busFailures.push(failure));
	const dispose = installCanvasAutosave({
		eventBus: bus,
		debounceMs: 0,
		getBlob: async () => new Blob(['paint'], { type: 'image/png' }),
		getMetadata: () => ({ width: 10, height: 10 }),
		save: async () => ({
			ok: false,
			failure: { kind: STORAGE_FAILURE_KINDS.quota, message: 'Autosave storage is full.' },
		}),
		onError: (failure) => callbackFailures.push(failure),
	});
	bus.emit(EVENTS.documentChanged);
	await waitForTasks();
	assert.equal(busFailures[0].kind, STORAGE_FAILURE_KINDS.quota);
	assert.equal(callbackFailures[0].kind, STORAGE_FAILURE_KINDS.quota);
	dispose();
});
