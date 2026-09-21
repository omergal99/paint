import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_SHORTCUT_BINDINGS, SHORTCUT_ACTIONS } from '../js/core/constants.js';
import {
	createShortcutManager,
	formatShortcut,
	normalizeShortcut,
	shortcutFromEvent,
} from '../js/settings/ShortcutManager.js';
import { createSettingsStore } from '../js/settings/SettingsStore.js';

test('shortcut normalization is stable across keyboard naming conventions', () => {
	assert.equal(normalizeShortcut('Ctrl + Shift + Z'), 'mod+shift+z');
	assert.equal(normalizeShortcut('Command+Arrow Up'), 'mod+arrowup');
	assert.equal(shortcutFromEvent({ key: 's', ctrlKey: true, metaKey: false, altKey: false, shiftKey: false }), 'mod+s');
	assert.equal(formatShortcut('mod+arrowright'), 'Ctrl/Cmd+→');
});

test('shortcut assignments reject conflicts and resolve custom bindings', () => {
	const manager = createShortcutManager();
	assert.equal(manager.resolve('mod+z'), SHORTCUT_ACTIONS.undo);
	assert.equal(manager.assign(SHORTCUT_ACTIONS.save, 'Ctrl+Shift+S').ok, true);
	assert.equal(manager.resolve('mod+shift+s'), SHORTCUT_ACTIONS.save);
	const conflict = manager.assign(SHORTCUT_ACTIONS.open, 'Ctrl+Shift+S');
	assert.equal(conflict.ok, false);
	assert.equal(conflict.reason, 'conflict');
	assert.equal(manager.reset(SHORTCUT_ACTIONS.save).ok, true);
	assert.equal(manager.resolve('mod+s'), SHORTCUT_ACTIONS.save);
});

test('custom shortcut bindings survive the settings store round trip', () => {
	const values = new Map();
	const storage = {
		getItem: (key) => values.get(key) || null,
		setItem: (key, value) => values.set(key, value),
	};
	const store = createSettingsStore({
		storage,
		key: 'settings',
		defaults: { shortcuts: DEFAULT_SHORTCUT_BINDINGS },
	});
	const manager = createShortcutManager({ bindings: store.get().shortcuts });
	assert.equal(manager.assign(SHORTCUT_ACTIONS.pencilTool, 'Ctrl+Shift+P').ok, true);
	store.set({ shortcuts: manager.get() });
	const restored = createSettingsStore({
		storage,
		key: 'settings',
		defaults: { shortcuts: DEFAULT_SHORTCUT_BINDINGS },
	});
	assert.equal(restored.get().shortcuts.pencilTool, 'mod+shift+p');
});
