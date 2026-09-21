// The working canvas is deliberately stored separately from history. This
// module owns the IndexedDB record shape and turns browser storage failures
// into explicit results so the UI can offer recovery instead of pretending an
// autosave succeeded.

import { EVENTS, LIMITS, SCHEMA_VERSIONS } from './core/constants.js';
import { assessImageAdmission } from './storage/ImageAdmission.js';

export const WORKSPACE_DATABASE_NAME = 'paint-workspace';
export const WORKSPACE_STORE_NAME = 'documents';
export const WORKING_CANVAS_KEY = 'last-canvas';
export const LEGACY_WORKING_CANVAS_KEY = 'omerpaint:last-canvas';
export const WORKING_CANVAS_MAX_AGE_MS = 24 * 60 * 60 * 1000;
export const WORKING_CANVAS_SCHEMA_VERSION = SCHEMA_VERSIONS.workingCanvas;
// PNG encoding briefly owns an additional full-image surface. Keep automatic
// recovery below the 64 MiB RGBA boundary; the editor can still display a
// larger admitted image and the user can explicitly download/save it.
export const WORKING_CANVAS_MAX_AUTOSAVE_PIXELS = 16 * 1024 * 1024;

export const STORAGE_FAILURE_KINDS = Object.freeze({
	quota: 'quota',
	blocked: 'blocked',
	unavailable: 'unavailable',
	database: 'database',
	encode: 'encode',
	corrupt: 'corrupt',
	unknown: 'unknown',
});

const isImageBlob = (value) => {
	if (typeof Blob === 'undefined' || !(value instanceof Blob) || value.size <= 0) return false;
	return value.type === 'image/png';
};

const storageMessage = (kind) => ({
	[STORAGE_FAILURE_KINDS.quota]: 'Autosave storage is full. Your image is still open.',
	[STORAGE_FAILURE_KINDS.blocked]: 'Autosave is blocked. Close other Paint tabs and try again.',
	[STORAGE_FAILURE_KINDS.unavailable]: 'Autosave is unavailable in this browser session.',
	[STORAGE_FAILURE_KINDS.database]: 'Autosave could not open. Your image is still open.',
	[STORAGE_FAILURE_KINDS.encode]: 'This image could not be prepared for autosave.',
	[STORAGE_FAILURE_KINDS.corrupt]: 'Saved recovery data is damaged. Your open image is still safe.',
	[STORAGE_FAILURE_KINDS.unknown]: 'Autosave could not finish. Your image is still open.',
}[kind] || 'Autosave could not finish. Your image is still open.');

export const classifyStorageError = (error, phase = 'unknown') => {
	const name = String(error?.name || '').toLowerCase();
	const message = String(error?.message || '').toLowerCase();
	let kind = STORAGE_FAILURE_KINDS.unknown;
	if (phase === 'encode') kind = STORAGE_FAILURE_KINDS.encode;
	else if (name.includes('quota') || message.includes('quota') || message.includes('storage full')) kind = STORAGE_FAILURE_KINDS.quota;
	else if (name.includes('blocked') || message.includes('blocked') || message.includes('versionchange')) kind = STORAGE_FAILURE_KINDS.blocked;
	else if (name.includes('security') || name.includes('notallowed') || message.includes('unavailable')) kind = STORAGE_FAILURE_KINDS.unavailable;
	else if (phase === 'open' || phase === 'read' || phase === 'write' || name.includes('database') || name.includes('invalidstate')) kind = STORAGE_FAILURE_KINDS.database;
	return { kind, phase, error, message: storageMessage(kind) };
};

const failure = (error, phase, extra = {}) => ({
	ok: false,
	failure: classifyStorageError(error, phase),
	...extra,
});

const success = (extra = {}) => ({ ok: true, ...extra });

const largeCanvasAutosaveFailure = (width, height) => {
	const error = new Error('Canvas exceeds the automatic recovery size limit');
	return {
		ok: false,
		failure: {
			...classifyStorageError(error, 'encode'),
			message: `Autosave is paused above ${WORKING_CANVAS_MAX_AUTOSAVE_PIXELS.toLocaleString()} pixels. Download or save this large image before closing.`,
			width,
			height,
		},
	};
};

/**
 * Validate both current v1 records and the former unversioned IndexedDB
 * record. A valid v0 record is read once and naturally upgraded by the next
 * successful autosave; malformed data is never rendered or deleted silently.
 */
