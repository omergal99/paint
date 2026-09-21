import assert from 'node:assert/strict';
import test from 'node:test';

import {
	MAX_NOTEPAD_TABS,
	NOTEPAD_ERROR_CODES,
	NOTEPAD_PERSISTENCE_STATES,
	NOTEPAD_SCHEMA_VERSION,
	createNotepadStore,
	normalizeNotepadRecord,
} from '../js/notepad/NotepadStore.js';

const memoryStorage = ({ raw = null, writeError = null } = {}) => {
	const values = new Map(raw === null ? [] : [['paint:notepad', raw]]);
	let writes = 0;
	return {
		getItem: (key) => values.get(key) ?? null,
		setItem: (key, value) => {
			writes += 1;
			if (writeError) throw writeError;
			values.set(key, String(value));
		},
		removeItem: (key) => values.delete(key),
		get writes() { return writes; },
		peek: (key = 'paint:notepad') => values.get(key) ?? null,
	};
};

const timers = () => {
	let sequence = 0;
	const pending = new Map();
	return {
		set: (callback) => {
			sequence += 1;
			pending.set(sequence, callback);
			return sequence;
		},
		clear: (id) => pending.delete(id),
		runAll: () => {
			[...pending.entries()].forEach(([id, callback]) => {
				pending.delete(id);
				callback();
			});
		},
		get size() { return pending.size; },
	};
};

test('notepad normalizer salvages valid plain-text tabs from a damaged record', () => {
	const normalized = normalizeNotepadRecord({
		schemaVersion: 99,
		activeTabId: 'good',
		tabs: [
			{ id: 'good', title: 'Private label', text: 'plain text', createdAt: 1, updatedAt: 2 },
			null,
			{ id: 'good', title: 'Duplicate id', text: 'still preserved', createdAt: 1, updatedAt: 2 },
		],
		updatedAt: 2,
	}, { now: 10, idFactory: () => 'recovered-tab' });
	assert.equal(normalized.ok, true);
	assert.equal(normalized.recovered, true);
	assert.equal(normalized.record.tabs.length, 2);
	assert.equal(normalized.record.tabs[0].id, 'good');
	assert.equal(normalized.record.tabs[1].text, 'still preserved');
	assert.notEqual(normalized.record.tabs[1].id, 'good');
	assert.equal(normalized.record.activeTabId, 'good');
});

test('notepad CRUD is in-memory first and persistence is debounced then flushable', () => {
	const storage = memoryStorage();
	const clock = { value: 100 };
	const clockTimers = timers();
	const store = createNotepadStore({
		storage,
		now: () => clock.value,
		idFactory: (() => { let index = 0; return () => `tab-${++index}`; })(),
		setTimeoutFn: clockTimers.set,
		clearTimeoutFn: clockTimers.clear,
	});
	const initial = store.getState();
	assert.equal(initial.tabs.length, 1);
	assert.equal(initial.tabs[0].title, '', 'state stores no English fallback title');
	const firstId = initial.activeTabId;

	clock.value += 1;
	assert.equal(store.renameTab(firstId, 'Ideas').ok, true);
	assert.equal(store.setNoteText(firstId, 'Remember this locally.').ok, true);
	assert.equal(storage.writes, 0, 'typing does not synchronously write localStorage');
	assert.equal(store.getPersistenceStatus().state, NOTEPAD_PERSISTENCE_STATES.pending);
	assert.equal(clockTimers.size, 1, 'one debounce timer serves a burst of edits');
	assert.equal(store.flush().ok, true);
	assert.equal(storage.writes, 1);
	const persisted = JSON.parse(storage.peek());
	assert.equal(persisted.schemaVersion, NOTEPAD_SCHEMA_VERSION);
	assert.equal(persisted.tabs[0].text, 'Remember this locally.');

	clock.value += 1;
	const second = store.createTab({ title: '', text: 'Second note' });
	assert.equal(second.ok, true);
	assert.equal(store.getState().activeTabId, second.tab.id);
	assert.equal(store.setActiveTab(firstId).ok, true);
	assert.equal(store.deleteTab(firstId).ok, true);
	assert.equal(store.getState().activeTabId, second.tab.id);
});

