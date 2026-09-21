// Local-only, plain-text notepad state. This deliberately owns no DOM,
// language strings, page lifecycle listeners, or service-worker wiring.

export const NOTEPAD_SCHEMA_VERSION = 1;
export const NOTEPAD_STORAGE_KEY = 'paint:notepad';
export const MAX_NOTEPAD_TABS = 8;
export const MAX_NOTE_TITLE_LENGTH = 120;
export const MAX_NOTE_TITLE_BYTES = 512;
export const MAX_NOTE_TEXT_LENGTH = 20_000;
export const MAX_NOTE_TEXT_BYTES = 24 * 1024;
export const MAX_NOTEPAD_RECORD_BYTES = 256 * 1024;
export const DEFAULT_NOTEPAD_DEBOUNCE_MS = 500;

export const NOTEPAD_ERROR_CODES = Object.freeze({
	disposed: 'disposed',
	invalidTab: 'invalid-tab',
	tabMissing: 'tab-missing',
	tabLimit: 'tab-limit',
	duplicateTab: 'duplicate-tab',
	titleTooLong: 'title-too-long',
	noteTooLong: 'note-too-long',
	recordTooLarge: 'record-too-large',
	quota: 'quota',
	unavailable: 'unavailable',
	malformed: 'malformed',
});

export const NOTEPAD_PERSISTENCE_STATES = Object.freeze({
	idle: 'idle',
	pending: 'pending',
	saved: 'saved',
	unchanged: 'unchanged',
	quota: 'quota',
	unavailable: 'unavailable',
	malformed: 'malformed',
	disposed: 'disposed',
});

const isObject = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const isId = (value) => typeof value === 'string' && value.trim().length > 0 && value.length <= 96;
const finitePositive = (value, fallback) => Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
const bounded = (value, fallback, maximum) => Math.min(maximum, finitePositive(value, fallback));
const resultError = (code, extra = {}) => Object.freeze({ ok: false, error: Object.freeze({ code, ...extra }) });
const resultOk = (extra = {}) => ({ ok: true, ...extra });

const encodedLength = (value) => {
	if (typeof TextEncoder === 'function') return new TextEncoder().encode(value).byteLength;
	return unescape(encodeURIComponent(value)).length;
};

const trimPlainText = (value, { maxCharacters, maxBytes }) => {
	if (typeof value !== 'string') return '';
	let result = '';
	let bytes = 0;
	let characters = 0;
	for (const character of value) {
		if (characters >= maxCharacters) break;
		const characterBytes = encodedLength(character);
		if (bytes + characterBytes > maxBytes) break;
		result += character;
		bytes += characterBytes;
		characters += 1;
	}
	return result;
};

const fitsPlainTextBounds = (value, limits) => (
	typeof value === 'string'
	&& [...value].length <= limits.maxCharacters
	&& encodedLength(value) <= limits.maxBytes
);

