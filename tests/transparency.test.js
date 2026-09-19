import assert from 'node:assert/strict';
import test from 'node:test';

import { CanvasManager, commitLayerWithSourceOver } from '../js/canvas/CanvasManager.js';

class FakeContext {
	constructor() {
		this.fillRectCalls = 0;
		this.clearRectCalls = 0;
		this.fillStyle = '';
		this.globalAlpha = 0.2;
		this.globalCompositeOperation = 'multiply';
		this.drawImageCalls = [];
		this.savedState = null;
	}

	save() {
		this.savedState = { alpha: this.globalAlpha, composite: this.globalCompositeOperation };
	}
	restore() {
		if (this.savedState) {
			this.globalAlpha = this.savedState.alpha;
			this.globalCompositeOperation = this.savedState.composite;
		}
	}
	fillRect() { this.fillRectCalls += 1; }
	clearRect() { this.clearRectCalls += 1; }
	drawImage(...args) {
		this.drawImageCalls.push({ args, alpha: this.globalAlpha, composite: this.globalCompositeOperation });
	}
	getImageData(_x, _y, width, height) {
		return { data: new Uint8ClampedArray(width * height * 4) };
	}
}

test('floating layers commit once with source-over alpha', () => {
	const context = new FakeContext();
	const layer = { width: 4, height: 4 };
	const region = { x: 3, y: 5, w: 4, h: 4 };

	assert.equal(commitLayerWithSourceOver(context, layer, region), true);
	assert.deepEqual(context.drawImageCalls[0], {
		args: [layer, 3, 5],
		alpha: 1,
		composite: 'source-over',
	});
	assert.equal(context.globalAlpha, 0.2, 'the caller context state is restored');
	assert.equal(context.globalCompositeOperation, 'multiply', 'the caller composite mode is restored');
});

class FakeCanvas {
	constructor() {
		this.width = 0;
		this.height = 0;
		this.ctx = new FakeContext();
	}

	getContext() { return this.ctx; }
}

test('transparent background clears pixels instead of painting white', () => {
	const previousDocument = globalThis.document;
	globalThis.document = { createElement: () => new FakeCanvas() };
	try {
		const canvas = new FakeCanvas();
		const overlay = new FakeCanvas();
		const manager = new CanvasManager({ canvas, overlay, width: 20, height: 10 });
		const solidFillCalls = canvas.ctx.fillRectCalls;
		manager.setBackgroundMode('transparent');
		manager.fillRegion({ x: 2, y: 3, w: 4, h: 5 }, manager.backgroundColor);
		manager.clear();
		assert.equal(canvas.ctx.fillRectCalls, solidFillCalls);
		assert.equal(canvas.ctx.clearRectCalls, 2);
	} finally {
		if (previousDocument) globalThis.document = previousDocument;
		else delete globalThis.document;
	}
});
