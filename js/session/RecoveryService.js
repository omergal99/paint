// Crash/reload recovery contract for the future workspace. This module only
// reads and writes a supplied key-value adapter; raster payloads and IndexedDB
// ownership remain outside this seam.

import {
	MAX_SESSION_DOCUMENTS,
	SESSION_SCHEMA_VERSION,
	normalizeSessionState,
} from './SessionService.js';

export const RECOVERY_SCHEMA_VERSION = 1;
export const DEFAULT_RECOVERY_TTL_MS = 24 * 60 * 60 * 1000;
export const MAX_RECOVERY_SNAPSHOT_BYTES = 256 * 1024;
export const RECOVERY_STORAGE_KEYS = Object.freeze({
	snapshot: 'paint:workspace-recovery',
	crashFlag: 'paint:workspace-crash-flag',
});

export const RECOVERY_CLASSIFICATIONS = Object.freeze({
	none: 'none',
	clean: 'clean',
	recoverable: 'recoverable',
	missing: 'missing',
	expired: 'expired',
	malformed: 'malformed',
	unavailable: 'unavailable',
});

export const RECOVERY_ERROR_CODES = Object.freeze({
	disposed: 'disposed',
	storageUnavailable: 'storage-unavailable',
	storageReadFailed: 'storage-read-failed',
	storageWriteFailed: 'storage-write-failed',
	storageRemoveFailed: 'storage-remove-failed',
	invalidSnapshot: 'invalid-snapshot',
	snapshotTooLarge: 'snapshot-too-large',
});

const isObject = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const finitePositive = (value, fallback) => Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
const documentLimit = (value) => Math.min(MAX_SESSION_DOCUMENTS, finitePositive(value, MAX_SESSION_DOCUMENTS));
const snapshotError = (code, message) => Object.freeze({ code, message });
const failure = (code, message, extra = {}) => ({ ok: false, error: snapshotError(code, message), ...extra });
const success = (extra = {}) => ({ ok: true, ...extra });

const safeJsonCopy = (value, fallback) => {
	try { return JSON.parse(JSON.stringify(value)); } catch { return fallback; }
};

const byteLength = (value) => {
	if (typeof TextEncoder === 'function') return new TextEncoder().encode(value).byteLength;
	return unescape(encodeURIComponent(value)).length;
};

// Recovery intentionally persists a small document shell, not canvas pixels or
// undo payloads. Per-document raster storage will be wired in a later slice.
const serializableSession = (state) => ({
	schemaVersion: SESSION_SCHEMA_VERSION,
	documents: state.documents.map((document) => ({
		schemaVersion: document.schemaVersion,
		id: document.id,
		pixels: { width: document.pixels.width, height: document.pixels.height },
		selection: safeJsonCopy(document.selection, null),
		textObjects: safeJsonCopy(document.textObjects, []),
		history: { undo: [], redo: [] },
		dirty: Boolean(document.dirty),
		metadata: safeJsonCopy(document.metadata, {}),
	})),
	tabOrder: [...state.tabOrder],
	activeDocumentId: state.activeDocumentId,
	activePane: state.activePane,
	panes: { ...state.panes },
});

const sessionFromNormalizedState = (state) => serializableSession({
	documents: state.tabOrder.map((id) => state.documents.get(id)).filter(Boolean),
	tabOrder: state.tabOrder,
	activeDocumentId: state.activeDocumentId,
	activePane: state.activePane,
	panes: state.panes,
});

/**
 * Makes an intentionally bounded, JSON-only recovery record. It returns a
 * result instead of throwing, so a malformed live snapshot cannot overwrite a
 * previously recoverable record.
 */
export const createRecoverySnapshot = ({
	sessionState,
	now = Date.now(),
	maxDocuments = MAX_SESSION_DOCUMENTS,
	maxBytes = MAX_RECOVERY_SNAPSHOT_BYTES,
} = {}) => {
	const normalized = normalizeSessionState(sessionState, { maxDocuments: documentLimit(maxDocuments) });
	if (!normalized.ok) return failure(RECOVERY_ERROR_CODES.invalidSnapshot, 'Session state cannot be saved for recovery.');
	const record = {
		schemaVersion: RECOVERY_SCHEMA_VERSION,
		kind: 'paint-workspace-shell',
		savedAt: now,
		session: serializableSession(sessionState),
	};
	try {
		const serialized = JSON.stringify(record);
		if (byteLength(serialized) > finitePositive(maxBytes, MAX_RECOVERY_SNAPSHOT_BYTES)) {
			return failure(RECOVERY_ERROR_CODES.snapshotTooLarge, 'Recovery metadata is too large to save safely.');
		}
		return success({ record, serialized });
	} catch {
		return failure(RECOVERY_ERROR_CODES.invalidSnapshot, 'Session state cannot be serialized safely.');
	}
};

