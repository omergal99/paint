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
	const documentRef = {
		createElement() {
			cursor = {
				style: {
					setProperty(name, value) { this[name] = value; },
				},
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
	});
	overlay.setTool('brush');
	surface.listeners.get('pointermove')({ clientX: 40, clientY: 30 });
	assert.equal(cursor.style.left, '20px');
	assert.equal(cursor.style.top, '15px');
	assert.equal(cursor.style.width, '10px');
	assert.equal(cursor.style['--brush-cursor-size'], '10px');
	assert.equal(cursor.hidden, false);
	overlay.setTool('select');
	assert.equal(cursor.hidden, true);
	overlay.destroy();
	assert.equal(cursor.removed, true);
	assert.equal(surface.listeners.size, 0);
});
