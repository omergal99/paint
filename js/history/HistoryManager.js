// js/history/HistoryManager.js
// Snapshot-based undo/redo. Full-resolution entries are encoded as PNG Blobs
// at the mutation boundary, then exposed to older UI code through an owned
// object URL in `dataUrl`. This keeps the public session-entry shape stable
// without retaining base64 strings for every undo step.

import { estimateHistoryEntryBytes, summarizeHistoryMemory } from '../storage/MemoryBudget.js';

export const MAX_HISTORY = 20;
export const MAX_HISTORY_BYTES = 64 * 1024 * 1024;
// PNG encoding needs temporary working memory in addition to the final Blob.
// Keep this below the 32 Mi-pixel import/canvas ceiling so undo never turns a
// valid large document into an avoidable encode-time allocation spike.
export const MAX_HISTORY_SNAPSHOT_PIXELS = 16 * 1024 * 1024;
export const HISTORY_SNAPSHOT_REASONS = Object.freeze({
  invalidDimensions: 'invalid-dimensions',
  tooManyPixels: 'too-many-pixels',
});
const SESSION_BACKUP_KEY = 'paint:session-backup';
// A tiny, valid preview while canvas.toBlob settles. It is deliberately not a
// restore source: a pending entry waits for its original PNG before restoring.
const PENDING_PREVIEW_DATA_URL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';

const isBlobLike = (value) => value
  && typeof value === 'object'
  && Number.isFinite(Number(value.size))
  && Number(value.size) >= 0;

const isInlineDataUrl = (value) => typeof value === 'string' && value.startsWith('data:');

const getSessionStorageSafely = () => {
  try { return globalThis.sessionStorage; } catch { return null; }
}

const canvasDataUrl = (canvasManager) => canvasManager.toDataURL?.('image/png')
  || canvasManager.canvas?.toDataURL?.('image/png');

const readDimension = (primary, fallback) => {
  const value = Number(primary);
  if (Number.isFinite(value)) return value;
  const fallbackValue = Number(fallback);
  return Number.isFinite(fallbackValue) ? fallbackValue : 0;
}

const canvasDimensions = (canvasManager) => ({
  width: readDimension(canvasManager?.width, canvasManager?.canvas?.width),
  height: readDimension(canvasManager?.height, canvasManager?.canvas?.height),
});

export const assessHistorySnapshotAdmission = ({
  width,
  height,
  maxPixels = MAX_HISTORY_SNAPSHOT_PIXELS,
} = {}) => {
  const normalizedWidth = Math.round(Number(width));
  const normalizedHeight = Math.round(Number(height));
  const limit = Math.max(1, Math.floor(Number(maxPixels) || MAX_HISTORY_SNAPSHOT_PIXELS));
  if (!Number.isFinite(normalizedWidth) || !Number.isFinite(normalizedHeight)
    || normalizedWidth < 1 || normalizedHeight < 1) {
    return {
      ok: false,
      reason: HISTORY_SNAPSHOT_REASONS.invalidDimensions,
      message: 'Undo snapshot skipped because the canvas size is invalid.',
      width: normalizedWidth,
      height: normalizedHeight,
      pixels: 0,
      maxPixels: limit,
    };
  }
  const pixels = normalizedWidth * normalizedHeight;
  if (!Number.isSafeInteger(pixels) || pixels > limit) {
    return {
      ok: false,
      reason: HISTORY_SNAPSHOT_REASONS.tooManyPixels,
      message: `Undo snapshot skipped above ${Math.floor(limit / (1024 * 1024))} Mi pixels to protect memory.`,
      width: normalizedWidth,
      height: normalizedHeight,
      pixels,
      maxPixels: limit,
    };
  }
  return {
    ok: true,
    reason: null,
    message: '',
    width: normalizedWidth,
    height: normalizedHeight,
    pixels,
    maxPixels: limit,
  };
}

