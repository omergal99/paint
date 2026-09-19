import assert from 'node:assert/strict';
import test from 'node:test';

import { EventBus } from '../js/core/EventBus.js';
import { createPaintDocument, isPaintDocument } from '../js/core/DocumentContract.js';
import { HistoryManager } from '../js/history/HistoryManager.js';
import { createSettingsStore } from '../js/settings/SettingsStore.js';

function memoryStorage() {
	const values = new Map();
	return {
		getItem: (key) => values.get(key) ?? null,
		setItem: (key, value) => values.set(key, String(value)),
		removeItem: (key) => values.delete(key),
	};
}

test('EventBus supports unsubscribe, once, and destroy', () => {
	const bus = new EventBus();
	const received = [];
	const off = bus.on('paint:test', (value) => received.push(`on:${value}`));
	bus.once('paint:test', (value) => received.push(`once:${value}`));
	bus.emit('paint:test', 1);
	off();
	bus.emit('paint:test', 2);
	bus.destroy();
	bus.emit('paint:test', 3);
	assert.deepEqual(received, ['on:1', 'once:1']);
});

test('SettingsStore validates, persists, and notifies one contract', () => {
	const storage = memoryStorage();
	const changes = [];
	const store = createSettingsStore({
		storage,
		key: 'test:settings',
		defaults: { zoom: 100, background: 'solid' },
		validators: { zoom: (value) => Number.isFinite(value) && value > 0, background: (value) => ['solid', 'transparent'].includes(value) },
	});
	const unsubscribe = store.subscribe((value) => changes.push(value));
	store.set({ zoom: 150, background: 'invalid' });
	assert.deepEqual(store.get(), { zoom: 150, background: 'solid' });
	assert.equal(JSON.parse(storage.getItem('test:settings')).schemaVersion, 1);
	unsubscribe();
	store.reset();
	assert.equal(changes.length, 1);
});

test('PaintDocument establishes durable future ownership boundaries', () => {
	const document = createPaintDocument({ id: 'doc-test', width: 20, height: 30 });
	assert.equal(document.pixels.width, 20);
	assert.deepEqual(document.textObjects, []);
	assert.equal(isPaintDocument(document), true);
	assert.equal(isPaintDocument({}), false);
});

test('History session entries are current/newest first and delete by stable ID', () => {
	let serial = 0;
	const canvasManager = {
		width: 20,
		height: 10,
		canvas: { toDataURL: () => `data:image/png;base64,${++serial}` },
		_pixelsSignature: () => null,
	};
	const history = new HistoryManager(canvasManager);
	history.snapshot({ force: true });
	history.snapshot({ force: true });
	const entries = history.getSessionEntries();
	assert.deepEqual(entries.map((entry) => entry.kind), ['current', 'session', 'session']);
	const newestSnapshot = entries[1];
	assert.equal(history.removeSessionEntry(newestSnapshot.id), true);
	assert.equal(history.getSessionEntries().some((entry) => entry.id === newestSnapshot.id), false);
	assert.equal(history.removeSessionEntry('current'), true);
	assert.equal(history.getSessionEntries()[0].kind, 'session');
});
