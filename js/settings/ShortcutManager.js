import { DEFAULT_SHORTCUT_BINDINGS, SHORTCUT_DEFINITIONS } from '../core/constants.js';

const MODIFIER_ORDER = Object.freeze(['mod', 'ctrl', 'alt', 'shift']);
const MODIFIER_ALIASES = Object.freeze({
	command: 'mod',
	cmd: 'mod',
	control: 'mod',
	ctrl: 'mod',
	meta: 'mod',
	mod: 'mod',
	alt: 'alt',
	option: 'alt',
	shift: 'shift',
});
const KEY_ALIASES = Object.freeze({
	' ': 'space',
	backspace: 'backspace',
	delete: 'delete',
	escape: 'escape',
	return: 'enter',
	'arrow up': 'arrowup',
	'arrow down': 'arrowdown',
	'arrow left': 'arrowleft',
	'arrow right': 'arrowright',
});

const normalizeKey = (value) => {
	const key = String(value || '').trim().toLowerCase();
	return KEY_ALIASES[key] || key.replace(/\s+/g, '');
};

export const normalizeShortcut = (value) => {
	if (Array.isArray(value)) value = value.join('+');
	if (typeof value !== 'string' || !value.trim()) return null;
	const parts = value.split('+').map((part) => part.trim().toLowerCase()).filter(Boolean);
	if (!parts.length) return null;
	const modifiers = new Set();
	let key = null;
	for (const part of parts) {
		const modifier = MODIFIER_ALIASES[part];
		if (modifier) {
			modifiers.add(modifier);
			continue;
		}
		if (key) return null;
		key = normalizeKey(part);
	}
	if (!key || ['mod', 'ctrl', 'alt', 'shift'].includes(key)) return null;
	return [...MODIFIER_ORDER.filter((modifier) => modifiers.has(modifier)), key].join('+');
};

export const shortcutFromEvent = (event) => {
	if (!event || ['Control', 'Meta', 'Alt', 'Shift'].includes(event.key)) return null;
	const modifiers = [];
	if (event.ctrlKey || event.metaKey) modifiers.push('mod');
	if (event.altKey) modifiers.push('alt');
	if (event.shiftKey) modifiers.push('shift');
	return normalizeShortcut([...modifiers, event.key].join('+'));
};

export const formatShortcut = (value) => {
	const normalized = normalizeShortcut(value);
	if (!normalized) return 'Not set';
	return normalized.split('+').map((part) => ({
		mod: 'Ctrl/Cmd',
		alt: 'Alt',
		shift: 'Shift',
		arrowup: '↑',
		arrowdown: '↓',
		arrowleft: '←',
		arrowright: '→',
		space: 'Space',
		delete: 'Delete',
		backspace: 'Backspace',
	}[part] || part.toUpperCase())).join('+');
};

const definitionMap = new Map(SHORTCUT_DEFINITIONS.map((definition) => [definition.action, definition]));

export const normalizeShortcutMap = (value = {}) => Object.fromEntries(
	SHORTCUT_DEFINITIONS.map(({ action }) => [action, normalizeShortcut(value[action]) || DEFAULT_SHORTCUT_BINDINGS[action]]),
);

export const createShortcutManager = ({ bindings = DEFAULT_SHORTCUT_BINDINGS, onChange = null } = {}) => {
	let current = normalizeShortcutMap(bindings);

	const notify = () => onChange?.(get());
	const get = () => ({ ...current });
	const resolve = (value) => {
		const normalized = normalizeShortcut(value);
		if (!normalized) return null;
		for (const definition of SHORTCUT_DEFINITIONS) {
			if (current[definition.action] === normalized || definition.aliases.includes(normalized)) return definition.action;
		}
		return null;
	};
	const isDefault = (action, value) => {
		const definition = definitionMap.get(action);
		return Boolean(definition && normalizeShortcut(value) === definition.defaultBinding);
	};
	const assign = (action, value) => {
		if (!definitionMap.has(action)) return { ok: false, reason: 'unknown-action' };
		const normalized = normalizeShortcut(value);
		if (!normalized) return { ok: false, reason: 'invalid-shortcut' };
		const conflict = SHORTCUT_DEFINITIONS.find((definition) => definition.action !== action
			&& (current[definition.action] === normalized || definition.aliases.includes(normalized)));
		if (conflict) return { ok: false, reason: 'conflict', conflict: conflict.action };
		current = { ...current, [action]: normalized };
		notify();
		return { ok: true, value: normalized };
	};
	const reset = (action) => assign(action, definitionMap.get(action)?.defaultBinding);
	const replace = (value) => {
		current = normalizeShortcutMap(value);
		notify();
	};
	return Object.freeze({ get, resolve, isDefault, assign, reset, replace });
};
