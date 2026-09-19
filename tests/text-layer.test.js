import assert from 'node:assert/strict';
import test from 'node:test';

import { measureTextObject, renderTextObject } from '../js/document/TextLayerRenderer.js';

const fakeContext = () => {
	const calls = [];
	return {
		calls,
		font: '',
		measureText: (text) => ({ width: String(text).length * 10 }),
		save: () => calls.push('save'),
		restore: () => calls.push('restore'),
		fillText: (text, x, y) => calls.push(['fillText', text, x, y]),
		strokeText: (text, x, y) => calls.push(['strokeText', text, x, y]),
		fillRect: (x, y, width, height) => calls.push(['fillRect', x, y, width, height]),
	};
};

test('text renderer measures and draws committed objects without a paint selection', () => {
	const context = fakeContext();
	const object = {
		text: 'Hello\nPaint',
		x: 12,
		y: 24,
		fontSize: 20,
		fontFamily: 'Segoe UI',
		color: { r: 10, g: 20, b: 30, a: 0.5 },
		styles: ['bold', 'underline'],
	};
	const measured = measureTextObject({ context, object });

	assert.equal(measured.width, 50);
	assert.equal(measured.height, 48);
	assert.equal(renderTextObject({ context, object }), true);
	assert.deepEqual(context.calls.filter((call) => Array.isArray(call) && call[0] === 'fillText'), [
		['fillText', 'Hello', 13, 24],
		['fillText', 'Paint', 13, 48],
	]);
});