// Call toBlob immediately. Calling it later in a Promise callback would encode
// pixels after the tool mutation and turn an undo snapshot into the wrong image.
const beginBlobCapture = (canvasManager) => {
  try {
    if (typeof canvasManager?.toBlob === 'function') {
      const result = canvasManager.toBlob('image/png');
      if (isBlobLike(result)) return Promise.resolve(result);
      if (result && typeof result.then === 'function') return Promise.resolve(result);
    }
  } catch {
    // Fall through to the raw canvas API, then to a legacy data URL below.
  }

  const canvas = canvasManager?.canvas;
  if (typeof canvas?.toBlob !== 'function') return null;
  try {
    return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  } catch {
    return null;
  }
}

const blobToDataUrl = (blob) => new Promise((resolve) => {
  try {
    if (typeof FileReader === 'undefined') return resolve(null);
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
  } catch {
    resolve(null);
  }
});

/**
 * The manager keeps snapshot reservation synchronous because every tool calls
 * snapshot immediately before it mutates pixels. Blob encoding itself settles
 * asynchronously, preserving a responsive drawing path.
 */
export class HistoryManager {
  constructor(canvasManager, {
    urlApi = globalThis.URL,
    sessionStorage: sessionStore,
    maxSnapshotPixels = MAX_HISTORY_SNAPSHOT_PIXELS,
  } = {}) {
    this.canvasManager = canvasManager;
    this.undoStack = [];
    this.redoStack = [];
    this._suppressed = false;
    this._idCounter = 0;
    this._sessionBackup = null;
    this._showCurrent = true;
    this._currentEntry = null;
    this._currentSignature = null;
    this._urlApi = urlApi;
    this._sessionStorage = sessionStore === undefined ? getSessionStorageSafely() : sessionStore;
    this.maxSnapshotPixels = Math.max(1, Math.floor(Number(maxSnapshotPixels) || MAX_HISTORY_SNAPSHOT_PIXELS));
    this.lastSnapshotRejection = null;
    this._sessionBackupGeneration = 0;
    this._operationInFlight = false;
    this._operationTail = Promise.resolve();
    this._pendingEntries = new Set();
    this._disposed = false;
    this.onChange = null; // callback(canUndo, canRedo)
    this._restoreSessionBackup();
  }

  _newId(prefix) {
    this._idCounter += 1;
    return `${prefix}-${Date.now().toString(36)}-${this._idCounter}`;
  }

  _newEntry({ id = this._newId('session'), kind = 'session', label = null } = {}) {
    const { width, height } = canvasDimensions(this.canvasManager);
    return {
      id,
      kind,
      label,
      width,
      height,
      blob: null,
      byteSize: 0,
      // `dataUrl` remains the compatibility field consumed by Sidebar/main.
      // After settlement it contains an object URL, not a base64 PNG string.
      dataUrl: PENDING_PREVIEW_DATA_URL,
      objectUrl: null,
      pending: false,
      failed: false,
      _placeholderPreview: true,
      _ownsObjectUrl: false,
      _released: false,
      ready: Promise.resolve(null),
    };
  }

  _snapshotAdmission() {
    return assessHistorySnapshotAdmission({
      ...canvasDimensions(this.canvasManager),
      maxPixels: this.maxSnapshotPixels,
    });
  }

  _reportSnapshotRejection(admission) {
    this.lastSnapshotRejection = admission;
    try { this.onSnapshotRejected?.(admission); } catch {}
  }

  _isManagedEntry(entry) {
    return this.undoStack.includes(entry)
      || this.redoStack.includes(entry)
      || this._currentEntry === entry;
  }

  _createObjectUrl(entry) {
    if (!entry?.blob || entry.objectUrl || entry._released) return entry?.objectUrl || null;
    try {
      if (typeof this._urlApi?.createObjectURL !== 'function') return null;
      const objectUrl = this._urlApi.createObjectURL(entry.blob);
      if (typeof objectUrl !== 'string' || !objectUrl) return null;
      entry.objectUrl = objectUrl;
      entry.dataUrl = objectUrl;
      entry._placeholderPreview = false;
      entry._ownsObjectUrl = true;
      return objectUrl;
    } catch {
      return null;
    }
  }