export const normalizeWorkingRecord = (value, { now = Date.now(), maxAgeMs = Infinity } = {}) => {
	if (!value || typeof value !== 'object') return failure(new Error('Working record is missing'), 'validate');
	const legacy = value.schemaVersion === undefined;
	if (!legacy && value.schemaVersion !== WORKING_CANVAS_SCHEMA_VERSION) {
		return failure(new Error('Unsupported working record version'), 'validate');
	}
	if (!isImageBlob(value.blob)) return failure(new Error('Working record does not contain a PNG Blob'), 'validate');
	const width = value.width;
	const height = value.height;
	const admission = assessImageAdmission({ width, height });
	if (!admission.ok) return failure(new Error(admission.message), 'validate');
	const updatedAt = value.updatedAt;
	if (!Number.isFinite(updatedAt) || updatedAt <= 0 || updatedAt > now + 5 * 60 * 1000) {
		return failure(new Error('Working record has an invalid timestamp'), 'validate');
	}
	if (Number.isFinite(maxAgeMs) && now - updatedAt > maxAgeMs) return success({ record: null, expired: true, legacy });
	return success({
		record: {
			schemaVersion: WORKING_CANVAS_SCHEMA_VERSION,
			kind: 'working-raster',
			blob: value.blob,
			width,
			height,
			updatedAt,
		},
		legacy,
	});
};

const getIndexedDb = (indexedDb = globalThis.indexedDB) => indexedDb || null;

export const openWorkspaceDatabase = ({ indexedDb = getIndexedDb() } = {}) => new Promise((resolve, reject) => {
	if (!indexedDb?.open) {
		reject(new Error('IndexedDB is unavailable'));
		return;
	}
	let request;
	try {
		request = indexedDb.open(WORKSPACE_DATABASE_NAME, 1);
	} catch (error) {
		reject(error);
		return;
	}
	request.onupgradeneeded = () => {
		const database = request.result;
		if (!database.objectStoreNames.contains(WORKSPACE_STORE_NAME)) database.createObjectStore(WORKSPACE_STORE_NAME);
	};
	request.onblocked = () => {
		const error = typeof DOMException === 'function'
			? new DOMException('IndexedDB open is blocked', 'BlockedError')
			: Object.assign(new Error('IndexedDB open is blocked'), { name: 'BlockedError' });
		reject(error);
	};
	request.onerror = () => reject(request.error || new Error('Unable to open IndexedDB'));
	request.onsuccess = () => {
		const database = request.result;
		database.onversionchange = () => database.close();
		resolve(database);
	};
});

const requestTransaction = async (mode, operation, { indexedDb } = {}) => {
	let database;
	try {
		database = await openWorkspaceDatabase({ indexedDb });
	} catch (error) {
		throw Object.assign(error instanceof Error ? error : new Error(String(error)), { storagePhase: 'open' });
	}
	return new Promise((resolve, reject) => {
		let request;
		let requestResult;
		let settled = false;
		const finish = (callback, value) => {
			if (settled) return;
			settled = true;
			database.close();
			callback(value);
		};
		try {
			const transaction = database.transaction(WORKSPACE_STORE_NAME, mode);
			const store = transaction.objectStore(WORKSPACE_STORE_NAME);
			request = operation(store);
			request.onsuccess = () => { requestResult = request.result; };
			request.onerror = () => finish(reject, Object.assign(request.error || new Error('IndexedDB request failed'), { storagePhase: mode === 'readonly' ? 'read' : 'write' }));
			transaction.oncomplete = () => finish(resolve, requestResult);
			transaction.onerror = () => finish(reject, Object.assign(transaction.error || new Error('IndexedDB transaction failed'), { storagePhase: mode === 'readonly' ? 'read' : 'write' }));
			transaction.onabort = () => finish(reject, Object.assign(transaction.error || new Error('IndexedDB transaction aborted'), { storagePhase: mode === 'readonly' ? 'read' : 'write' }));
		} catch (error) {
			finish(reject, Object.assign(error instanceof Error ? error : new Error(String(error)), { storagePhase: mode === 'readonly' ? 'read' : 'write' }));
		}
	});
};

