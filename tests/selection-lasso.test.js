import assert from 'node:assert/strict';
import test from 'node:test';

import { CanvasManager } from '../js/canvas/CanvasManager.js';
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
		assert.ok(outputs[0].context.calls.some(([name]) => name === 'clip'));
		assert.ok(outputs[0].context.calls.some(([name, image]) => name === 'drawImage' && image === source));

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
