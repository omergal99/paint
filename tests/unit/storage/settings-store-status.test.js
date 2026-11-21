import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_SETTINGS, STORAGE_KEYS } from '../../../js/core/constants.js';
import { createPaintSettingsStore } from '../../../js/app/settingsStore.js';

const createStorage = (initialValue) => {
	const values = new Map(initialValue ? [[STORAGE_KEYS.settings, JSON.stringify(initialValue)]] : []);
	return {
		getItem: (key) => values.get(key) ?? null,
		setItem: (key, value) => values.set(key, String(value)),
	};
};

test('new settings default to a five-second status duration', () => {
	const settings = createPaintSettingsStore({ storage: createStorage() });
	assert.equal(settings.get().statusFlashDuration, 5000);
});

test('existing duration choices are preserved while new settings use the new default', () => {
	const oldDefault = createPaintSettingsStore({
		storage: createStorage({ statusFlashDuration: 2200 }),
	});
	const oldCustom = createPaintSettingsStore({
		storage: createStorage({ statusFlashDuration: 3400 }),
	});

	assert.equal(oldDefault.get().statusFlashDuration, 2200);
	assert.equal(oldCustom.get().statusFlashDuration, 3400);
	assert.equal(createPaintSettingsStore({ storage: createStorage() }).get().statusFlashDuration,
		DEFAULT_SETTINGS.statusFlashDuration);
});
