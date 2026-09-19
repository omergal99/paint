// Bounded recent-text history for the textarea editor.
// This is intentionally separate from TextDocumentStore: it remembers text
// input for reuse, but it does not claim that raster pixels are editable
// objects or that a text entry owns a canvas region.

import { LIMITS, STORAGE_KEYS } from '../core/constants.js';

const MAX_ENTRIES = LIMITS.maxTextHistoryEntries;
const MAX_TEXT_LENGTH = 10000;

function clone(value) {
	return typeof structuredClone === 'function'
		? structuredClone(value)
		: JSON.parse(JSON.stringify(value));
}

function makeId() {
	return `text-history-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeEntry(value = {}) {
	const text = String(value.text ?? '').slice(0, MAX_TEXT_LENGTH);
	if (!text.trim()) return null;
	return {
		id: typeof value.id === 'string' && value.id ? value.id : makeId(),
		text,
		styles: Array.isArray(value.styles) ? [...new Set(value.styles.map(String))] : [],
		fontSize: Math.max(1, Number(value.fontSize) || 16),
		fontFamily: String(value.fontFamily || 'Segoe UI'),
		savedAt: Number.isFinite(Number(value.savedAt)) ? Number(value.savedAt) : Date.now(),
	};
}

function readEntries(storage, key) {
	try {
		const parsed = JSON.parse(storage?.getItem(key) || '[]');
		if (!Array.isArray(parsed)) return [];
		return parsed.map(normalizeEntry).filter(Boolean).slice(0, MAX_ENTRIES);
	} catch {
		return [];
	}
}

export function createTextHistoryStore({
	storage = globalThis.localStorage,
	key = STORAGE_KEYS.textHistory,
	maxEntries = MAX_ENTRIES,
} = {}) {
	const limit = Math.max(1, Math.min(MAX_ENTRIES, Number(maxEntries) || MAX_ENTRIES));
	let entries = readEntries(storage, key).slice(0, limit);
	const listeners = new Set();

	function getAll() {
		return clone(entries);
	}

	function persist() {
		try {
			if (entries.length) storage?.setItem(key, JSON.stringify(entries));
			else storage?.removeItem(key);
		} catch (error) {
			console.warn('Unable to persist text history', error);
		}
	}

	function notify() {
		const snapshot = getAll();
		listeners.forEach((listener) => listener(snapshot));
	}

	function record(value) {
		const next = normalizeEntry(value);
		if (!next) return null;
		const signature = `${next.text}\u0000${next.styles.join(',')}\u0000${next.fontSize}\u0000${next.fontFamily}`;
		entries = [next, ...entries.filter((entry) => {
			const entrySignature = `${entry.text}\u0000${entry.styles.join(',')}\u0000${entry.fontSize}\u0000${entry.fontFamily}`;
			return entrySignature !== signature;
		})].slice(0, limit);
		persist();
		notify();
		return clone(next);
	}

	function remove(id) {
		const next = entries.filter((entry) => entry.id !== id);
		if (next.length === entries.length) return false;
		entries = next;
		persist();
		notify();
		return true;
	}

	function clear() {
		if (!entries.length) return false;
		entries = [];
		persist();
		notify();
		return true;
	}

	function subscribe(listener) {
		if (typeof listener !== 'function') return () => {};
		listeners.add(listener);
		return () => listeners.delete(listener);
	}

	return Object.freeze({
		getAll,
		record,
		remove,
		clear,
		subscribe,
	});
}

export { MAX_ENTRIES as MAX_TEXT_HISTORY_ENTRIES };
