import assert from 'node:assert/strict';
import test from 'node:test';

import { measureTextObject, renderTextObject, getTextStrokeWidth } from '../js/document/TextLayerRenderer.js';
import { DEFAULT_TEXT_FONT_FAMILY, TEXT_FONT_FAMILIES } from '../js/core/constants.js';

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

test('committed black-outline text rasterizes its configured width and color', () => {
	const context = fakeContext();
	const object = {
		text: 'Stroke',
		x: 0,
		y: 0,
		fontSize: 24,
		fontFamily: 'Segoe UI',
		color: { r: 30, g: 60, b: 90, a: 1 },
		styles: ['black-outline'],
		strokeWidth: 7,
		strokeColor: '#e02040',
	};

	assert.equal(renderTextObject({ context, object }), true);
	assert.equal(context.strokeStyle, '#e02040');
	assert.equal(context.lineWidth, 7);
	assert.equal(context.lineWidth, getTextStrokeWidth({
		fontSize: object.fontSize,
		strokeWidth: object.strokeWidth,
		styles: object.styles,
	}));
	assert.deepEqual(context.calls.find((call) => Array.isArray(call) && call[0] === 'strokeText'),
		['strokeText', 'Stroke', 1, 0]);
});

test('text font picker options include at least twenty choices and preserve the system default', () => {
	assert.ok(TEXT_FONT_FAMILIES.length >= 20);
	assert.ok(TEXT_FONT_FAMILIES.some(({ value, label }) => (
		value === DEFAULT_TEXT_FONT_FAMILY && label === 'System UI (Default Sans-Serif)'
	)));
});

test('outline preview and raster strokes share the same width calculation', () => {
	assert.equal(getTextStrokeWidth({ fontSize: 20, styles: ['outline'] }), 1.2);
	assert.equal(getTextStrokeWidth({ fontSize: 8, styles: ['outline'] }), 1);
	assert.equal(getTextStrokeWidth({ fontSize: 24, strokeWidth: 5, styles: ['black-outline'] }), 5);
	const context = fakeContext();
	const object = {
		text: 'Five',
		x: 0,
		y: 0,
		fontSize: 24,
		fontFamily: 'Arial',
		color: { r: 0, g: 0, b: 0, a: 1 },
		styles: ['black-outline'],
		strokeWidth: 5,
	};
	renderTextObject({ context, object });
	assert.equal(context.lineWidth, 5, 'the raster stroke uses the exact CSS preview width in canvas pixels');
});