  _releaseEntry(entry) {
    if (!entry || entry._released) return;
    entry._released = true;
    if (entry._ownsObjectUrl && entry.objectUrl) {
      try { this._urlApi?.revokeObjectURL?.(entry.objectUrl); } catch {}
    }
    entry.objectUrl = null;
    entry._ownsObjectUrl = false;
    entry.blob = null;
    entry.byteSize = 0;
    entry.dataUrl = null;
    entry._placeholderPreview = false;
  }

  _releaseEntries(entries) {
    entries.forEach((entry) => this._releaseEntry(entry));
  }

  _removeManagedEntry(entry) {
    const remove = (stack) => {
      const index = stack.indexOf(entry);
      if (index < 0) return false;
      stack.splice(index, 1);
      return true;
    };
    const removed = remove(this.undoStack) || remove(this.redoStack);
    if (this._currentEntry === entry) {
      this._currentEntry = null;
      this._currentSignature = null;
      return true;
    }
    return removed;
  }

  _failEntry(entry) {
    if (!entry || entry._released) return null;
    entry.pending = false;
    entry.failed = true;
    const wasManaged = this._removeManagedEntry(entry);
    this._releaseEntry(entry);
    if (wasManaged) {
      this._persistSessionBackup();
      this._notify();
    }
    return null;
  }

  _settleBlob(entry, blob) {
    if (!isBlobLike(blob) || entry?._released || !this._isManagedEntry(entry)) {
      return this._failEntry(entry);
    }
    entry.blob = blob;
    entry.byteSize = Number(blob.size) || 0;
    entry.pending = false;
    entry.failed = false;
    // Browser object URLs are just a display/load handle. The Blob remains the
    // canonical bytes and the URL is revoked by every removal path below.
    this._createObjectUrl(entry);
    const trimmed = this._trimToLimits();
    if ((entry._persistOnSettle && this._isManagedEntry(entry)) || trimmed) this._persistSessionBackup();
    this._notify();
    return entry;
  }

  _captureEntry(options = {}) {
    const entry = this._newEntry(options);
    const admission = this._snapshotAdmission();
    if (!admission.ok) {
      entry.failed = true;
      entry.rejection = admission;
      entry.dataUrl = null;
      entry._placeholderPreview = false;
      entry.ready = Promise.resolve(null);
      if (options.notifyRejected) this._reportSnapshotRejection(admission);
      return entry;
    }
    const pendingBlob = beginBlobCapture(this.canvasManager);
    if (pendingBlob) {
      entry.pending = true;
      this._pendingEntries.add(entry);
      entry.ready = pendingBlob
        .then((blob) => this._settleBlob(entry, blob))
        .catch(() => this._failEntry(entry))
        .finally(() => this._pendingEntries.delete(entry));
      return entry;
    }

    // Compatibility for tiny test doubles and older browser implementations
    // without toBlob. This is intentionally the exception, never the normal
    // browser history path.
    try {
      const dataUrl = canvasDataUrl(this.canvasManager);
      if (!isInlineDataUrl(dataUrl)) throw new Error('Canvas snapshot unavailable');
      entry.dataUrl = dataUrl;
      entry._placeholderPreview = false;
      entry.byteSize = estimateHistoryEntryBytes(entry);
      entry.ready = Promise.resolve(entry);
    } catch {
      entry.failed = true;
      entry.dataUrl = null;
      entry._placeholderPreview = false;
      entry.ready = Promise.resolve(null);
    }
    return entry;
  }

  _clearRedoStack() {
    this._releaseEntries(this.redoStack);
    this.redoStack = [];
  }