const blobFromCanvas = (canvas) => new Promise((resolve, reject) => {
	if (!canvas?.toBlob) {
		reject(new Error('Canvas encoding is unavailable'));
		return;
	}
	try {
		canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Canvas encoding failed')), 'image/png');
	} catch (error) {
		reject(error);
	}
});

const resolveBlob = async ({ canvas, getBlob }) => {
	const blob = getBlob ? await getBlob() : await blobFromCanvas(canvas);
	if (!isImageBlob(blob)) throw new Error('Canvas encoding did not produce a PNG Blob');
	return blob;
};

export const saveCanvasState = async ({ canvas = null, getBlob = null, metadata = {}, indexedDb } = {}) => {
	try {
		const width = Number(metadata.width ?? canvas?.width);
		const height = Number(metadata.height ?? canvas?.height);
		const admission = assessImageAdmission({ width, height });
		if (!admission.ok) return failure(new Error(admission.message), 'encode');
		if (width * height > WORKING_CANVAS_MAX_AUTOSAVE_PIXELS) return largeCanvasAutosaveFailure(width, height);
		const blob = await resolveBlob({ canvas, getBlob });
		const record = {
			schemaVersion: WORKING_CANVAS_SCHEMA_VERSION,
			kind: 'working-raster',
			blob,
			width,
			height,
			updatedAt: Date.now(),
		};
		await requestTransaction('readwrite', (store) => store.put(record, WORKING_CANVAS_KEY), { indexedDb });
		return success({ record });
	} catch (error) {
		return failure(error, error?.storagePhase || 'encode');
	}
};

export const loadCanvasState = async ({ maxAgeMs = WORKING_CANVAS_MAX_AGE_MS, indexedDb, now = Date.now() } = {}) => {
	try {
		const record = await requestTransaction('readonly', (store) => store.get(WORKING_CANVAS_KEY), { indexedDb });
		if (!record) return success({ record: null, legacy: false, expired: false });
		const normalized = normalizeWorkingRecord(record, { now, maxAgeMs });
		if (!normalized.ok) {
			return {
				...normalized,
				failure: { ...normalized.failure, kind: STORAGE_FAILURE_KINDS.corrupt, message: storageMessage(STORAGE_FAILURE_KINDS.corrupt) },
			};
		}
		return normalized;
	} catch (error) {
		return failure(error, error?.storagePhase || 'read');
	}
};

export const clearCanvasState = async ({ indexedDb } = {}) => {
	try {
		await requestTransaction('readwrite', (store) => store.delete(WORKING_CANVAS_KEY), { indexedDb });
		return success();
	} catch (error) {
		return failure(error, error?.storagePhase || 'write');
	}
};

const dispatchStorageFailure = ({ eventBus, eventTarget, result }) => {
	if (result?.ok) return;
	eventBus?.emit?.(EVENTS.storageError, result.failure);
	if (eventTarget?.dispatchEvent && typeof CustomEvent !== 'undefined') {
		eventTarget.dispatchEvent(new CustomEvent(EVENTS.storageError, { detail: result.failure }));
	}
};

/**
 * Debounced, serial autosave. One save runs at a time so an older async PNG
 * encode can never finish after a newer write; changes arriving during a save
 * trigger one final latest-state write.
 */
