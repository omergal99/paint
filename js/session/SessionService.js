// In-memory workspace ownership for future tabs/split panes. This module is
// intentionally UI-, canvas-, and storage-neutral: callers render a snapshot
// and persist it through their own adapters.

import { createPaintDocument, isPaintDocument } from '../core/DocumentContract.js';

export const SESSION_SCHEMA_VERSION = 1;
export const MAX_SESSION_DOCUMENTS = 10;
export const MAX_RECENTLY_CLOSED_DOCUMENTS = 10;
export const SESSION_PANES = Object.freeze({
	primary: 'primary',
	secondary: 'secondary',
});

export const SESSION_ERROR_CODES = Object.freeze({
	disposed: 'disposed',
	invalidDocument: 'invalid-document',
	duplicateDocument: 'duplicate-document',
	documentLimit: 'document-limit',
	documentMissing: 'document-missing',
	lastDocument: 'last-document',
	nothingToUndoClose: 'nothing-to-undo-close',
	closedDocumentConflict: 'closed-document-conflict',
	invalidPane: 'invalid-pane',
	invalidState: 'invalid-state',
});

const paneNames = new Set(Object.values(SESSION_PANES));
const isObject = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const isPlainObject = (value) => Boolean(isObject(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null));
const isPositiveSafeInteger = (value) => Number.isSafeInteger(value) && value > 0;
const isDocumentId = (value) => typeof value === 'string' && value.trim().length > 0;

const cloneValue = (value, fallback) => {
	if (value === undefined) return fallback;
	try {
		if (typeof structuredClone === 'function') return structuredClone(value);
	} catch {}
	try { return JSON.parse(JSON.stringify(value)); } catch { return fallback; }
};

const cloneDocument = (document) => ({
	schemaVersion: document.schemaVersion,
	id: document.id,
	pixels: { width: document.pixels.width, height: document.pixels.height },
	selection: cloneValue(document.selection, null),
	textObjects: cloneValue(document.textObjects, []),
	history: {
		undo: cloneValue(document.history?.undo, []),
		redo: cloneValue(document.history?.redo, []),
	},
	dirty: Boolean(document.dirty),
	metadata: cloneValue(document.metadata, {}),
});

const failure = (code, message) => Object.freeze({ ok: false, error: Object.freeze({ code, message }) });
const success = (extra = {}) => ({ ok: true, ...extra });
const validPane = (pane) => paneNames.has(pane);

export const normalizePaintDocumentRecord = (value) => {
	try {
		if (!isPaintDocument(value) || !isDocumentId(value.id)) {
			return failure(SESSION_ERROR_CODES.invalidDocument, 'Document does not match the PaintDocument contract.');
		}
		if (!isPositiveSafeInteger(value.pixels.width) || !isPositiveSafeInteger(value.pixels.height)) {
			return failure(SESSION_ERROR_CODES.invalidDocument, 'Document dimensions must be positive whole pixels.');
		}
		const document = cloneDocument({
			...value,
			selection: value.selection ?? null,
			textObjects: Array.isArray(value.textObjects) ? value.textObjects : [],
			history: isObject(value.history) ? value.history : { undo: [], redo: [] },
			metadata: isPlainObject(value.metadata) ? value.metadata : {},
		});
		if (!Array.isArray(document.textObjects) || !Array.isArray(document.history.undo) || !Array.isArray(document.history.redo) || !isPlainObject(document.metadata)) {
			return failure(SESSION_ERROR_CODES.invalidDocument, 'Document contains unsafe non-serializable state.');
		}
		return success({ document });
	} catch {
		return failure(SESSION_ERROR_CODES.invalidDocument, 'Document could not be read safely.');
	}
};

const normalizeLimit = (value, fallback) => (
	Number.isSafeInteger(value) && value > 0 ? value : fallback
);
const normalizeDocumentLimit = (value) => Math.min(MAX_SESSION_DOCUMENTS, normalizeLimit(value, MAX_SESSION_DOCUMENTS));

const makeEmptyState = () => ({
	documents: new Map(),
	tabOrder: [],
	activeDocumentId: null,
	activePane: SESSION_PANES.primary,
	panes: { [SESSION_PANES.primary]: null, [SESSION_PANES.secondary]: null },
	closed: [],
});

const stateSnapshot = (state, { maxDocuments, maxRecentlyClosed, disposed = false } = {}) => ({
	schemaVersion: SESSION_SCHEMA_VERSION,
	documents: state.tabOrder.map((id) => cloneDocument(state.documents.get(id))).filter(Boolean),
	tabOrder: [...state.tabOrder],
	activeDocumentId: state.activeDocumentId,
	activePane: state.activePane,
	panes: { ...state.panes },
	canUndoClose: state.closed.length > 0,
	closedDocumentCount: state.closed.length,
	maxDocuments,
	maxRecentlyClosed,
	disposed: Boolean(disposed),
});

