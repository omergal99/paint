import { SCHEMA_VERSIONS, STORAGE_KEYS } from '../core/constants.js';

function clone(value) {
	if (!value || typeof value !== 'object') return value;
	try {
		return typeof structuredClone === 'function'
			? structuredClone(value)
			: JSON.parse(JSON.stringify(value));
	} catch {
		return value;
	}
}

function readStored(storage, key) {
	try {
		const raw = storage?.getItem(key);
		return raw ? JSON.parse(raw) : null;
	} catch {
		return null;
	}
}

export function createSettingsStore({
	storage = globalThis.localStorage,
	key = STORAGE_KEYS.settings,
	defaults = {},
	validators = {},
	migrate = (value) => value,
} = {}) {
	const base = clone(defaults) || {};
	const listeners = new Set();

	function normalize(value) {
		let migrated = value && typeof value === 'object' ? value : {};
		try { migrated = migrate(migrated) || {}; } catch { migrated = {}; }
		const next = { ...base, ...migrated };
		Object.entries(validators).forEach(([name, validate]) => {
			if (typeof validate === 'function' && !validate(next[name])) next[name] = clone(base[name]);
		});
		return next;
	}

	let state = normalize(readStored(storage, key));

	function persist() {
		try {
			storage?.setItem(key, JSON.stringify({ ...state, schemaVersion: SCHEMA_VERSIONS.settings }));
			return true;
		} catch {
			return false;
		}
	}

	function notify() {
		const snapshot = clone(state);
		listeners.forEach((listener) => listener(snapshot));
	}

	return {
		get() { return clone(state); },
		set(patch = {}) {
			state = normalize({ ...state, ...patch });
			const persisted = persist();
			notify();
			return { settings: clone(state), persisted };
		},
		replace(value = {}) {
			state = normalize(value);
			const persisted = persist();
			notify();
			return { settings: clone(state), persisted };
		},
		reset() {
			state = normalize({});
			const persisted = persist();
			notify();
			return { settings: clone(state), persisted };
		},
		subscribe(listener) {
			if (typeof listener !== 'function') return () => {};
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
	};
}
