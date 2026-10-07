import assert from 'node:assert/strict';
import test from 'node:test';
import { createStatusBar } from '../js/ui/StatusBar.js';

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
	const pointerEl = { textContent: '' };
	const selectionEl = {
		textContent: '',
		attributes: new Set(),
		setAttribute(name) { this.attributes.add(name); },
		removeAttribute(name) { this.attributes.delete(name); },
	};
	const canvasSizeEl = { textContent: '800 × 600px' };
	const flashEl = { textContent: '' };
	const statusBar = createStatusBar({
		pointerEl,
		selectionEl,
		canvasSizeEl,
		flashEl,
		eventTarget: localeTarget,
		schedule: timers.schedule,
		cancel: timers.cancel,
	});
	return { localeTarget, timers, pointerEl, selectionEl, canvasSizeEl, flashEl, statusBar };
};

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