/**
 * Validates untrusted persisted recovery data. Invalid data is reported but is
 * never deleted here; the caller must explicitly invoke discardRecovery().
 */
export const normalizeRecoverySnapshot = (value, {
	now = Date.now(),
	ttlMs = DEFAULT_RECOVERY_TTL_MS,
	maxDocuments = MAX_SESSION_DOCUMENTS,
} = {}) => {
	if (!isObject(value) || value.schemaVersion !== RECOVERY_SCHEMA_VERSION || value.kind !== 'paint-workspace-shell') {
		return failure(RECOVERY_ERROR_CODES.invalidSnapshot, 'Recovery data does not match the expected schema.');
	}
	const savedAt = Number(value.savedAt);
	if (!Number.isFinite(savedAt) || savedAt <= 0 || savedAt > now + 5 * 60 * 1000) {
		return failure(RECOVERY_ERROR_CODES.invalidSnapshot, 'Recovery data has an invalid timestamp.');
	}
	const normalizedSession = normalizeSessionState(value.session, { maxDocuments: documentLimit(maxDocuments) });
	if (!normalizedSession.ok) return failure(RECOVERY_ERROR_CODES.invalidSnapshot, 'Recovery session data is malformed.');
	const boundedTtl = finitePositive(ttlMs, DEFAULT_RECOVERY_TTL_MS);
	if (now - savedAt > boundedTtl) return success({ expired: true, record: null, session: null, savedAt });
	return success({
		expired: false,
		record: {
			schemaVersion: RECOVERY_SCHEMA_VERSION,
			kind: 'paint-workspace-shell',
			savedAt,
			session: sessionFromNormalizedState(normalizedSession.state),
		},
		session: sessionFromNormalizedState(normalizedSession.state),
		savedAt,
	});
};

const validCrashFlag = (value, { now }) => Boolean(
	isObject(value)
	&& value.schemaVersion === RECOVERY_SCHEMA_VERSION
	&& value.kind === 'paint-workspace-crash-flag'
	&& Number.isFinite(Number(value.armedAt))
	&& Number(value.armedAt) > 0
	&& Number(value.armedAt) <= now + 5 * 60 * 1000,
);

/** Classifies a parsed snapshot without performing storage I/O. */
export const classifyRecovery = ({
	crashFlag = null,
	snapshot = null,
	now = Date.now(),
	ttlMs = DEFAULT_RECOVERY_TTL_MS,
	maxDocuments = MAX_SESSION_DOCUMENTS,
} = {}) => {
	if (crashFlag === 'malformed' || snapshot === 'malformed') {
		return Object.freeze({ classification: RECOVERY_CLASSIFICATIONS.malformed, session: null });
	}
	if (crashFlag && !validCrashFlag(crashFlag, { now })) {
		return Object.freeze({ classification: RECOVERY_CLASSIFICATIONS.malformed, session: null });
	}
	const crashed = Boolean(crashFlag);
	if (!snapshot) {
		return Object.freeze({
			classification: crashed ? RECOVERY_CLASSIFICATIONS.missing : RECOVERY_CLASSIFICATIONS.none,
			session: null,
		});
	}
	const normalized = normalizeRecoverySnapshot(snapshot, { now, ttlMs, maxDocuments });
	if (!normalized.ok) return Object.freeze({ classification: RECOVERY_CLASSIFICATIONS.malformed, session: null });
	if (normalized.expired) return Object.freeze({ classification: RECOVERY_CLASSIFICATIONS.expired, session: null, savedAt: normalized.savedAt });
	return Object.freeze({
		classification: crashed ? RECOVERY_CLASSIFICATIONS.recoverable : RECOVERY_CLASSIFICATIONS.clean,
		session: normalized.session,
		savedAt: normalized.savedAt,
	});
};

const parseStoredJson = (storage, key) => {
	if (!storage?.getItem) return failure(RECOVERY_ERROR_CODES.storageUnavailable, 'Recovery storage is unavailable.');
	let raw;
	try {
		raw = storage.getItem(key);
	} catch {
		return failure(RECOVERY_ERROR_CODES.storageReadFailed, 'Recovery data could not be read.');
	}
	if (raw === null || raw === undefined || raw === '') return success({ value: null });
	try {
		return success({ value: JSON.parse(raw) });
	} catch {
		return success({ malformed: true, value: null });
	}
};

const writeStoredJson = (storage, key, value) => {
	if (!storage?.setItem) return failure(RECOVERY_ERROR_CODES.storageUnavailable, 'Recovery storage is unavailable.');
	try {
		storage.setItem(key, JSON.stringify(value));
		return success();
	} catch {
		return failure(RECOVERY_ERROR_CODES.storageWriteFailed, 'Recovery data could not be written.');
	}
};