  _trimToLimits() {
    let trimmed = false;
    while (this.undoStack.length > MAX_HISTORY) {
      this._releaseEntry(this.undoStack.shift());
      trimmed = true;
    }
    while (this.redoStack.length > MAX_HISTORY) {
      this._releaseEntry(this.redoStack.shift());
      trimmed = true;
    }

    // Enforce the byte cap over both stacks. A single oversize entry is removed
    // too: keeping it would make the advertised budget untrue on low-memory
    // devices. Undo entries are evicted oldest-first, then redo entries.
    while (summarizeHistoryMemory([...this.undoStack, ...this.redoStack]).undoBytes > MAX_HISTORY_BYTES) {
      const victim = this.undoStack.shift() || this.redoStack.shift();
      if (!victim) break;
      this._releaseEntry(victim);
      trimmed = true;
    }
    return trimmed;
  }

  // Session survives refresh (sessionStorage dies only with the browser tab).
  // Store thumbnails only: object URLs and Blobs cannot survive a reload.
  _persistSessionBackup() {
    try {
      const generation = ++this._sessionBackupGeneration;
      const snapshots = this._getSnapshotEntries()
        .filter((entry) => !entry.pending && !entry.failed && !entry._released);
      void makeSessionThumbs(snapshots, 96).then((entries) => {
        if (generation !== this._sessionBackupGeneration) return;
        const serializable = entries
          .filter((entry) => entry && isInlineDataUrl(entry.dataUrl))
          .slice(0, MAX_HISTORY)
          .map((entry) => ({
            id: entry.id,
            kind: 'session',
            label: entry.label,
            width: entry.width,
            height: entry.height,
            dataUrl: entry.dataUrl,
          }));
        try {
          this._sessionStorage?.setItem?.(SESSION_BACKUP_KEY, JSON.stringify(serializable));
        } catch { /* quota/blocked - session simply won't survive refresh */ }
      }).catch(() => {});
    } catch {}
  }

  _restoreSessionBackup() {
    try {
      const raw = this._sessionStorage?.getItem?.(SESSION_BACKUP_KEY);
      if (!raw) return;
      const entries = JSON.parse(raw);
      if (!Array.isArray(entries)) return;
      this._sessionBackup = entries.filter((entry) => entry && isInlineDataUrl(entry.dataUrl)
        && entry.kind !== 'current' && entry.label !== 'Current').map((entry, index) => ({
        ...entry,
        id: entry.id || `session-backup-${index}`,
        kind: 'session',
      }));
    } catch { this._sessionBackup = null; }
  }

  /**
   * Call BEFORE an action mutates the canvas. It synchronously reserves an
   * ordered entry and starts toBlob immediately; encoding settles off the hot
   * path. `force` records a snapshot even if sampled pixels are unchanged.
   */
  snapshot({ force = false } = {}) {
    if (this._suppressed || this._disposed) return false;
    const admission = this._snapshotAdmission();
    if (!admission.ok) {
      this._reportSnapshotRejection(admission);
      return false;
    }
    const sig = this.canvasManager._pixelsSignature?.();
    if (!force && sig && sig === this._lastSnapshotSig) return false;

    const id = this._newId('session');
    const entry = this._takeCurrentPreviewForSnapshot(sig, id)
      || this._captureEntry({ id, kind: 'session' });
    entry._persistOnSettle = true;
    if (entry.failed) return false;

    this._lastSnapshotSig = sig || null;
    this.undoStack.push(entry);
    this._clearRedoStack();
    this._trimToLimits();
    this._showCurrent = true;
    this._notify();
    // Legacy data-URL entries can be persisted now. Blob entries call this
    // again after their thumbnail has safely settled.
    if (!entry.pending) this._persistSessionBackup();
    return true;
  }

