import assert from 'node:assert/strict';
import test from 'node:test';
import { LIMITS, STORAGE_KEYS } from '../../../js/core/constants.js';
import { createStatusHistoryStore } from '../../../js/storage/StatusHistoryStore.js';

const createStorage = () => {
	const values = new Map();
	return {
		getItem: (key) => values.get(key) ?? null,
		setItem: (key, value) => values.set(key, String(value)),
	};
};

test('status history persists newest entries first and retains no more than its limit', () => {
	const storage = createStorage();
	const store = createStatusHistoryStore({ storage });

	for (let index = 0; index < LIMITS.maxStatusHistoryEntries + 3; index += 1) {
		store.record({
			message: `Status ${index}`,
			timestamp: new Date(Date.UTC(2026, 10, 21, 0, index)).toISOString(),
		});
	}

	const entries = store.getEntries();
	assert.equal(entries.length, 50);
	assert.equal(entries[0].message, 'Status 52');
	assert.equal(entries.at(-1).message, 'Status 3');
	assert.equal(JSON.parse(storage.getItem(STORAGE_KEYS.statusHistory)).length, 50);
});

test('status history rejects malformed entries and corrupted persisted data', () => {
	const storage = createStorage();
	const store = createStatusHistoryStore({ storage });

	assert.throws(() => store.record({ message: '', timestamp: 'invalid' }), TypeError);
	storage.setItem(STORAGE_KEYS.statusHistory, '{');
	assert.throws(() => store.getEntries(), SyntaxError);
});