const makeId = () => `note-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
const defaultStorage = () => {
	try { return globalThis.localStorage || null; } catch { return null; }
};

const normalTimestamp = (value, now) => {
	const timestamp = Number(value);
	return Number.isFinite(timestamp) && timestamp > 0 && timestamp <= now + 5 * 60 * 1000
		? Math.floor(timestamp)
		: now;
};

const limitsFrom = ({ maxTabs, maxTitleLength, maxTitleBytes, maxNoteLength, maxNoteBytes, maxRecordBytes } = {}) => Object.freeze({
	maxTabs: bounded(maxTabs, MAX_NOTEPAD_TABS, MAX_NOTEPAD_TABS),
	maxTitleLength: bounded(maxTitleLength, MAX_NOTE_TITLE_LENGTH, MAX_NOTE_TITLE_LENGTH),
	maxTitleBytes: bounded(maxTitleBytes, MAX_NOTE_TITLE_BYTES, MAX_NOTE_TITLE_BYTES),
	maxNoteLength: bounded(maxNoteLength, MAX_NOTE_TEXT_LENGTH, MAX_NOTE_TEXT_LENGTH),
	maxNoteBytes: bounded(maxNoteBytes, MAX_NOTE_TEXT_BYTES, MAX_NOTE_TEXT_BYTES),
	maxRecordBytes: bounded(maxRecordBytes, MAX_NOTEPAD_RECORD_BYTES, MAX_NOTEPAD_RECORD_BYTES),
});

const createBlankTab = ({ now, idFactory = makeId, usedIds = new Set() } = {}) => {
	let id = null;
	for (let attempts = 0; attempts < 32; attempts += 1) {
		const candidate = idFactory();
		if (isId(candidate) && !usedIds.has(candidate)) {
			id = candidate;
			break;
		}
	}
	if (!id) id = `note-${now.toString(36)}-${usedIds.size}`;
	while (usedIds.has(id)) id = `${id}-1`;
	usedIds.add(id);
	return { id, title: '', text: '', createdAt: now, updatedAt: now };
};

const cloneRecord = (record) => ({
	schemaVersion: NOTEPAD_SCHEMA_VERSION,
	activeTabId: record.activeTabId,
	tabs: record.tabs.map((tab) => ({ ...tab })),
	updatedAt: record.updatedAt,
});

const serializedRecord = (record) => JSON.stringify(record);

const normalizeTab = ({ value, now, limits, idFactory, usedIds }) => {
	if (!isObject(value)) return null;
	let id = isId(value.id) ? value.id : null;
	let recovered = !id;
	if (!id || usedIds.has(id)) {
		id = createBlankTab({ now, idFactory, usedIds }).id;
		recovered = true;
	} else usedIds.add(id);
	const title = trimPlainText(value.title, { maxCharacters: limits.maxTitleLength, maxBytes: limits.maxTitleBytes });
	const text = trimPlainText(value.text, { maxCharacters: limits.maxNoteLength, maxBytes: limits.maxNoteBytes });
	if (title !== value.title || text !== value.text) recovered = true;
	return {
		tab: {
			id,
			title,
			text,
			createdAt: normalTimestamp(value.createdAt, now),
			updatedAt: normalTimestamp(value.updatedAt, now),
		},
		recovered,
	};
};

/**
 * Safely recovers valid individual tabs from an untrusted record. A bad tab,
 * old schema, duplicate id, or out-of-bounds text never discards other tabs.
 * A missing record gets one neutral blank tab; an explicit empty `tabs: []`
 * remains empty so a future UI can show its empty state.
 */
export const normalizeNotepadRecord = (value, {
	now = Date.now(),
	idFactory = makeId,
	...limitOptions
} = {}) => {
	try {
		const limits = limitsFrom(limitOptions);
		const missing = value === null || value === undefined;
		const source = isObject(value) ? value : {};
		const sourceTabs = Array.isArray(source.tabs) ? source.tabs : [];
		const usedIds = new Set();
		const tabs = [];
		let recovered = missing || !isObject(value) || source.schemaVersion !== NOTEPAD_SCHEMA_VERSION || !Array.isArray(source.tabs);
		// Scan more than the cap so invalid early entries do not prevent a later
		// valid note from being recovered, while still bounding hostile input work.
		const scanLimit = Math.max(limits.maxTabs * 4, limits.maxTabs);
		for (const candidate of sourceTabs.slice(0, scanLimit)) {
			if (tabs.length >= limits.maxTabs) break;
			const normalized = normalizeTab({ value: candidate, now, limits, idFactory, usedIds });
			if (!normalized) {
				recovered = true;
				continue;
			}
			tabs.push(normalized.tab);
			recovered = recovered || normalized.recovered;
		}
		if (sourceTabs.length > scanLimit || sourceTabs.length > limits.maxTabs) recovered = true;
		if (missing) tabs.push(createBlankTab({ now, idFactory, usedIds }));
		const requestedActiveId = isId(source.activeTabId) ? source.activeTabId : null;
		const activeTabId = tabs.some((tab) => tab.id === requestedActiveId) ? requestedActiveId : (tabs[0]?.id || null);
		if (activeTabId !== requestedActiveId) recovered = true;
		const record = {
			schemaVersion: NOTEPAD_SCHEMA_VERSION,
			activeTabId,
			tabs,
			updatedAt: normalTimestamp(source.updatedAt, now),
		};
		if (encodedLength(serializedRecord(record)) > limits.maxRecordBytes) {
			// Individual limits should make this rare, but keep a final guard and
			// preserve the earliest valid notes rather than rejecting the whole set.
			while (record.tabs.length > 1 && encodedLength(serializedRecord(record)) > limits.maxRecordBytes) {
				record.tabs.pop();
			}
			if (record.activeTabId && !record.tabs.some((tab) => tab.id === record.activeTabId)) record.activeTabId = record.tabs[0]?.id || null;
			recovered = true;
		}
		return resultOk({ record, recovered, limits });
	} catch {
		return resultError(NOTEPAD_ERROR_CODES.malformed);
	}
};

const persistenceResult = (state, extra = {}) => Object.freeze({ state, ...extra });

const classifyStorageError = (error) => {
	const name = String(error?.name || '').toLowerCase();
	const message = String(error?.message || '').toLowerCase();
	const quota = name.includes('quota') || message.includes('quota') || message.includes('exceeded') || Number(error?.code) === 22;
	return quota ? NOTEPAD_ERROR_CODES.quota : NOTEPAD_ERROR_CODES.unavailable;
};

const readInitialRecord = ({ storage, key, now, idFactory, limits }) => {
	if (!storage?.getItem) {
		const normalized = normalizeNotepadRecord(null, { now, idFactory, ...limits });
		return { record: normalized.record, load: persistenceResult(NOTEPAD_PERSISTENCE_STATES.unavailable, { code: NOTEPAD_ERROR_CODES.unavailable }) };
	}
	let raw;
	try {
		raw = storage.getItem(key);
	} catch {
		const normalized = normalizeNotepadRecord(null, { now, idFactory, ...limits });
		return { record: normalized.record, load: persistenceResult(NOTEPAD_PERSISTENCE_STATES.unavailable, { code: NOTEPAD_ERROR_CODES.unavailable }) };
	}
	if (!raw) {
		const normalized = normalizeNotepadRecord(null, { now, idFactory, ...limits });
		return { record: normalized.record, load: persistenceResult(NOTEPAD_PERSISTENCE_STATES.idle, { recovered: false }) };
	}
	try {
		const parsed = JSON.parse(raw);
		const normalized = normalizeNotepadRecord(parsed, { now, idFactory, ...limits });
		if (!normalized.ok) {
			const blank = normalizeNotepadRecord(null, { now, idFactory, ...limits });
			return { record: blank.record, load: persistenceResult(NOTEPAD_PERSISTENCE_STATES.malformed, { code: NOTEPAD_ERROR_CODES.malformed }) };
		}
		return {
			record: normalized.record,
			load: persistenceResult(normalized.recovered ? NOTEPAD_PERSISTENCE_STATES.malformed : NOTEPAD_PERSISTENCE_STATES.idle, {
				code: normalized.recovered ? NOTEPAD_ERROR_CODES.malformed : null,
				recovered: normalized.recovered,
			}),
		};
	} catch {
		const blank = normalizeNotepadRecord(null, { now, idFactory, ...limits });
		return { record: blank.record, load: persistenceResult(NOTEPAD_PERSISTENCE_STATES.malformed, { code: NOTEPAD_ERROR_CODES.malformed }) };
	}
};

/**
 * Active-tab CRUD plus debounced localStorage persistence. All mutations are
 * immediately usable in memory; persistence failures are returned explicitly
 * from `flush()` and exposed through `getPersistenceStatus()`.
 */
export const createNotepadStore = ({
	storage = undefined,
	key = NOTEPAD_STORAGE_KEY,
	debounceMs = DEFAULT_NOTEPAD_DEBOUNCE_MS,
	now = () => Date.now(),
	idFactory = makeId,
	setTimeoutFn = globalThis.setTimeout?.bind(globalThis),
	clearTimeoutFn = globalThis.clearTimeout?.bind(globalThis),
	...limitOptions
} = {}) => {
	const storageAdapter = storage === undefined ? defaultStorage() : storage;
	const limits = limitsFrom(limitOptions);
	const delay = finitePositive(debounceMs, DEFAULT_NOTEPAD_DEBOUNCE_MS);
	const initial = readInitialRecord({ storage: storageAdapter, key, now: now(), idFactory, limits });
	let record = initial.record;
	let dirty = false;
	let disposed = false;
	let timer = null;
	let lastPersistence = initial.load;
	const listeners = new Set();

	const state = () => cloneRecord(record);
	const activeTab = () => record.tabs.find((tab) => tab.id === record.activeTabId) || null;
	const unavailable = () => resultError(NOTEPAD_ERROR_CODES.disposed);
	const notify = (type, persistence = lastPersistence) => {
		if (disposed) return;
		const event = Object.freeze({ type, state: state(), persistence });
		[...listeners].forEach((listener) => {
			try { listener(event); } catch {}
		});
	};

	const schedule = () => {
		dirty = true;
		lastPersistence = persistenceResult(NOTEPAD_PERSISTENCE_STATES.pending);
		if (timer !== null || typeof setTimeoutFn !== 'function') return lastPersistence;
		timer = setTimeoutFn(() => {
			timer = null;
			flush();
		}, delay);
		return lastPersistence;
	};

	const fitsRecordBudget = (candidate) => {
		try { return encodedLength(serializedRecord(candidate)) <= limits.maxRecordBytes; } catch { return false; }
	};

	const commit = (type, candidate, extra = {}) => {
		if (disposed) return unavailable();
		if (!fitsRecordBudget(candidate)) return resultError(NOTEPAD_ERROR_CODES.recordTooLarge, { limit: limits.maxRecordBytes });
		record = candidate;
		const persistence = schedule();
		notify(type, persistence);
		return resultOk({ state: state(), persistence, ...extra });
	};

	const flush = () => {
		if (disposed) return resultError(NOTEPAD_ERROR_CODES.disposed);
		if (timer !== null) {
			if (typeof clearTimeoutFn === 'function') clearTimeoutFn(timer);
			timer = null;
		}
		if (!dirty) {
			lastPersistence = persistenceResult(NOTEPAD_PERSISTENCE_STATES.unchanged);
			return resultOk({ persistence: lastPersistence, state: state() });
		}
		if (!storageAdapter?.setItem) {
			lastPersistence = persistenceResult(NOTEPAD_PERSISTENCE_STATES.unavailable, { code: NOTEPAD_ERROR_CODES.unavailable });
			notify('persistence-failed', lastPersistence);
			return resultError(NOTEPAD_ERROR_CODES.unavailable, { persistence: lastPersistence, state: state() });
		}
		let serialized;
		try {
			serialized = serializedRecord(record);
			if (encodedLength(serialized) > limits.maxRecordBytes) {
				lastPersistence = persistenceResult(NOTEPAD_PERSISTENCE_STATES.unavailable, { code: NOTEPAD_ERROR_CODES.recordTooLarge });
				notify('persistence-failed', lastPersistence);
				return resultError(NOTEPAD_ERROR_CODES.recordTooLarge, { persistence: lastPersistence, state: state() });
			}
			storageAdapter.setItem(key, serialized);
			dirty = false;
			lastPersistence = persistenceResult(NOTEPAD_PERSISTENCE_STATES.saved);
			notify('persistence-saved', lastPersistence);
			return resultOk({ persistence: lastPersistence, state: state() });
		} catch (error) {
			const code = classifyStorageError(error);
			const persistenceState = code === NOTEPAD_ERROR_CODES.quota
				? NOTEPAD_PERSISTENCE_STATES.quota
				: NOTEPAD_PERSISTENCE_STATES.unavailable;
			lastPersistence = persistenceResult(persistenceState, { code });
			notify('persistence-failed', lastPersistence);
			return resultError(code, { persistence: lastPersistence, state: state() });
		}
	};

	const createTab = ({ id = null, title = '', text = '' } = {}) => {
		if (disposed) return unavailable();
		if (record.tabs.length >= limits.maxTabs) return resultError(NOTEPAD_ERROR_CODES.tabLimit, { limit: limits.maxTabs });
		if (id !== null && !isId(id)) return resultError(NOTEPAD_ERROR_CODES.invalidTab);
		if (id && record.tabs.some((tab) => tab.id === id)) return resultError(NOTEPAD_ERROR_CODES.duplicateTab);
		if (!fitsPlainTextBounds(title, { maxCharacters: limits.maxTitleLength, maxBytes: limits.maxTitleBytes })) {
			return resultError(NOTEPAD_ERROR_CODES.titleTooLong, { limit: limits.maxTitleLength });
		}
		if (!fitsPlainTextBounds(text, { maxCharacters: limits.maxNoteLength, maxBytes: limits.maxNoteBytes })) {
			return resultError(NOTEPAD_ERROR_CODES.noteTooLong, { limit: limits.maxNoteLength });
		}
		const usedIds = new Set(record.tabs.map((tab) => tab.id));
		const tab = id ? { id, title, text, createdAt: now(), updatedAt: now() } : createBlankTab({ now: now(), idFactory, usedIds });
		if (!id) {
			tab.title = title;
			tab.text = text;
		}
		const candidate = cloneRecord(record);
		candidate.tabs.push(tab);
		candidate.activeTabId = tab.id;
		candidate.updatedAt = now();
		return commit('tab-created', candidate, { tab: { ...tab } });
	};

	const setActiveTab = (id) => {
		if (disposed) return unavailable();
		if (!record.tabs.some((tab) => tab.id === id)) return resultError(NOTEPAD_ERROR_CODES.tabMissing);
		const candidate = cloneRecord(record);
		candidate.activeTabId = id;
		candidate.updatedAt = now();
		return commit('active-tab-changed', candidate);
	};

	const renameTab = (id, title) => {
		if (disposed) return unavailable();
		if (!fitsPlainTextBounds(title, { maxCharacters: limits.maxTitleLength, maxBytes: limits.maxTitleBytes })) {
			return resultError(NOTEPAD_ERROR_CODES.titleTooLong, { limit: limits.maxTitleLength });
		}
		const index = record.tabs.findIndex((tab) => tab.id === id);
		if (index < 0) return resultError(NOTEPAD_ERROR_CODES.tabMissing);
		const candidate = cloneRecord(record);
		candidate.tabs[index] = { ...candidate.tabs[index], title, updatedAt: now() };
		candidate.updatedAt = now();
		return commit('tab-renamed', candidate, { tab: { ...candidate.tabs[index] } });
	};

	const setNoteText = (id, text) => {
		if (disposed) return unavailable();
		if (!fitsPlainTextBounds(text, { maxCharacters: limits.maxNoteLength, maxBytes: limits.maxNoteBytes })) {
			return resultError(NOTEPAD_ERROR_CODES.noteTooLong, { limit: limits.maxNoteLength });
		}
		const index = record.tabs.findIndex((tab) => tab.id === id);
		if (index < 0) return resultError(NOTEPAD_ERROR_CODES.tabMissing);
		const candidate = cloneRecord(record);
		candidate.tabs[index] = { ...candidate.tabs[index], text, updatedAt: now() };
		candidate.updatedAt = now();
		return commit('note-text-changed', candidate, { tab: { ...candidate.tabs[index] } });
	};

	const deleteTab = (id) => {
		if (disposed) return unavailable();
		const index = record.tabs.findIndex((tab) => tab.id === id);
		if (index < 0) return resultError(NOTEPAD_ERROR_CODES.tabMissing);
		const candidate = cloneRecord(record);
		const [deleted] = candidate.tabs.splice(index, 1);
		if (candidate.activeTabId === id) candidate.activeTabId = candidate.tabs[index]?.id || candidate.tabs[index - 1]?.id || null;
		candidate.updatedAt = now();
		return commit('tab-deleted', candidate, { tab: deleted });
	};

	const subscribe = (listener) => {
		if (disposed || typeof listener !== 'function') return () => {};
		listeners.add(listener);
		return () => listeners.delete(listener);
	};

	const dispose = ({ flush: shouldFlush = true } = {}) => {
		if (disposed) return false;
		let persisted = resultOk({ persistence: persistenceResult(NOTEPAD_PERSISTENCE_STATES.idle) });
		if (shouldFlush) persisted = flush();
		else if (timer !== null && typeof clearTimeoutFn === 'function') clearTimeoutFn(timer);
		timer = null;
		listeners.clear();
		disposed = true;
		return persisted;
	};

	return Object.freeze({
		getState: state,
		getActiveTab: () => activeTab() ? { ...activeTab() } : null,
		getLoadResult: () => initial.load,
		getPersistenceStatus: () => lastPersistence,
		getLimits: () => limits,
		createTab,
		setActiveTab,
		renameTab,
		setNoteText,
		deleteTab,
		flush,
		subscribe,
		dispose,
		getDiagnostics: () => Object.freeze({ listenerCount: listeners.size, dirty, disposed, timerActive: timer !== null }),
	});
};
