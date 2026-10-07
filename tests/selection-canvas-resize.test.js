import assert from 'node:assert/strict';
import test from 'node:test';

import { CanvasManager } from '../js/canvas/CanvasManager.js';
import { createSelectionOverlayController } from '../js/app/selectionOverlayController.js';

const createContext = (calls = []) => ({
	drawImage: (...args) => calls.push(args),
	fillRect() {},
	clearRect() {},
	getImageData: (_x, _y, width, height) => ({ data: new Uint8ClampedArray(width * height * 4) }),
	save() {},
	restore() {},
});

const createCanvas = (width = 0, height = 0, calls = []) => {
	const context = createContext(calls);
	return {
		width,
		height,
		getContext: () => context,
	};
};

const createEventTarget = () => {
	const listeners = new Map();
	return {
		addEventListener(type, listener) { listeners.set(type, listener); },
		removeEventListener(type, listener) {
			if (listeners.get(type) === listener) listeners.delete(type);
		},
		dispatch(type, event) { listeners.get(type)?.(event); },
	};
};

const createResizeFixture = ({ selection, floatingCanvas = null, rtl = false } = {}) => {
	const handleListeners = new Map();
	const handle = {
		dataset: { selectionHandle: 'se' },
		addEventListener(type, listener) { handleListeners.set(type, listener); },
		removeEventListener(type, listener) {
			if (handleListeners.get(type) === listener) handleListeners.delete(type);
		},
	};
	const documentRef = {
		documentElement: {},
		querySelectorAll: () => [handle],
		getElementById: () => null,
		querySelector: () => null,
		createElement: () => createCanvas(),
	};
	const windowRef = createEventTarget();
	const resamples = [];
	const history = [];
	const stage = { style: { left: '', top: '' } };
	const canvasManager = {
		width: 100,
		height: 80,
		canvas: {
			getBoundingClientRect() {
				const left = (rtl ? 400 - canvasManager.width : 0)
					+ (Number.parseFloat(stage.style.left) || 0);
				const top = Number.parseFloat(stage.style.top) || 0;
				return {
					left,
					top,
					right: left + canvasManager.width,
					bottom: top + canvasManager.height,
					width: canvasManager.width,
					height: canvasManager.height,
				};
			},
		},
		selection,
		floatingCanvas,
		createCompositeCanvas: () => createCanvas(canvasManager.width, canvasManager.height),
		resample(options) {
			resamples.push(options);
			this.width = options.width;
			this.height = options.height;
			return true;
		},
		isCleanDocument: () => true,
		resetCleanBaseline: () => history.push('reset-clean-baseline'),
		persistToStorage: () => history.push('persist'),
	};
	const controller = createSelectionOverlayController({
		canvasManager,
		viewportManager: {
			stage,
			zoom: 100,
			invalidateGeometry() {},
			clientToImage: (x, y) => {
				const rect = canvasManager.canvas.getBoundingClientRect();
				return { x: x - rect.left, y: y - rect.top };
			},
		},
		historyManager: {
			beginTransaction: () => history.push('begin'),
			setTransactionChanged: (changed) => history.push(`changed:${changed}`),
			commitTransaction: () => history.push('commit'),
			abortTransaction: () => history.push('abort'),
		},
		setSelection: (next) => { canvasManager.selection = next; },
		isToolActive: () => true,
		isPreviewActive: () => false,
		documentRef,
		windowRef,
	});
	return {
		handle,
		handleListeners,
		windowRef,
		canvasManager,
		stage,
		resamples,
		history,
		bind: controller.bindSelectionHandles(),
	};
};

test('CanvasManager resamples pixels into the actual canvas and overlay dimensions', () => {
	const previousDocument = globalThis.document;
	const drawCalls = [];
	globalThis.document = { createElement: () => createCanvas(0, 0, drawCalls) };
	try {
		const canvas = createCanvas();
		const overlay = createCanvas();
		const manager = new CanvasManager({ canvas, overlay, width: 40, height: 20 });
		const source = createCanvas(40, 20);
		assert.equal(manager.resample({ source, width: 80, height: 40 }), true);
		assert.deepEqual([canvas.width, canvas.height], [80, 40]);
		assert.deepEqual([overlay.width, overlay.height], [80, 40]);
		assert.deepEqual([manager.width, manager.height], [80, 40]);
		assert.ok(drawCalls.some(([image, ...args]) => image === source
			&& args.join(',') === '0,0,40,20,0,0,80,40'));
		assert.equal(manager.isCleanDocument(), false, 'resampling marks the edited document dirty');
	} finally {
		if (previousDocument === undefined) delete globalThis.document;
		else globalThis.document = previousDocument;
	}
});

