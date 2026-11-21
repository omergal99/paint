import assert from 'node:assert/strict';
import test from 'node:test';
import { createStatusBar } from '../../../js/ui/StatusBar.js';

const eventTarget = () => {
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
		dispatch(type) {
			[...(listeners.get(type) || [])].forEach((listener) => listener());
		},
		listenerCount(type) {
			return listeners.get(type)?.size || 0;
		},
	};
};

const timerQueue = () => {
	let nextId = 0;
	const pending = new Map();
	return {
		pending,
		schedule(callback, delay) {
			const id = ++nextId;
			pending.set(id, { callback, delay });
			return id;
		},
		cancel(id) {
			pending.delete(id);
		},
		run(id) {
			const timer = pending.get(id);
			if (!timer) return;
			pending.delete(id);
			timer.callback();
		},
	};
};

const createFixture = () => {
	const localeTarget = eventTarget();
	const timers = timerQueue();
	const pointerEl = {
		textContent: '',
		attributes: new Set(),
		setAttribute(name) { this.attributes.add(name); },
		removeAttribute(name) { this.attributes.delete(name); },
	};
	const zoomSliderEl = { hidden: false };
	const selectionEl = {
		textContent: '',
		attributes: new Set(),
		setAttribute(name) { this.attributes.add(name); },
		removeAttribute(name) { this.attributes.delete(name); },
	};
	const canvasSizeEl = { textContent: '800 × 600px', hidden: false };
	const flashEl = {
		textContent: '',
		attributes: new Set(),
		setAttribute(name) { this.attributes.add(name); },
		removeAttribute(name) { this.attributes.delete(name); },
	};
	const statusBar = createStatusBar({
		pointerEl,
		selectionEl,
		canvasSizeEl,
		zoomSliderEl,
		flashEl,
		eventTarget: localeTarget,
		schedule: timers.schedule,
		cancel: timers.cancel,
	});
	return { localeTarget, timers, pointerEl, selectionEl, canvasSizeEl, zoomSliderEl, flashEl, statusBar };
};

test('flash messages stay owned by the timer, not the locale controller', () => {
	const fixture = createFixture();
	// Without the ignore tag, LocaleController's observer re-applies a stamped
	// message key the moment the timer clears the text — the flash never expires.
	assert.equal(fixture.flashEl.attributes.has('data-i18n-ignore'), true);
	assert.equal(fixture.flashEl.attributes.has('data-i18n-runtime'), false);
	assert.equal(fixture.flashEl.attributes.has('data-i18n-runtime-source'), false);
	assert.equal(fixture.pointerEl.attributes.has('data-i18n-ignore'), true);
	assert.equal(fixture.pointerEl.attributes.has('data-i18n-runtime'), false);
	fixture.statusBar.flash('Loaded from history');
	const timer = [...fixture.timers.pending.keys()][0];
	fixture.timers.run(timer);
	assert.equal(fixture.flashEl.textContent, '');
	assert.equal(fixture.flashEl.attributes.has('data-i18n-runtime'), false);
	fixture.statusBar.destroy();
});

test('status bar keeps pointer and selection output refreshed across locale changes', () => {
	const fixture = createFixture();
	fixture.statusBar.setPointer({ x: 12.3, y: 45.8 });
	fixture.statusBar.setSelection({ x: 2, y: 3, w: 20, h: 10 });
	assert.equal(fixture.pointerEl.textContent, 'Pointer: 12, 46px');
	assert.equal(fixture.selectionEl.textContent, 'Selection: 20 × 10px');
	fixture.statusBar.setCanvasSize(640, 480);
	assert.equal(fixture.canvasSizeEl.textContent, '640 × 480px');

	fixture.localeTarget.dispatch('paint:locale-change');
	assert.equal(fixture.pointerEl.textContent, 'Pointer: 12, 46px');
	assert.equal(fixture.selectionEl.textContent, 'Selection: 20 × 10px');
	fixture.statusBar.destroy();
});

test('status flashes replace, expire, clear, and dispose their owned timers', () => {
	const fixture = createFixture();
	fixture.statusBar.flash('First message', 1500);
	const firstTimer = [...fixture.timers.pending.keys()][0];
	assert.equal(fixture.flashEl.textContent, 'First message');

	fixture.statusBar.flash('Second message', 900);
	assert.equal(fixture.timers.pending.has(firstTimer), false);
	const secondTimer = [...fixture.timers.pending.keys()][0];
	assert.equal(fixture.timers.pending.get(secondTimer).delay, 900);
	assert.equal(fixture.flashEl.textContent, 'Second message');

	fixture.timers.run(secondTimer);
	assert.equal(fixture.flashEl.textContent, '');
	assert.equal(fixture.timers.pending.size, 0);

	fixture.statusBar.flash('Clear me');
	fixture.statusBar.clearFlash();
	assert.equal(fixture.flashEl.textContent, '');
	assert.equal(fixture.timers.pending.size, 0);

	fixture.statusBar.flash('Dispose me');
	fixture.statusBar.destroy();
	assert.equal(fixture.localeTarget.listenerCount('paint:locale-change'), 0);
	assert.equal(fixture.flashEl.textContent, '');
	assert.equal(fixture.timers.pending.size, 0);
	fixture.statusBar.flash('Must not come back');
	assert.equal(fixture.flashEl.textContent, '');
});

test('default status duration is five seconds and each flash records its timestamp', () => {
	const fixture = createFixture();
	let recorded = null;
	const statusBar = createStatusBar({
		pointerEl: fixture.pointerEl,
		selectionEl: fixture.selectionEl,
		canvasSizeEl: fixture.canvasSizeEl,
		zoomSliderEl: fixture.zoomSliderEl,
		flashEl: fixture.flashEl,
		schedule: fixture.timers.schedule,
		cancel: fixture.timers.cancel,
		onStatus: (entry) => { recorded = entry; },
	});

	statusBar.flash('Saved');
	const timer = [...fixture.timers.pending.keys()][0];
	assert.equal(fixture.timers.pending.get(timer).delay, 5000);
	assert.equal(recorded.message, 'Saved');
	assert.equal(Number.isFinite(Date.parse(recorded.timestamp)), true);
	statusBar.destroy();
	fixture.statusBar.destroy();
});

test('status footer config applies persisted duration and visible fields', () => {
	const fixture = createFixture();
	fixture.statusBar.setConfig({
		durationMs: 5000,
		pointer: false,
		selection: false,
		zoomSlider: true,
	});

	fixture.statusBar.flash('Long status');
	const timer = [...fixture.timers.pending.keys()][0];
	assert.equal(fixture.timers.pending.get(timer).delay, 5000);
	assert.equal(fixture.pointerEl.hidden, true);
	assert.equal(fixture.selectionEl.hidden, true);
	assert.equal(fixture.canvasSizeEl.hidden, false);
	assert.equal(fixture.zoomSliderEl.hidden, false);

	fixture.statusBar.setConfig({ zoomSlider: false });
	assert.equal(fixture.canvasSizeEl.hidden, false);
	assert.equal(fixture.zoomSliderEl.hidden, true);

	fixture.statusBar.setConfig({ durationMs: 0 });
	assert.equal(fixture.pointerEl.hidden, true);
	fixture.statusBar.flash('Keep until the next status');
	assert.equal(fixture.flashEl.textContent, 'Keep until the next status');
	assert.equal(fixture.timers.pending.size, 0);
	fixture.statusBar.destroy();
});
