import assert from 'node:assert/strict';
import test from 'node:test';

import { CanvasManager } from '../js/canvas/CanvasManager.js';
import { ClipboardManager } from '../js/clipboard/ClipboardManager.js';
import { createSelectionModeController } from '../js/app/selectionModeController.js';
import { createClipboardService } from '../js/services/clipboard/clipboardService.js';
import { createSelectTool } from '../js/tools/SelectTool.js';
import {
	appendLassoPoint,
	fitPathToBounds,
	getPathBounds,
	isPointInPath,
	rotatePathToBounds,
	translatePath,
} from '../js/services/selection/selectionGeometry.js';

test('lasso geometry bounds, hit-tests, and transforms polygon vertices', () => {
	const path = [{ x: 5, y: 7 }, { x: 25, y: 7 }, { x: 25, y: 27 }, { x: 5, y: 27 }];
	const bounds = getPathBounds(path);
	assert.deepEqual(bounds, { x: 5, y: 7, w: 20, h: 20 });
	assert.equal(isPointInPath({ x: 10, y: 10 }, path), true);
	assert.equal(isPointInPath({ x: 29, y: 28 }, path), false);
	assert.equal(isPointInPath({ x: 15, y: 7 }, path), true, 'polygon edges remain draggable');
	assert.deepEqual(translatePath(path, 3, -2)[0], { x: 8, y: 5 });
	assert.deepEqual(fitPathToBounds(path, bounds, { x: 10, y: 10, w: 40, h: 10 }), [
		{ x: 10, y: 10 }, { x: 50, y: 10 }, { x: 50, y: 20 }, { x: 10, y: 20 },
	]);
	assert.deepEqual(rotatePathToBounds(path, bounds, { x: 5, y: 7, w: 20, h: 20 }, 90)
		.map(({ x, y }) => ({ x: Math.round(x), y: Math.round(y) })), [
		{ x: 25, y: 7 }, { x: 25, y: 27 }, { x: 5, y: 27 }, { x: 5, y: 7 },
	]);
});

test('lasso point capture filters close samples and remains bounded', () => {
	const path = [];
	appendLassoPoint(path, { x: 0, y: 0 }, { minDistance: 1, maxPoints: 8 });
	appendLassoPoint(path, { x: 0.25, y: 0.25 }, { minDistance: 1, maxPoints: 8 });
	assert.equal(path.length, 1);
	for (let index = 1; index < 30; index++) {
		appendLassoPoint(path, { x: index, y: index % 2 }, { minDistance: 0, maxPoints: 8 });
	}
	assert.ok(path.length <= 8);
	assert.deepEqual(path.at(-1), { x: 29, y: 1 });
});

const makeSelectionContext = () => {
	let selection = null;
	const historyCalls = [];
	const canvasManager = {
		width: 100,
		height: 100,
		floatingCanvas: null,
		backgroundColor: '#fff',
		extractRegion: (region) => {
			canvasManager.extracted = region;
			return { width: region.w, height: region.h };
		},
		fillRegion: (region) => { canvasManager.filled = region; },
		persistToStorage: () => {},
	};
	return {
		canvasManager,
		historyManager: {
			beginTransaction: () => historyCalls.push('begin'),
			setTransactionChanged: (changed) => historyCalls.push(changed),
		},
		historyCalls,
		getSelection: () => selection,
		setSelection: (next) => { selection = next; },
		setMarqueeStatus: () => {},
		commitFloatingSelection: () => {},
		repaintSelectionFrame: () => {},
	};
};

test('Select tool captures a lasso, then moves its polygon with the floating pixels', () => {
	let pendingFrame;
	const tool = createSelectTool({
		requestFrame: (callback) => { pendingFrame = callback; return 1; },
		cancelFrame: () => { pendingFrame = null; },
	});
	const context = makeSelectionContext();
	tool.setMode('lasso');
	tool.onDown({ x: 10, y: 10 }, context);
	tool.onMove({ x: 30, y: 10 }, context);
	tool.onMove({ x: 30, y: 30 }, context);
	pendingFrame?.();
	tool.onUp({ x: 10, y: 30 }, context);

	const original = context.getSelection();
	assert.deepEqual(original, {
		x: 10,
		y: 10,
		w: 20,
		h: 20,
		path: [{ x: 10, y: 10 }, { x: 30, y: 10 }, { x: 30, y: 30 }, { x: 10, y: 30 }],
	});
	tool.onDown({ x: 20, y: 20 }, context);
	assert.equal(context.canvasManager.extracted.path.length, 4);
	tool.onMove({ x: 25, y: 23 }, context);
	const moved = context.getSelection();
	assert.deepEqual(moved.path[0], { x: 15, y: 13 });
	assert.equal(context.historyCalls[0], 'begin');
	assert.equal(context.historyCalls[1], true);
	tool.onUp({ x: 25, y: 23 }, context);
});