export const installCanvasAutosave = ({
	canvas = null,
	getBlob = null,
	getMetadata = null,
	eventTarget = globalThis.window,
	eventBus = null,
	debounceMs = 700,
	onResult = null,
	onError = null,
	save = saveCanvasState,
} = {}) => {
	if (!eventBus?.on && (!eventTarget?.addEventListener || !eventTarget?.removeEventListener)) {
		const noop = () => {};
		noop.flush = async () => success({ skipped: true });
		// A caller without an event source cannot know whether the visible
		// document was persisted. Be conservative: update/reload flows must not
		// treat a missing autosave controller as a durable save.
		noop.getState = () => Object.freeze({
			dirty: true,
			pending: false,
			saving: false,
			failed: false,
			safeToReload: false,
			reason: 'autosave-unavailable',
		});
		noop.isSafeToReload = () => false;
		noop.prepareForReload = async () => ({
			ok: false,
			reason: 'autosave-unavailable',
			state: noop.getState(),
		});
		return noop;
	}
	const setTimer = globalThis.setTimeout?.bind(globalThis) || setTimeout;
	const clearTimer = globalThis.clearTimeout?.bind(globalThis) || clearTimeout;
	let timer = null;
	let running = false;
	let changed = 0;
	let durableRevision = 0;
	let runningRevision = 0;
	let failedRevision = null;
	let lastFailure = null;
	let disposed = false;
	let activeSave = Promise.resolve(success({ skipped: true }));

	/*
	 * `changed` advances synchronously at the same mutation boundary used by
	 * CanvasManager. A revision is durable only after its IndexedDB write
	 * resolves successfully. This small state contract deliberately lives next
	 * to the serial save queue so reload/update code does not guess from timers
	 * or a visual "saved" label.
	 */
	const getState = () => {
		const dirty = changed !== durableRevision;
		const failed = dirty && failedRevision === changed;
		const pending = timer !== null;
		const saving = running;
		const reason = disposed
			? 'autosave-unavailable'
			: failed
				? 'autosave-failed'
				: saving
					? 'autosave-saving'
					: pending || dirty
						? 'autosave-pending'
						: null;
		return Object.freeze({
			dirty,
			pending,
			saving,
			failed,
			safeToReload: !disposed && !dirty && !pending && !saving,
			reason,
			revision: changed,
			durableRevision,
		});
	};
	const isSafeToReload = () => getState().safeToReload;

	const report = (result) => {
		if (disposed) return;
		onResult?.(result);
		if (!result.ok) {
			dispatchStorageFailure({ eventBus, eventTarget, result });
			onError?.(result.failure);
		}
	};

	const run = () => {
		if (disposed) return Promise.resolve(success({ skipped: true }));
		if (running) return activeSave;
		if (changed === durableRevision) return Promise.resolve(success({ skipped: true }));
		running = true;
		runningRevision = changed;
		const metadata = getMetadata?.() || { width: canvas?.width, height: canvas?.height };
		activeSave = Promise.resolve(save({ canvas, getBlob, metadata }))
			.catch((error) => failure(error, error?.storagePhase || 'encode'))
			.then((result) => {
				running = false;
				if (result.ok) durableRevision = Math.max(durableRevision, runningRevision);
				else {
					failedRevision = runningRevision;
					lastFailure = result.failure;
				}
				if (runningRevision === changed) report(result);
				if (!disposed && runningRevision !== changed) return run();
				return result;
			});
		return activeSave;
	};

	const schedule = () => {
		if (disposed) return;
		changed += 1;
		if (timer !== null) clearTimer(timer);
		timer = setTimer(() => {
			timer = null;
			void run();
		}, debounceMs);
	};
	const unsubscribe = eventBus?.on?.(EVENTS.documentChanged, schedule) || null;
	if (!unsubscribe) eventTarget.addEventListener('paint:changed', schedule);

	const dispose = () => {
		disposed = true;
		if (timer !== null) clearTimer(timer);
		timer = null;
		if (unsubscribe) unsubscribe();
		else eventTarget.removeEventListener('paint:changed', schedule);
	};
	dispose.flush = () => {
		if (disposed) return Promise.resolve(success({ skipped: true }));
		if (timer !== null) {
			clearTimer(timer);
			timer = null;
		}
		return run();
	};
	// Resolve pending debounce/running work before a controlled reload. A known
	// failed write intentionally remains blocked: silently retrying during an
	// update would make a storage/quota problem look safe when it is not.
	dispose.prepareForReload = async () => {
		const before = getState();
		if (before.safeToReload) return success({ skipped: true, state: before });
		if (before.reason === 'autosave-unavailable' || before.reason === 'autosave-failed') {
			return { ok: false, reason: before.reason, failure: lastFailure, state: before };
		}
		const result = await dispose.flush();
		const after = getState();
		if (after.safeToReload) return success({ state: after });
		return {
			ok: false,
			reason: after.reason || 'autosave-pending',
			failure: after.failed ? lastFailure : result?.failure,
			state: after,
		};
	};
	dispose.getState = getState;
	dispose.isSafeToReload = isSafeToReload;
	dispose.schedule = schedule;
	return dispose;
};

export const getWorkingCanvasLimits = () => ({
	maxDimension: LIMITS.maxCanvasDimension,
	maxPixels: LIMITS.maxImportPixels,
	maxAutosavePixels: WORKING_CANVAS_MAX_AUTOSAVE_PIXELS,
});