const removeStoredValue = (storage, key) => {
	if (!storage?.removeItem) return failure(RECOVERY_ERROR_CODES.storageUnavailable, 'Recovery storage is unavailable.');
	try {
		storage.removeItem(key);
		return success();
	} catch {
		return failure(RECOVERY_ERROR_CODES.storageRemoveFailed, 'Recovery data could not be removed.');
	}
};

/**
 * Storage adapter lifecycle:
 * - `inspect()` is read-only and never removes malformed/expired data.
 * - `begin()` inspects the previous run, then arms this run's crash flag.
 * - `markCleanExit()` disarms it; `discardRecovery()` is the only delete path.
 */
export const createRecoveryService = ({
	storage = null,
	keys = RECOVERY_STORAGE_KEYS,
	now = () => Date.now(),
	ttlMs = DEFAULT_RECOVERY_TTL_MS,
	maxDocuments = MAX_SESSION_DOCUMENTS,
	maxBytes = MAX_RECOVERY_SNAPSHOT_BYTES,
} = {}) => {
	const activeKeys = Object.freeze({
		snapshot: keys?.snapshot || RECOVERY_STORAGE_KEYS.snapshot,
		crashFlag: keys?.crashFlag || RECOVERY_STORAGE_KEYS.crashFlag,
	});
	const limits = Object.freeze({
		ttlMs: finitePositive(ttlMs, DEFAULT_RECOVERY_TTL_MS),
		maxDocuments: documentLimit(maxDocuments),
		maxBytes: finitePositive(maxBytes, MAX_RECOVERY_SNAPSHOT_BYTES),
	});
	let disposed = false;
	const unavailable = () => failure(RECOVERY_ERROR_CODES.disposed, 'Recovery service has been disposed.');

	const inspect = () => {
		if (disposed) return unavailable();
		const flagRead = parseStoredJson(storage, activeKeys.crashFlag);
		const snapshotRead = parseStoredJson(storage, activeKeys.snapshot);
		if (!flagRead.ok || !snapshotRead.ok) {
			return Object.freeze({
				ok: false,
				classification: RECOVERY_CLASSIFICATIONS.unavailable,
				error: (flagRead.error || snapshotRead.error),
			});
		}
		const timestamp = now();
		const flag = flagRead.malformed ? 'malformed' : (validCrashFlag(flagRead.value, { now: timestamp }) ? flagRead.value : null);
		const snapshot = snapshotRead.malformed ? 'malformed' : snapshotRead.value;
		const classified = classifyRecovery({
			crashFlag: flag,
			snapshot,
			now: timestamp,
			ttlMs: limits.ttlMs,
			maxDocuments: limits.maxDocuments,
		});
		return Object.freeze({ ok: true, ...classified });
	};

	const armCrashFlag = () => {
		if (disposed) return unavailable();
		return writeStoredJson(storage, activeKeys.crashFlag, {
			schemaVersion: RECOVERY_SCHEMA_VERSION,
			kind: 'paint-workspace-crash-flag',
			armedAt: now(),
		});
	};

	const begin = () => {
		const prior = inspect();
		if (!prior.ok) return prior;
		const armed = armCrashFlag();
		return Object.freeze({ ...prior, armed: armed.ok, armError: armed.ok ? null : armed.error });
	};

	const saveSnapshot = (sessionState) => {
		if (disposed) return unavailable();
		const created = createRecoverySnapshot({
			sessionState,
			now: now(),
			maxDocuments: limits.maxDocuments,
			maxBytes: limits.maxBytes,
		});
		if (!created.ok) return created;
		const written = writeStoredJson(storage, activeKeys.snapshot, created.record);
		return written.ok ? success({ record: created.record }) : written;
	};

	const markCleanExit = ({ discardSnapshot = false } = {}) => {
		if (disposed) return unavailable();
		const disarmed = removeStoredValue(storage, activeKeys.crashFlag);
		if (!disarmed.ok) return disarmed;
		if (!discardSnapshot) return success();
		return removeStoredValue(storage, activeKeys.snapshot);
	};

	const discardRecovery = () => {
		if (disposed) return unavailable();
		const snapshotRemoved = removeStoredValue(storage, activeKeys.snapshot);
		const flagRemoved = removeStoredValue(storage, activeKeys.crashFlag);
		if (!snapshotRemoved.ok) return snapshotRemoved;
		if (!flagRemoved.ok) return flagRemoved;
		return success();
	};

	const dispose = () => {
		if (disposed) return false;
		disposed = true;
		return true;
	};

	return Object.freeze({
		inspect,
		begin,
		armCrashFlag,
		saveSnapshot,
		markCleanExit,
		discardRecovery,
		dispose,
		getDiagnostics: () => Object.freeze({ listenerCount: 0, disposed }),
		getKeys: () => activeKeys,
		getLimits: () => limits,
	});
};