test('lasso hit-testing does not treat empty corners inside the bounds as selected', () => {
	const tool = createSelectTool({ requestFrame: () => 1, cancelFrame: () => {} });
	const context = makeSelectionContext();
	const triangle = [{ x: 10, y: 10 }, { x: 30, y: 10 }, { x: 30, y: 30 }];
	context.setSelection({ x: 10, y: 10, w: 20, h: 20, path: triangle });
	tool.setMode('lasso');
	tool.onDown({ x: 11, y: 29 }, context);
	assert.equal(context.canvasManager.extracted, undefined);
	assert.equal(context.historyCalls.length, 0);
	assert.equal(context.getSelection(), null, 'outside polygon starts a new lasso instead of lifting');
});

test('selection mode updates visible toolbar icons and keeps the active mode state', () => {
	const makeButton = (icon) => {
		const classes = new Set();
		const attributes = {};
		const listeners = new Map();
		const svg = { innerHTML: icon };
		return {
			classList: {
				toggle: (name, active) => active ? classes.add(name) : classes.delete(name),
				contains: (name) => classes.has(name),
			},
			setAttribute: (name, value) => { attributes[name] = value; },
			getAttribute: (name) => attributes[name],
			querySelector: () => svg,
			addEventListener: (name, listener) => listeners.set(name, listener),
			removeEventListener: (name, listener) => {
				if (listeners.get(name) === listener) listeners.delete(name);
			},
			svg,
		};
	};
	const rectangleButton = makeButton('<rect />');
	const lassoButton = makeButton('<path />');
	const toolbarButton = makeButton('<rect />');
	const calls = [];
	const tool = createSelectTool();
	const controller = createSelectionModeController({
		selectTool: tool,
		toolManager: { setActive: (name) => calls.push(name) },
		rectangleButton,
		lassoButton,
		selectionButtons: [toolbarButton],
	});

	controller.setMode('lasso');
	assert.equal(toolbarButton.svg.innerHTML, '<path />');
	assert.equal(lassoButton.getAttribute('aria-checked'), 'true');
	assert.equal(rectangleButton.getAttribute('aria-checked'), 'false');
	assert.deepEqual(calls, ['select']);
	controller.setMode('rect');
	assert.equal(toolbarButton.svg.innerHTML, '<rect />');
	controller.destroy();
});

test('copy captures current pixels for a static selection without lifting it', async () => {
	const previousClipboard = Object.getOwnPropertyDescriptor(globalThis.navigator, 'clipboard');
	const previousClipboardItem = Object.getOwnPropertyDescriptor(globalThis, 'ClipboardItem');
	const regions = [];
	const written = [];
	const selection = { x: 12, y: 18, w: 24, h: 16, path: [{ x: 12, y: 18 }, { x: 36, y: 18 }, { x: 24, y: 34 }] };
	const manager = new ClipboardManager({
		canvasManager: {
			floatingCanvas: null,
			extractRegion: (region) => {
				regions.push(region);
				return { toDataURL: () => 'data:image/png;base64,cG5n' };
			},
		},
		historyManager: {},
		getSelection: () => selection,
		setSelection: () => {},
		statusBar: { flash: () => {} },
		setActiveTool: () => {},
		commitFloatingSelection: () => {},
	});
	globalThis.ClipboardItem = class {
		constructor(items) { this.items = items; }
	};
	Object.defineProperty(globalThis.navigator, 'clipboard', {
		value: { write: async (items) => written.push(items) },
		configurable: true,
	});
	try {
		assert.equal(await manager.copy(), true);
		assert.equal(regions[0], selection, 'the current marquee path is sent to canvas extraction');
		assert.equal(manager.lastCopiedBlob.type, 'image/png');
		assert.equal(await manager.lastCopiedBlob.text(), 'png');
		assert.equal(written.length, 1);
		assert.equal(manager.canvasManager?.floatingCanvas, null);

		selection.x = 20;
		await manager.copy();
		assert.equal(regions[1].x, 20, 'a subsequent copy uses the resized/moved current bounds');
	} finally {
		if (previousClipboard) Object.defineProperty(globalThis.navigator, 'clipboard', previousClipboard);
		else delete globalThis.navigator.clipboard;
		if (previousClipboardItem) Object.defineProperty(globalThis, 'ClipboardItem', previousClipboardItem);
		else delete globalThis.ClipboardItem;
	}
});

