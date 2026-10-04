import assert from 'node:assert/strict';
import test from 'node:test';

import { createBrushCursorOverlay } from '../js/ui/BrushCursorOverlay.js';

const makeTarget = () => {
	const listeners = new Map();
	return {
		listeners,
		addEventListener(name, listener) { listeners.set(name, listener); },
		removeEventListener(name, listener) {
			if (listeners.get(name) === listener) listeners.delete(name);
		},
		append(child) { this.child = child; },
	};
};

test('brush cursor follows image coordinates and reflects the active stroke size', () => {
	const root = makeTarget();
	const surface = makeTarget();
	let cursor;
	let tipShape = 'diamond';
	let rotation = { angle: 30, angleJitter: 0 };
	const documentRef = {
		createElement() {
			cursor = {
				style: {
					setProperty(name, value) { this[name] = value; },
				},
				dataset: {},
				setAttribute() {},
				remove() { this.removed = true; },
				hidden: false,
			};
			return cursor;
		},
	};
	const overlay = createBrushCursorOverlay({
		root,
		surface,
		documentRef,
		viewportManager: { clientToImage: (x, y) => ({ x: x / 2, y: y / 2 }) },
		getLineWidth: () => 10,
		getTipShape: () => tipShape,
		getRotation: () => rotation,
	});
	overlay.setTool('brush');
	surface.listeners.get('pointermove')({ clientX: 40, clientY: 30 });
	assert.equal(cursor.style.left, '20px');
	assert.equal(cursor.style.top, '15px');
	assert.equal(cursor.style.width, '10px');
	assert.equal(cursor.style['--brush-cursor-size'], '10px');
	assert.equal(cursor.hidden, false);
	assert.equal(cursor.dataset.tipShape, 'diamond');
	// The pointer previews BrushState.angle and wobbles while jitter is active.
	assert.equal(cursor.style['--brush-cursor-rotation'], '30deg');
	rotation = { angle: 30, angleJitter: 1 };
	overlay.refresh();
	assert.match(cursor.style['--brush-cursor-rotation'], /^-?\d+(\.\d+)?deg$/);
	rotation = { angle: 0, angleJitter: 0 };
	tipShape = 'square';
	overlay.refresh();
	assert.equal(cursor.dataset.tipShape, 'square');
	assert.equal(cursor.style['--brush-cursor-rotation'], '0deg');
	overlay.setTool('select');
	assert.equal(cursor.hidden, true);
	overlay.destroy();
	assert.equal(cursor.removed, true);
	assert.equal(surface.listeners.size, 0);
});