  async _entrySource(entry) {
    const sourceEntry = entry?._sourceEntry || entry;
    if (!sourceEntry || sourceEntry._released) return null;
    await sourceEntry.ready;
    if (sourceEntry._released || sourceEntry.failed) return null;
    if (sourceEntry.blob) {
      // Session-panel rows are shallow compatibility views. Resolve through
      // their owning entry so a later restore neither leaks a second URL nor
      // tries to use a URL that its owner has already revoked.
      const objectUrl = sourceEntry.objectUrl
        || (this._isManagedEntry(sourceEntry) ? this._createObjectUrl(sourceEntry) : null);
      if (objectUrl) return objectUrl;
      return blobToDataUrl(sourceEntry.blob);
    }
    if (!sourceEntry._placeholderPreview && typeof sourceEntry.dataUrl === 'string') return sourceEntry.dataUrl;
    return null;
  }

  async _restoreEntry(entry) {
    const sourceEntry = entry?._sourceEntry || entry;
    const source = await this._entrySource(sourceEntry);
    if (!source || typeof this.canvasManager?.loadImageDataUrl !== 'function') return false;
    this._suppressed = true;
    try {
      const restored = await this.canvasManager.loadImageDataUrl(source, sourceEntry.width, sourceEntry.height);
      if (restored === false) return false;
      this._lastSnapshotSig = this.canvasManager._pixelsSignature?.() || null;
      this.canvasManager.persistToStorage?.();
      this._showCurrent = true;
      return true;
    } finally {
      this._suppressed = false;
    }
  }

  _enqueueOperation(operation) {
    const run = async () => {
      if (this._disposed) return false;
      this._operationInFlight = true;
      try {
        return await operation();
      } catch {
        return false;
      } finally {
        this._operationInFlight = false;
      }
    };
    const queued = this._operationTail.then(run, run);
    // A failed operation must not poison the next Ctrl/Cmd+Z request.
    this._operationTail = queued.catch(() => false);
    return queued;
  }

  undo() {
    return this._enqueueOperation(() => this._undoNow());
  }

  async _undoNow() {
    if (this.undoStack.length === 0 || this._disposed) return false;
    const admission = this._snapshotAdmission();
    if (!admission.ok) {
      this._reportSnapshotRejection(admission);
      return false;
    }
    const prev = this.undoStack[this.undoStack.length - 1];
    // Capture the current pixels before awaiting a pending old snapshot.
    const current = this._captureEntry({ id: this._newId('redo'), kind: 'session' });
    // Make the reservation owned before the first await. A fast/mock toBlob
    // can settle in the next microtask, and must not be mistaken for an orphan.
    if (!current.failed) this.redoStack.push(current);
    this._trimToLimits();
    let moved = false;
    try {
      const source = await this._entrySource(prev);
      if (!source || !this.undoStack.includes(prev)) {
        const index = this.redoStack.indexOf(current);
        if (index >= 0) this.redoStack.splice(index, 1);
        this._releaseEntry(current);
        return false;
      }
      this.undoStack.pop();
      moved = true;
      const restored = await this._restoreEntry(prev);
      if (!restored) {
        const index = this.redoStack.indexOf(current);
        if (index >= 0) this.redoStack.splice(index, 1);
        this._releaseEntry(current);
        this.undoStack.push(prev);
        return false;
      }
      // Once decoded into the active canvas, this popped source has no owner.
      this._releaseEntry(prev);
      this._persistSessionBackup();
      this._notify();
      return true;
    } catch {
      const index = this.redoStack.indexOf(current);
      if (index >= 0) this.redoStack.splice(index, 1);
      this._releaseEntry(current);
      if (moved && !prev._released && !this.undoStack.includes(prev)) this.undoStack.push(prev);
      this._notify();
      return false;
    }
  }

  redo() {
    return this._enqueueOperation(() => this._redoNow());
  }