test('pending in-app image copy wins paste when the OS still exposes stale pixels', async () => {
	let pasteCount = 0;
	let defaultPrevented = false;
	const clipboardManager = {
		pendingInternalPaste: true,
		lastCopiedBlob: new Blob(['latest']),
		pasteLastCopied: async () => { pasteCount += 1; },
	};
	const service = createClipboardService({ clipboardManager, documentRef: null });
	await service.handlePaste({
		target: { tagName: 'DIV' },
		clipboardData: { items: [{ type: 'image/png', getAsFile: () => new Blob(['stale']) }] },
		preventDefault: () => { defaultPrevented = true; },
	});
	assert.equal(defaultPrevented, true);
	assert.equal(pasteCount, 1);
});

test('pasting clears a static marquee before creating the pasted floating selection', async () => {
	const previousDocument = globalThis.document;
	const events = [];
	const canvasManager = {
		width: 100,
		height: 100,
		floatingCanvas: null,
		isCleanDocument: () => false,
		persistToStorage: () => {},
	};
	globalThis.document = {
		createElement: () => ({
			width: 0,
			height: 0,
			getContext: () => ({ drawImage: () => events.push('draw-pasted-image') }),
		}),
	};
	const manager = new ClipboardManager({
		canvasManager,
		historyManager: { snapshot: () => events.push('snapshot') },
		getSelection: () => ({ x: 5, y: 5, w: 20, h: 20 }),
		setSelection: (selection) => events.push(selection ? 'set-pasted-selection' : 'clear-old-selection'),
		statusBar: { currentPointer: null, flash: () => {} },
		setActiveTool: () => {},
		commitFloatingSelection: () => events.push('commit-existing-float'),
	});
	try {
		const result = await manager.insertBitmapAsFloatingSelection({
			width: 12,
			height: 8,
			close: () => events.push('close-bitmap'),
		});
		assert.deepEqual(result, { x: 0, y: 0, w: 12, h: 8 });
		assert.ok(events.indexOf('clear-old-selection') < events.indexOf('snapshot'));
		assert.ok(events.indexOf('snapshot') < events.indexOf('set-pasted-selection'));
		assert.equal(canvasManager.floatingCanvas.width, 12);
	} finally {
		globalThis.document = previousDocument;
	}
});

class RecordingContext {
	constructor() { this.calls = []; }
	save() { this.calls.push(['save']); }
	restore() { this.calls.push(['restore']); }
	translate(...args) { this.calls.push(['translate', ...args]); }
	beginPath() { this.calls.push(['beginPath']); }
	moveTo(...args) { this.calls.push(['moveTo', ...args]); }
	lineTo(...args) { this.calls.push(['lineTo', ...args]); }
	closePath() { this.calls.push(['closePath']); }
	clip() { this.calls.push(['clip']); }
	fillRect(...args) { this.calls.push(['fillRect', ...args]); }
	drawImage(...args) { this.calls.push(['drawImage', ...args]); }
	clearRect(...args) { this.calls.push(['clearRect', ...args]); }
}

test('CanvasManager clips lasso extraction and background clearing to the path', () => {
	const previousDocument = globalThis.document;
	const outputs = [];
	globalThis.document = {
		createElement: () => {
			const canvas = { width: 0, height: 0, context: new RecordingContext() };
			canvas.getContext = () => canvas.context;
			outputs.push(canvas);
			return canvas;
		},
	};
	try {
		const source = {};
		const manager = Object.create(CanvasManager.prototype);
		manager.width = 40;
		manager.height = 40;
		manager.createCompositeCanvas = () => source;
		const region = {
			x: 10,
			y: 10,
			w: 20,
			h: 20,
			path: [{ x: 10, y: 10 }, { x: 30, y: 10 }, { x: 20, y: 30 }],
		};
		const extracted = manager.extractRegion(region);
		assert.equal(extracted.width, 20);
		assert.equal(extracted.height, 20);
		const calls = outputs[0].context.calls;
		assert.ok(calls.some(([name]) => name === 'clip'));
		assert.deepEqual(calls.find(([name]) => name === 'moveTo'), ['moveTo', 0, 0],
			'absolute polygon coordinates are made local to the extracted bounding box');
		assert.deepEqual(calls.filter(([name]) => name === 'lineTo'), [
			['lineTo', 20, 0],
			['lineTo', 10, 20],
		]);
		assert.ok(calls.some(([name, image, ...args]) => name === 'drawImage'
			&& image === source && args.join(',') === '10,10,20,20,0,0,20,20'));
		assert.equal(calls.some(([name]) => name === 'translate'), false,
			'the crop draw is not shifted by the path-origin transform');

		manager.ctx = new RecordingContext();
		manager.backgroundMode = 'solid';
		manager.backgroundColor = '#fff';
		manager.fillRegion(region, '#fff');
		const names = manager.ctx.calls.map(([name]) => name);
		assert.ok(names.indexOf('clip') > -1);
		assert.ok(names.indexOf('clip') < names.indexOf('fillRect'));
	} finally {
		if (previousDocument === undefined) delete globalThis.document;
		else globalThis.document = previousDocument;
	}
});
