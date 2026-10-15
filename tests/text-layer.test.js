import assert from 'node:assert/strict';
import { readFileSync as readFileSyncNode } from 'node:fs';
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
	assert.equal(context.lineJoin, 'round');
	assert.equal(context.lineCap, 'round');
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
	assert.equal(context.lineJoin, 'round');
	assert.equal(context.lineCap, 'round');
});

// --- W4-11: the committed-text focus layer is opt-in ---------------------
// Minimal DOM/localStorage/window stubs so the overlay can be constructed and
// rendered outside a browser. `store` acts as localStorage so the persisted
// visibility flag can be flipped between interactions.
const makeTextOverlayDom = () => {
	const store = new Map();
	const listeners = new Map();
	const makeClassList = () => {
		const set = new Set();
		return {
			add: (...names) => names.forEach((name) => set.add(name)),
			remove: (...names) => names.forEach((name) => set.delete(name)),
			toggle: (name, force) => {
				if (force === undefined) {
					if (set.has(name)) set.delete(name); else set.add(name);
					return;
				}
				if (force) set.add(name); else set.delete(name);
			},
			contains: (name) => set.has(name),
		};
	};
	const makeElement = () => ({
		children: [],
		style: {},
		dataset: {},
		attrs: {},
		classList: makeClassList(),
		innerHTML: '',
		textContent: '',
		title: '',
		type: '',
		isConnected: true,
		className: '',
		setAttribute(name, value) { this.attrs[name] = String(value); },
		getAttribute(name) { return name in this.attrs ? this.attrs[name] : null; },
		appendChild(node) { this.children.push(node); return node; },
		replaceChildren(...nodes) { this.children = [...nodes]; },
		addEventListener() {},
		removeEventListener() {},
		dispatchEvent() {},
		focus() {},
		remove() {},
	});
	globalThis.localStorage = {
		getItem: (key) => (store.has(key) ? store.get(key) : null),
		setItem: (key, value) => store.set(key, String(value)),
		removeItem: (key) => store.delete(key),
	};
	globalThis.document = { createElement: makeElement, createElementNS: makeElement };
	globalThis.CustomEvent = class CustomEvent {
		constructor(type, init) { this.type = type; this.detail = init?.detail; }
	};
	globalThis.window = {
		addEventListener(type, handler) {
			if (!listeners.has(type)) listeners.set(type, new Set());
			listeners.get(type).add(handler);
		},
		removeEventListener(type, handler) { listeners.get(type)?.delete(handler); },
		dispatchEvent(event) {
			listeners.get(event.type)?.forEach((handler) => handler(event));
			return true;
		},
	};
	return { store, listeners };
};

test('W4-11: the text focus layer hides by default and follows the persisted toggle', async () => {
	const { store, listeners } = makeTextOverlayDom();
	const { createTextSelectionOverlay } = await import('../js/ui/TextSelectionOverlay.js');
	const objects = [{ id: 't1', text: 'Hi', x: 10, y: 10, width: 40, height: 20 }];
	const overlayRoot = { appendChild() {} };
	const overlay = createTextSelectionOverlay({ root: overlayRoot, store: { getAll: () => objects, subscribe: () => () => {} } });
	const layer = overlay.element;

	// Hidden by default: no flag stored, so the committed text must not intercept.
	assert.equal(layer.classList.contains('is-hidden'), true, 'hidden until the user opts in');
	assert.equal(layer.getAttribute('aria-hidden'), 'true');
	assert.equal(layer.children.length, 1, 'the target still exists for select/move while hidden');

	// Turning the checkbox on unhides via the Toolbar's change event.
	localStorage.setItem('paint:text-layer-visible', 'true');
	window.dispatchEvent(new CustomEvent('paint:text-layer-visibility-change', { detail: { visible: true } }));
	assert.equal(layer.classList.contains('is-hidden'), false, 'shown once opted in');
	assert.equal(layer.getAttribute('aria-hidden'), 'false');

	// A re-render (e.g. a new text object) must not resurrect a hidden layer.
	localStorage.setItem('paint:text-layer-visible', 'false');
	window.dispatchEvent(new CustomEvent('paint:text-layer-visibility-change', { detail: { visible: false } }));
	assert.equal(layer.classList.contains('is-hidden'), true, 'back to hidden');

	overlay.destroy();
	assert.equal(listeners.get('paint:text-layer-visibility-change')?.size ?? 0, 0,
		'destroy removes the visibility listener');
});

test('W4-11 wiring: the checkbox, storage key, overlay gate and CSS agree', () => {
	const readFileSync = (path) => readFileSyncNode(new URL(path, import.meta.url), 'utf8');
	const constants = readFileSync('../js/core/constants.js');
	const html = readFileSync('../index.html');
	const toolbar = readFileSync('../js/ui/Toolbar.js');
	const styles = readFileSync('../css/styles.css');

	assert.match(constants, /textLayerVisible:\s*'paint:text-layer-visible'/);
	assert.match(html, /id="text-layer-visible"/, 'the Text menu exposes the toggle');
	// The checkbox handler persists the flag and announces it.
	assert.match(toolbar, /localStorage\.setItem\(TEXT_LAYER_VISIBLE_KEY/);
	assert.match(toolbar, /'paint:text-layer-visibility-change'/);
	// A hidden layer must not swallow pointer events over the canvas.
	assert.match(styles, /\.text-object-focus-layer\.is-hidden\s*\{[^}]*pointer-events:\s*none/);
});