test('resizing a whole-canvas selection rescales the real document in one undo transaction', () => {
	const fixture = createResizeFixture({ selection: { x: 0, y: 0, w: 100, h: 80 } });
	fixture.handleListeners.get('pointerdown')({
		preventDefault() {},
		stopPropagation() {},
	});
	fixture.windowRef.dispatch('pointermove', { clientX: 135, clientY: 95 });

	assert.deepEqual([fixture.canvasManager.width, fixture.canvasManager.height], [135, 95]);
	assert.deepEqual(fixture.resamples.map(({ width, height }) => [width, height]), [[135, 95]]);
	assert.deepEqual(
		[fixture.resamples[0].source.width, fixture.resamples[0].source.height],
		[100, 80],
		'the resample source is an untouched copy of the original composite',
	);
	assert.deepEqual(
		[fixture.canvasManager.selection.x, fixture.canvasManager.selection.y,
			fixture.canvasManager.selection.w, fixture.canvasManager.selection.h],
		[0, 0, 135, 95],
	);

	fixture.windowRef.dispatch('pointerup', {});
	assert.deepEqual(fixture.history, ['begin', 'changed:true', 'changed:true', 'commit', 'persist']);
	fixture.bind();
});

test('shrinking a whole-canvas selection also shrinks the real document canvas', () => {
	const fixture = createResizeFixture({ selection: { x: 0, y: 0, w: 100, h: 80 } });
	fixture.handleListeners.get('pointerdown')({
		preventDefault() {},
		stopPropagation() {},
	});
	fixture.windowRef.dispatch('pointermove', { clientX: 50, clientY: 40 });

	assert.deepEqual([fixture.canvasManager.width, fixture.canvasManager.height], [50, 40]);
	assert.deepEqual(fixture.resamples.map(({ width, height }) => [width, height]), [[50, 40]]);
	assert.deepEqual(
		[fixture.canvasManager.selection.x, fixture.canvasManager.selection.y,
			fixture.canvasManager.selection.w, fixture.canvasManager.selection.h],
		[0, 0, 50, 40],
	);

	fixture.windowRef.dispatch('pointerup', {});
	assert.deepEqual(fixture.history, ['begin', 'changed:true', 'changed:true', 'commit', 'persist']);
	fixture.bind();
});

test('incremental RTL whole-canvas resizing keeps the image origin and dragged handle aligned', () => {
	const fixture = createResizeFixture({
		selection: { x: 0, y: 0, w: 100, h: 80 },
		rtl: true,
	});
	fixture.handleListeners.get('pointerdown')({
		preventDefault() {},
		stopPropagation() {},
	});

	fixture.windowRef.dispatch('pointermove', { clientX: 360, clientY: 50 });
	assert.deepEqual([fixture.canvasManager.width, fixture.canvasManager.height], [60, 50]);
	assert.equal(fixture.canvasManager.canvas.getBoundingClientRect().left, 300);

	fixture.windowRef.dispatch('pointermove', { clientX: 340, clientY: 40 });
	assert.deepEqual([fixture.canvasManager.width, fixture.canvasManager.height], [40, 40]);
	assert.equal(fixture.canvasManager.canvas.getBoundingClientRect().left, 300);
	assert.equal(fixture.canvasManager.canvas.getBoundingClientRect().right, 340);
	assert.equal(fixture.stage.style.left, '-60px');

	fixture.windowRef.dispatch('pointerup', {});
	assert.deepEqual(fixture.history.slice(-3), ['changed:true', 'commit', 'persist']);
	fixture.bind();
});

test('cancelling a whole-canvas resize restores its original bounds and aborts history', () => {
	const fixture = createResizeFixture({ selection: { x: 0, y: 0, w: 100, h: 80 } });
	fixture.handleListeners.get('pointerdown')({
		preventDefault() {},
		stopPropagation() {},
	});
	fixture.windowRef.dispatch('pointermove', { clientX: 140, clientY: 110 });
	fixture.windowRef.dispatch('pointercancel', {});

	assert.deepEqual([fixture.canvasManager.width, fixture.canvasManager.height], [100, 80]);
	assert.deepEqual(fixture.resamples.map(({ width, height }) => [width, height]), [[140, 110], [100, 80]]);
	assert.deepEqual(
		[fixture.canvasManager.selection.x, fixture.canvasManager.selection.y,
			fixture.canvasManager.selection.w, fixture.canvasManager.selection.h],
		[0, 0, 100, 80],
	);
	assert.equal(fixture.stage.style.left, '');
	assert.equal(fixture.stage.style.top, '');
	assert.ok(fixture.history.includes('abort'));
	assert.ok(fixture.history.includes('reset-clean-baseline'));
	fixture.bind();
});

test('resizing a partial floating selection changes only its floating layer', () => {
	const previousDocument = globalThis.document;
	globalThis.document = { createElement: () => createCanvas() };
	try {
		const floatingCanvas = createCanvas(20, 15);
		const fixture = createResizeFixture({
			selection: { x: 10, y: 15, w: 20, h: 15 },
			floatingCanvas,
		});
		fixture.handleListeners.get('pointerdown')({
			preventDefault() {},
			stopPropagation() {},
		});
		fixture.windowRef.dispatch('pointermove', { clientX: 42, clientY: 38 });

		assert.deepEqual([fixture.canvasManager.width, fixture.canvasManager.height], [100, 80]);
		assert.equal(fixture.resamples.length, 0);
		assert.deepEqual(
			[fixture.canvasManager.floatingCanvas.width, fixture.canvasManager.floatingCanvas.height],
			[32, 23],
		);
		fixture.windowRef.dispatch('pointerup', {});
		fixture.bind();
	} finally {
		if (previousDocument === undefined) delete globalThis.document;
		else globalThis.document = previousDocument;
	}
});
