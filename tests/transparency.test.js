import assert from 'node:assert/strict';
import test from 'node:test';

import { CanvasManager } from '../js/canvas/CanvasManager.js';

class FakeContext {
	constructor() {
		this.fillRectCalls = 0;
		this.clearRectCalls = 0;
		this.fillStyle = '';
	}

	save() {}
	restore() {}
	fillRect() { this.fillRectCalls += 1; }
	clearRect() { this.clearRectCalls += 1; }
	drawImage() {}
	getImageData(_x, _y, width, height) {
		return { data: new Uint8ClampedArray(width * height * 4) };
	}
}

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