const normalizePaneState = ({ paneState, documentIds }) => {
	if (!isObject(paneState) || !validPane(paneState.activePane)) {
		return failure(SESSION_ERROR_CODES.invalidState, 'Session pane state is invalid.');
	}
	if (!isObject(paneState.panes)) return failure(SESSION_ERROR_CODES.invalidState, 'Session pane assignments are invalid.');
	const primary = paneState.panes[SESSION_PANES.primary];
	const secondary = paneState.panes[SESSION_PANES.secondary];
	if (!documentIds.has(primary) || (secondary !== null && !documentIds.has(secondary))) {
		return failure(SESSION_ERROR_CODES.invalidState, 'Session pane references a missing document.');
	}
	if (!documentIds.has(paneState.activeDocumentId)) {
		return failure(SESSION_ERROR_CODES.invalidState, 'Session active document is missing.');
	}
	return success({
		activeDocumentId: paneState.activeDocumentId,
		activePane: paneState.activePane,
		panes: { [SESSION_PANES.primary]: primary, [SESSION_PANES.secondary]: secondary },
	});
};

/**
 * Strictly validates a serializable session snapshot before it is restored.
 * Recovery uses this to reject malformed records without mutating live state.
 */
export const normalizeSessionState = (value, { maxDocuments = MAX_SESSION_DOCUMENTS } = {}) => {
	const limit = normalizeDocumentLimit(maxDocuments);
	if (!isObject(value) || value.schemaVersion !== SESSION_SCHEMA_VERSION || !Array.isArray(value.documents) || !Array.isArray(value.tabOrder)) {
		return failure(SESSION_ERROR_CODES.invalidState, 'Session record does not match the expected schema.');
	}
	if (value.documents.length < 1 || value.documents.length > limit || value.tabOrder.length !== value.documents.length) {
		return failure(SESSION_ERROR_CODES.invalidState, 'Session document count is outside the allowed range.');
	}
	const documents = new Map();
	for (const item of value.documents) {
		const normalized = normalizePaintDocumentRecord(item);
		if (!normalized.ok || documents.has(normalized.document.id)) {
			return failure(SESSION_ERROR_CODES.invalidState, 'Session contains an invalid or duplicate document.');
		}
		documents.set(normalized.document.id, normalized.document);
	}
	const tabOrder = [...value.tabOrder];
	if (new Set(tabOrder).size !== tabOrder.length || tabOrder.some((id) => !documents.has(id))) {
		return failure(SESSION_ERROR_CODES.invalidState, 'Session tab order is invalid.');
	}
	const paneState = normalizePaneState({ paneState: value, documentIds: new Set(tabOrder) });
	if (!paneState.ok) return paneState;
	return success({
		state: {
			documents,
			tabOrder,
			activeDocumentId: paneState.activeDocumentId,
			activePane: paneState.activePane,
			panes: paneState.panes,
			closed: [],
		},
	});
};

/**
 * A listener-owning but DOM-listener-free session core. `dispose()` clears its
 * subscription set and every document reference, making it safe for a future
 * workspace controller to replace without retaining canvases or callbacks.
 */