  async _redoNow() {
    if (this.redoStack.length === 0 || this._disposed) return false;
    const admission = this._snapshotAdmission();
    if (!admission.ok) {
      this._reportSnapshotRejection(admission);
      return false;
    }
    const next = this.redoStack[this.redoStack.length - 1];
    const current = this._captureEntry({ id: this._newId('session'), kind: 'session' });
    if (!current.failed) this.undoStack.push(current);
    this._trimToLimits();
    let moved = false;
    try {
      const source = await this._entrySource(next);
      if (!source || !this.redoStack.includes(next)) {
        const index = this.undoStack.indexOf(current);
        if (index >= 0) this.undoStack.splice(index, 1);
        this._releaseEntry(current);
        return false;
      }
      this.redoStack.pop();
      moved = true;
      const restored = await this._restoreEntry(next);
      if (!restored) {
        const index = this.undoStack.indexOf(current);
        if (index >= 0) this.undoStack.splice(index, 1);
        this._releaseEntry(current);
        this.redoStack.push(next);
        return false;
      }
      this._releaseEntry(next);
      this._persistSessionBackup();
      this._notify();
      return true;
    } catch {
      const index = this.undoStack.indexOf(current);
      if (index >= 0) this.undoStack.splice(index, 1);
      this._releaseEntry(current);
      if (moved && !next._released && !this.redoStack.includes(next)) this.redoStack.push(next);
      this._notify();
      return false;
    }
  }

  async restore(entry) {
    if (this._disposed) return false;
    return this._restoreEntry(entry);
  }

  // Compatibility alias for older callers; new UI code uses the public method.
  async _restore(entry) {
    return this.restore(entry);
  }

  clear() {
    this._sessionBackupGeneration += 1;
    this._releaseEntries(this.undoStack);
    this._releaseEntries(this.redoStack);
    this._releaseEntry(this._currentEntry);
    this.undoStack = [];
    this.redoStack = [];
    this._currentEntry = null;
    this._currentSignature = null;
    this._lastSnapshotSig = null;
    this._sessionBackup = null;
    this._showCurrent = true;
    try { this._sessionStorage?.removeItem?.(SESSION_BACKUP_KEY); } catch {}
    this._notify();
  }

  clearSession() { this.clear(); }

  persistSession() { this._persistSessionBackup(); }

  async waitForPendingSnapshots() {
    await Promise.all([...this._pendingEntries].map((entry) => entry.ready));
  }

  // Release browser-owned object URLs when a document/tab owner goes away.
  // Any previously persisted small sessionStorage backup is intentionally kept.
  dispose() {
    if (this._disposed) return;
    this._sessionBackupGeneration += 1;
    this._releaseEntries(this.undoStack);
    this._releaseEntries(this.redoStack);
    this._releaseEntry(this._currentEntry);
    this.undoStack = [];
    this.redoStack = [];
    this._currentEntry = null;
    this._disposed = true;
    this._notify();
  }

  destroy() { this.dispose(); }

  getMemoryReport() {
    const stackReport = summarizeHistoryMemory([...this.undoStack, ...this.redoStack]);
    const currentReport = this._currentEntry ? summarizeHistoryMemory([this._currentEntry]) : null;
    return {
      ...stackReport,
      currentPreviewBytes: currentReport?.undoBytes || 0,
      currentPreviewObjectUrlCount: currentReport?.objectUrlCount || 0,
      objectUrlCount: stackReport.objectUrlCount + (currentReport?.objectUrlCount || 0),
    };
  }

  _getSnapshotEntries() {
    if (this.undoStack.length > 0) {
      return this.undoStack.slice().reverse().map((entry, index) => {
        if (!entry.id) entry.id = this._newId('session');
        return {
          ...entry,
          _sourceEntry: entry,
          kind: 'session',
          label: `Step ${index + 1}${entry.pending ? ' (saving…)' : ''}`,
        };
      });
    }
    return (this._sessionBackup || []).map((entry, index) => ({
      ...entry,
      id: entry.id || `session-backup-${index}`,
      kind: 'session',
      label: entry.label || `Step ${index + 1} (last visit)`,
    }));
  }

