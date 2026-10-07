import assert from 'node:assert/strict';
import test from 'node:test';
import { ViewportManager } from '../js/canvas/ViewportManager.js';

const makeEventTarget = () => {
	const listeners = new Map();
	return {
		addEventListener(type, listener) {
			const handlers = listeners.get(type) || new Set();
			handlers.add(listener);
			listeners.set(type, handlers);
		},
		removeEventListener(type, listener) {
			const handlers = listeners.get(type);
			handlers?.delete(listener);
			if (handlers?.size === 0) listeners.delete(type);
		},
		dispatch(type, event = {}) {
			[...(listeners.get(type) || [])].forEach((listener) => listener(event));
		},
		listenerCount() {
			return [...listeners.values()].reduce((total, handlers) => total + handlers.size, 0);
		},
	};
};

const withViewport = (run) => {
	const savedGlobals = {
		document: globalThis.document,
		localStorage: globalThis.localStorage,
		window: globalThis.window,
		ResizeObserver: globalThis.ResizeObserver,
	};
	const listeners = makeEventTarget();
	const storage = new Map([['paint:zoom', '250']]);
	globalThis.document = { body: { dataset: {} } };
	globalThis.localStorage = {
		getItem: (key) => storage.get(key) ?? null,
		setItem: (key, value) => storage.set(key, String(value)),
	};
	globalThis.window = listeners;
	let observerDisconnected = false;
	globalThis.ResizeObserver = class {
		observe() {}
		disconnect() { observerDisconnected = true; }
	};

	const createButton = () => {
		const target = makeEventTarget();
		target.click = () => target.dispatch('click');
		return target;
	};
	const viewport = {
		...makeEventTarget(),
		clientWidth: 400,
		clientHeight: 300,
		scrollWidth: 400,
		scrollHeight: 300,
		scrollLeft: 0,
	};
	const stage = { parentElement: viewport, style: {} };
	const styleProperties = new Map();
	const scaleEl = {
		style: {
			setProperty(name, value) { styleProperties.set(name, value); },
		},
	};
	const canvas = {
		getBoundingClientRect: () => ({ left: 20, top: 30 }),
	};
	const canvasManager = { canvas, width: 800, height: 600 };
	const zoomInBtn = createButton();
	const zoomOutBtn = createButton();
	const zoomResetBtn = createButton();
	const zoomInput = { value: '' , ...makeEventTarget(), blur() {} };
	const zoomSlider = { value: '', ...makeEventTarget() };
	const manager = new ViewportManager({
		stage,
		scaleEl,
		canvasManager,
		zoomInBtn,
		zoomOutBtn,
		zoomResetBtn,
		zoomInput,
		zoomSlider,
	});

	try {
		run({
			manager,
			listeners,
			storage,
			stage,
			viewport,
			canvas,
			scaleEl,
			styleProperties,
			zoomInBtn,
			zoomOutBtn,
			zoomResetBtn,
			zoomInput,
			zoomSlider,
			get observerDisconnected() { return observerDisconnected; },
		});
	} finally {
		manager.destroy();
		for (const [name, value] of Object.entries(savedGlobals)) {
			if (value === undefined) delete globalThis[name];
			else globalThis[name] = value;
		}
	}
};

test('zoom reset returns to actual-size 100% and updates every zoom surface', () => {
	withViewport((fixture) => {
		const { manager, zoomResetBtn, zoomInput, zoomSlider, stage, scaleEl, styleProperties, storage } = fixture;
		assert.equal(manager.zoom, 250);
		zoomResetBtn.click();
		assert.equal(manager.zoom, 100);
		assert.equal(zoomInput.value, 100);
		assert.equal(zoomSlider.value, 100);
		assert.equal(scaleEl.style.transform, 'scale(1)');
		assert.equal(styleProperties.get('--zoom-inverse'), '1');
		assert.equal(stage.style.width, '800px');
		assert.equal(stage.style.height, '600px');
		assert.equal(storage.get('paint:zoom'), '100');
	});
});

test('zoom clamps valid values, ignores invalid values, and preserves image coordinate mapping', () => {
	withViewport((fixture) => {
		const { manager, canvas, zoomInput } = fixture;
		manager.setZoom(900);
		assert.equal(manager.zoom, 800);
		manager.setZoom(Number.NaN);
		assert.equal(manager.zoom, 800);
		manager.setZoom(50);
		assert.deepEqual(manager.clientToImage(70, 80), { x: 100, y: 100 });
		zoomInput.value = '';
		zoomInput.dispatch('change');
		assert.equal(zoomInput.value, 50);
		assert.equal(canvas.getBoundingClientRect().left, 20);
	});
});

test('viewport teardown removes zoom controls and browser lifecycle listeners', () => {
	withViewport((fixture) => {
		const { manager, listeners, zoomResetBtn, viewport } = fixture;
		assert.ok(listeners.listenerCount() > 0);
		assert.ok(viewport.listenerCount() > 0);
		manager.destroy();
		assert.equal(listeners.listenerCount(), 0);
		assert.equal(viewport.listenerCount(), 0);
		zoomResetBtn.click();
		assert.equal(manager.zoom, 250, 'destroyed control listeners no longer alter zoom');
		assert.equal(fixture.observerDisconnected, true);
	});
});