export const createSessionService = ({
	initialState = null,
	initialDocuments = null,
	maxDocuments = MAX_SESSION_DOCUMENTS,
	maxRecentlyClosed = MAX_RECENTLY_CLOSED_DOCUMENTS,
} = {}) => {
	const documentLimit = normalizeDocumentLimit(maxDocuments);
	const closedLimit = Math.min(MAX_RECENTLY_CLOSED_DOCUMENTS, normalizeLimit(maxRecentlyClosed, MAX_RECENTLY_CLOSED_DOCUMENTS));
	const listeners = new Set();
	let disposed = false;
	let state = makeEmptyState();
	let initialization = success();

	const applyNormalizedState = (normalized) => {
		state = normalized.state;
		state.closed = [];
	};

	const makeDefaultState = () => {
		const document = createPaintDocument();
		state.documents.set(document.id, cloneDocument(document));
		state.tabOrder.push(document.id);
		state.activeDocumentId = document.id;
		state.panes[SESSION_PANES.primary] = document.id;
	};

	if (initialState) {
		const normalized = normalizeSessionState(initialState, { maxDocuments: documentLimit });
		if (normalized.ok) applyNormalizedState(normalized);
		else {
			initialization = normalized;
			makeDefaultState();
		}
	} else if (Array.isArray(initialDocuments) && initialDocuments.length) {
		const ids = [];
		for (const item of initialDocuments) {
			const normalized = normalizePaintDocumentRecord(item);
			if (!normalized.ok || state.documents.has(normalized.document.id) || state.documents.size >= documentLimit) {
				initialization = failure(SESSION_ERROR_CODES.invalidState, 'Initial documents could not be restored safely.');
				state = makeEmptyState();
				break;
			}
			state.documents.set(normalized.document.id, normalized.document);
			ids.push(normalized.document.id);
		}
		if (state.documents.size) {
			state.tabOrder = ids;
			state.activeDocumentId = ids[0];
			state.panes[SESSION_PANES.primary] = ids[0];
		} else makeDefaultState();
	} else makeDefaultState();

	const snapshot = () => stateSnapshot(state, {
		maxDocuments: documentLimit,
		maxRecentlyClosed: closedLimit,
		disposed,
	});

	const notify = (type) => {
		if (disposed) return;
		const event = Object.freeze({ type, state: snapshot() });
		[...listeners].forEach((listener) => {
			try { listener(event); } catch {}
		});
	};

	const unavailable = () => failure(SESSION_ERROR_CODES.disposed, 'Session service has been disposed.');
	const ensureLive = () => !disposed;
	const getDocument = (id) => {
		const document = state.documents.get(id);
		return document ? cloneDocument(document) : null;
	};

	const addDocument = (document, { activate = true, pane = state.activePane } = {}) => {
		if (!ensureLive()) return unavailable();
		if (!validPane(pane)) return failure(SESSION_ERROR_CODES.invalidPane, 'Choose a valid workspace pane.');
		if (state.documents.size >= documentLimit) return failure(SESSION_ERROR_CODES.documentLimit, `Only ${documentLimit} documents can be open at once.`);
		const normalized = normalizePaintDocumentRecord(document);
		if (!normalized.ok) return normalized;
		if (state.documents.has(normalized.document.id)) return failure(SESSION_ERROR_CODES.duplicateDocument, 'A document with this ID is already open.');
		state.documents.set(normalized.document.id, normalized.document);
		state.tabOrder.push(normalized.document.id);
		if (activate) {
			state.activePane = pane;
			state.activeDocumentId = normalized.document.id;
			state.panes[pane] = normalized.document.id;
		}
		notify('document-added');
		return success({ document: cloneDocument(normalized.document), state: snapshot() });
	};

	const createDocument = (options = {}) => {
		if (!ensureLive()) return unavailable();
		if (state.documents.size >= documentLimit) return failure(SESSION_ERROR_CODES.documentLimit, `Only ${documentLimit} documents can be open at once.`);
		const width = options.width ?? 800;
		const height = options.height ?? 600;
		const metadata = isPlainObject(options.metadata) ? options.metadata : {};
		return addDocument(createPaintDocument({ id: options.id, width, height, metadata }), options);
	};

	const setActiveDocument = (id, { pane = state.activePane } = {}) => {
		if (!ensureLive()) return unavailable();
		if (!validPane(pane)) return failure(SESSION_ERROR_CODES.invalidPane, 'Choose a valid workspace pane.');
		if (!state.documents.has(id)) return failure(SESSION_ERROR_CODES.documentMissing, 'The selected document is no longer open.');
		state.activePane = pane;
		state.activeDocumentId = id;
		state.panes[pane] = id;
		notify('active-document-changed');
		return success({ state: snapshot() });
	};

	const setActivePane = (pane) => {
		if (!ensureLive()) return unavailable();
		if (!validPane(pane)) return failure(SESSION_ERROR_CODES.invalidPane, 'Choose a valid workspace pane.');
		state.activePane = pane;
		const paneDocument = state.panes[pane];
		if (paneDocument && state.documents.has(paneDocument)) state.activeDocumentId = paneDocument;
		notify('active-pane-changed');
		return success({ state: snapshot() });
	};

	const setPaneDocument = (pane, id = null) => {
		if (!ensureLive()) return unavailable();
		if (!validPane(pane)) return failure(SESSION_ERROR_CODES.invalidPane, 'Choose a valid workspace pane.');
		if (id !== null && !state.documents.has(id)) return failure(SESSION_ERROR_CODES.documentMissing, 'The selected document is no longer open.');
		if (pane === SESSION_PANES.primary && id === null) return failure(SESSION_ERROR_CODES.invalidPane, 'The primary pane must always show an open document.');
		state.panes[pane] = id;
		if (pane === state.activePane && id) state.activeDocumentId = id;
		notify('pane-document-changed');
		return success({ state: snapshot() });
	};

	const markDirty = (id, dirty = true) => {
		if (!ensureLive()) return unavailable();
		const document = state.documents.get(id);
		if (!document) return failure(SESSION_ERROR_CODES.documentMissing, 'The selected document is no longer open.');
		document.dirty = Boolean(dirty);
		notify('document-dirty-changed');
		return success({ document: cloneDocument(document), state: snapshot() });
	};

	const updateDocument = (id, patch = {}, { markDirty: shouldMarkDirty = true } = {}) => {
		if (!ensureLive()) return unavailable();
		const current = state.documents.get(id);
		if (!current) return failure(SESSION_ERROR_CODES.documentMissing, 'The selected document is no longer open.');
		if (!isObject(patch) || ('id' in patch && patch.id !== id) || ('schemaVersion' in patch && patch.schemaVersion !== current.schemaVersion)) {
			return failure(SESSION_ERROR_CODES.invalidDocument, 'Document identity cannot be changed by an update.');
		}
		const candidate = {
			...current,
			...patch,
			id,
			pixels: patch.pixels ? { ...current.pixels, ...patch.pixels } : current.pixels,
			metadata: patch.metadata ? { ...current.metadata, ...patch.metadata } : current.metadata,
			dirty: patch.dirty ?? (shouldMarkDirty ? true : current.dirty),
		};
		const normalized = normalizePaintDocumentRecord(candidate);
		if (!normalized.ok) return normalized;
		state.documents.set(id, normalized.document);
		notify('document-updated');
		return success({ document: cloneDocument(normalized.document), state: snapshot() });
	};

	const closeDocument = (id = state.activeDocumentId) => {
		if (!ensureLive()) return unavailable();
		if (!state.documents.has(id)) return failure(SESSION_ERROR_CODES.documentMissing, 'The selected document is no longer open.');
		if (state.documents.size <= 1) return failure(SESSION_ERROR_CODES.lastDocument, 'Keep at least one document open.');
		const before = {
			activeDocumentId: state.activeDocumentId,
			activePane: state.activePane,
			panes: { ...state.panes },
		};
		const index = state.tabOrder.indexOf(id);
		const document = state.documents.get(id);
		const fallback = state.tabOrder[index + 1] || state.tabOrder[index - 1] || null;
		state.documents.delete(id);
		state.tabOrder.splice(index, 1);
		Object.keys(state.panes).forEach((pane) => {
			if (state.panes[pane] === id) state.panes[pane] = pane === SESSION_PANES.primary ? fallback : null;
		});
		if (state.activeDocumentId === id) state.activeDocumentId = state.panes[state.activePane] || fallback;
		state.closed.push({ document: cloneDocument(document), index, before });
		while (state.closed.length > closedLimit) state.closed.shift();
		notify('document-closed');
		return success({ document: cloneDocument(document), state: snapshot() });
	};

	const undoClose = () => {
		if (!ensureLive()) return unavailable();
		const closed = state.closed[state.closed.length - 1];
		if (!closed) return failure(SESSION_ERROR_CODES.nothingToUndoClose, 'There is no recently closed document to restore.');
		if (state.documents.size >= documentLimit) return failure(SESSION_ERROR_CODES.documentLimit, `Only ${documentLimit} documents can be open at once.`);
		if (state.documents.has(closed.document.id)) return failure(SESSION_ERROR_CODES.closedDocumentConflict, 'The recently closed document ID is already in use.');
		state.closed.pop();
		state.documents.set(closed.document.id, cloneDocument(closed.document));
		state.tabOrder.splice(Math.max(0, Math.min(closed.index, state.tabOrder.length)), 0, closed.document.id);
		const fallback = state.tabOrder[0];
		state.activePane = validPane(closed.before.activePane) ? closed.before.activePane : SESSION_PANES.primary;
		Object.values(SESSION_PANES).forEach((pane) => {
			const desired = closed.before.panes[pane];
			state.panes[pane] = state.documents.has(desired) ? desired : (pane === SESSION_PANES.primary ? fallback : null);
		});
		state.activeDocumentId = state.documents.has(closed.before.activeDocumentId)
			? closed.before.activeDocumentId
			: (state.panes[state.activePane] || fallback);
		notify('document-reopened');
		return success({ document: cloneDocument(closed.document), state: snapshot() });
	};

	const restore = (nextState) => {
		if (!ensureLive()) return unavailable();
		const normalized = normalizeSessionState(nextState, { maxDocuments: documentLimit });
		if (!normalized.ok) return normalized;
		applyNormalizedState(normalized);
		notify('session-restored');
		return success({ state: snapshot() });
	};

	const subscribe = (listener) => {
		if (disposed || typeof listener !== 'function') return () => {};
		listeners.add(listener);
		return () => listeners.delete(listener);
	};

	const dispose = () => {
		if (disposed) return false;
		disposed = true;
		listeners.clear();
		state = makeEmptyState();
		return true;
	};

	return Object.freeze({
		getState: snapshot,
		getRecoveryState: snapshot,
		getDocument,
		getInitializationResult: () => initialization,
		createDocument,
		addDocument,
		setActiveDocument,
		setActivePane,
		setPaneDocument,
		markDirty,
		updateDocument,
		closeDocument,
		undoClose,
		restore,
		subscribe,
		dispose,
		getDiagnostics: () => Object.freeze({ listenerCount: listeners.size, disposed }),
	});
};
