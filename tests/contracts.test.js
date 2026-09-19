import assert from 'node:assert/strict';
import test from 'node:test';

import { createEventBus } from '../js/core/EventBus.js';
import { createPaintDocument, isPaintDocument } from '../js/core/DocumentContract.js';
import { HistoryManager } from '../js/history/HistoryManager.js';
import { createSettingsStore } from '../js/settings/SettingsStore.js';
import { createTextDocumentStore } from '../js/document/TextDocumentStore.js';
import { createTextHistoryStore } from '../js/document/TextHistoryStore.js';
import { colorStateToCss, normalizeRgba } from '../js/utils/colorContract.js';
import { estimateDataUrlBytes, makeMemoryReport } from '../js/storage/MemoryBudget.js';

const memoryStorage = () => {
	const values = new Map();
	return {
		getItem: (key) => values.get(key) ?? null,
		setItem: (key, value) => values.set(key, String(value)),
		removeItem: (key) => values.delete(key),
	};
}

test('EventBus supports unsubscribe, once, and destroy', () => {
	const bus = createEventBus();
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

test('color contract normalizes alpha without losing legacy hex input', () => {
	assert.deepEqual(normalizeRgba('#336699'), { r: 51, g: 102, b: 153, a: 1 });
	assert.equal(colorStateToCss({ hex: '#336699', alpha: 0.5 }), 'rgba(51, 102, 153, 0.5)');
});

test('text document store keeps revisions and serializable editable objects', () => {
	const store = createTextDocumentStore();
	const added = store.add({ text: 'Hello', x: 4, y: 8, styles: ['bold', 'bold'] });
	assert.equal(added.text, 'Hello');
	assert.deepEqual(store.getAll()[0].styles, ['bold']);
	const updated = store.update(added.id, { text: 'Hello world' });
	assert.equal(updated.revision, 1);
	assert.match(store.serialize(), /Hello world/);
	assert.equal(store.remove(added.id), true);
});

test('text history is newest-first, de-duplicated, persisted, and bounded', () => {
	const storage = memoryStorage();
	const store = createTextHistoryStore({ storage, maxEntries: 3 });
	store.record({ text: 'first', fontSize: 20 });
	store.record({ text: 'second', fontSize: 20 });
	store.record({ text: 'third', fontSize: 20 });
	store.record({ text: 'fourth', fontSize: 20 });
	assert.deepEqual(store.getAll().map((entry) => entry.text), ['fourth', 'third', 'second']);
	store.record({ text: 'third', fontSize: 20 });
	assert.deepEqual(store.getAll().map((entry) => entry.text), ['third', 'fourth', 'second']);
	assert.equal(JSON.parse(storage.getItem('paint:text-history')).length, 3);
	const restored = createTextHistoryStore({ storage, maxEntries: 3 });
	assert.equal(restored.getAll()[0].text, 'third');
	assert.equal(restored.clear(), true);
	assert.equal(storage.getItem('paint:text-history'), null);
});

test('memory report separates known history bytes from browser quota', () => {
	const dataUrl = `data:image/png;base64,${'A'.repeat(400)}`;
	assert.ok(estimateDataUrlBytes(dataUrl) > 0);
	const report = makeMemoryReport({ historyEntries: [{ dataUrl, width: 10, height: 10 }], objectUrlCount: 2 });
	assert.equal(report.storageQuotaIsSeparate, true);
	assert.equal(report.objectUrlCount, 2);
});