test('notepad enforces tab and note bounds without silently dropping typed content', () => {
	const clockTimers = timers();
	const store = createNotepadStore({
		storage: memoryStorage(),
		debounceMs: 100_000,
		setTimeoutFn: clockTimers.set,
		clearTimeoutFn: clockTimers.clear,
	});
	const first = store.getState().activeTabId;
	assert.equal(store.setNoteText(first, 'x'.repeat(20_001)).error.code, NOTEPAD_ERROR_CODES.noteTooLong);
	assert.equal(store.getState().tabs[0].text, '');
	for (let index = 1; index < MAX_NOTEPAD_TABS; index += 1) {
		assert.equal(store.createTab({ id: `tab-${index}` }).ok, true);
	}
	assert.equal(store.getState().tabs.length, MAX_NOTEPAD_TABS);
	assert.equal(store.createTab({ id: 'one-too-many' }).error.code, NOTEPAD_ERROR_CODES.tabLimit);
});

test('notepad reports quota and unavailable persistence while retaining in-memory work', () => {
	const quotaError = Object.assign(new Error('storage quota exceeded'), { name: 'QuotaExceededError' });
	const quotaStore = createNotepadStore({ storage: memoryStorage({ writeError: quotaError }), debounceMs: 100_000 });
	const quotaId = quotaStore.getState().activeTabId;
	quotaStore.setNoteText(quotaId, 'Still available in memory');
	const quota = quotaStore.flush();
	assert.equal(quota.ok, false);
	assert.equal(quota.error.code, NOTEPAD_ERROR_CODES.quota);
	assert.equal(quotaStore.getState().tabs[0].text, 'Still available in memory');

	const unavailableStore = createNotepadStore({ storage: null, debounceMs: 100_000 });
	assert.equal(unavailableStore.getLoadResult().state, NOTEPAD_PERSISTENCE_STATES.unavailable);
	unavailableStore.setNoteText(unavailableStore.getState().activeTabId, 'Memory-only');
	const unavailable = unavailableStore.flush();
	assert.equal(unavailable.ok, false);
	assert.equal(unavailable.error.code, NOTEPAD_ERROR_CODES.unavailable);
});

test('notepad disposal flushes pending work and clears its private listeners', () => {
	const storage = memoryStorage();
	const store = createNotepadStore({ storage, debounceMs: 100_000 });
	let notifications = 0;
	store.subscribe(() => { notifications += 1; });
	store.setNoteText(store.getState().activeTabId, 'Flush on dispose');
	assert.equal(store.getDiagnostics().listenerCount, 1);
	const disposed = store.dispose();
	assert.equal(disposed.ok, true);
	assert.equal(storage.writes, 1);
	assert.equal(store.getDiagnostics().listenerCount, 0);
	assert.equal(store.setNoteText('missing', 'nope').error.code, NOTEPAD_ERROR_CODES.disposed);
	assert.ok(notifications >= 1);
});

test('malformed local storage does not erase valid tabs until a later explicit write', () => {
	const raw = JSON.stringify({
		schemaVersion: 1,
		activeTabId: 'kept',
		tabs: [null, { id: 'kept', title: 'Kept', text: 'Safe', createdAt: 1, updatedAt: 1 }],
		updatedAt: 1,
	});
	const storage = memoryStorage({ raw });
	const store = createNotepadStore({ storage, now: () => 2, debounceMs: 100_000 });
	assert.equal(store.getLoadResult().state, NOTEPAD_PERSISTENCE_STATES.malformed);
	assert.equal(store.getState().tabs.length, 1);
	assert.equal(store.getState().tabs[0].id, 'kept');
	assert.equal(storage.writes, 0, 'normalization never overwrites recovery data during load');
});