  _currentPreviewEntry() {
    const signature = this.canvasManager._pixelsSignature?.()
      || `${this.canvasManager?.width || 0}x${this.canvasManager?.height || 0}`;
    if (!this._currentEntry || this._currentSignature !== signature) {
      this._releaseEntry(this._currentEntry);
      this._currentEntry = this._captureEntry({ id: 'current', kind: 'current', label: 'Current' });
      this._currentSignature = signature;
      if (this._currentEntry.failed) {
        this._currentEntry = null;
        return null;
      }
    }
    return this._currentEntry;
  }

  _takeCurrentPreviewForSnapshot(signature, id) {
    const entry = this._currentEntry;
    if (!entry || entry._released || !signature || this._currentSignature !== signature) return null;
    // The Session panel may already have started a capture of these exact
    // pixels. Transfer that ownership into undo rather than encoding A twice
    // just because the user happened to open the panel before drawing B.
    this._currentEntry = null;
    this._currentSignature = null;
    entry.id = id;
    entry.kind = 'session';
    entry.label = null;
    return entry;
  }

  // Session tab data: current first, then newest snapshots, with stable IDs.
  // The current preview is captured at most once per pixel signature, rather
  // than re-encoding the full canvas each time the panel is rendered.
  getSessionEntries() {
    const entries = this._getSnapshotEntries();
    if (this._showCurrent && !this._disposed) {
      const live = this._currentPreviewEntry();
      if (live) entries.unshift({ ...live, _sourceEntry: live, kind: 'current', label: 'Current' });
    }
    return entries;
  }

  removeSessionEntry(id) {
    if (!id) return false;
    if (id === 'current') {
      if (!this._showCurrent) return false;
      this._showCurrent = false;
      this._releaseEntry(this._currentEntry);
      this._currentEntry = null;
      this._currentSignature = null;
      this._notify();
      return true;
    }
    const undoIndex = this.undoStack.findIndex((entry) => entry.id === id);
    if (undoIndex >= 0) {
      const [entry] = this.undoStack.splice(undoIndex, 1);
      this._releaseEntry(entry);
      this._persistSessionBackup();
      this._notify();
      return true;
    }
    if (!this._sessionBackup) return false;
    const before = this._sessionBackup.length;
    this._sessionBackup = this._sessionBackup.filter((entry) => entry.id !== id);
    const changed = before !== this._sessionBackup.length;
    if (changed) {
      this._persistSessionBackup();
      this._notify();
    }
    return changed;
  }

  _notify() {
    this.onChange?.(this.undoStack.length > 0, this.redoStack.length > 0);
  }
}

// Async thumbnails (~96px jpeg) for the sessionStorage backup so a refresh
// restores previews without persisting short-lived blob: URLs.
const makeSessionThumbs = async (entries, maxSize = 96) => Promise.all(entries.map(async (entry) => {
  try {
    const source = entry.objectUrl || entry.dataUrl;
    const thumb = await downscaleImageUrlAsync(source, maxSize);
    // A blob URL is never safe to serialize. If thumbnail generation fails,
    // retain only already-inline legacy data, otherwise omit this backup entry.
    const dataUrl = isInlineDataUrl(thumb)
      ? thumb
      : (isInlineDataUrl(source) ? source : null);
    return {
      id: entry.id,
      kind: 'session',
      label: entry.label,
      width: entry.width,
      height: entry.height,
      dataUrl,
    };
  } catch {
    return null;
  }
}));

const downscaleImageUrlAsync = (source, maxSize = 96) => new Promise((resolve) => {
  try {
    if (!source || typeof Image === 'undefined' || typeof document === 'undefined') return resolve(null);
    // Short inline data URLs are already appropriate for sessionStorage. Blob
    // URLs must still be rasterized because they die as soon as this page does.
    if (isInlineDataUrl(source) && source.length < 60 * 1024) return resolve(source);
    const img = new Image();
    img.onload = () => {
      try {
        const scale = Math.min(1, maxSize / Math.max(1, Math.max(img.width, img.height)));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      } catch { resolve(null); }
    };
    img.onerror = () => resolve(null);
    img.src = source;
  } catch { resolve(null); }
});
