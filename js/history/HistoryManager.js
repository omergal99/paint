// js/history/HistoryManager.js
// Snapshot-based undo/redo. Each entry stores a PNG data URL plus canvas
// dimensions so resizing can also be undone. Session entries are deliberately
// identified and ordered independently from the undo stack's implementation.

import { summarizeHistoryMemory } from '../storage/MemoryBudget.js';

const MAX_HISTORY = 20;
const MAX_HISTORY_BYTES = 64 * 1024 * 1024;
const SESSION_BACKUP_KEY = 'paint:session-backup';
const canvasDataUrl = (canvasManager) => canvasManager.toDataURL?.('image/png')
	|| canvasManager.canvas.toDataURL('image/png');

export class HistoryManager {
  constructor(canvasManager) {
    this.canvasManager = canvasManager;
    this.undoStack = [];
    this.redoStack = [];
    this._suppressed = false;
    this._idCounter = 0;
    this._sessionBackup = null;
    this._showCurrent = true;
    this.onChange = null; // callback(canUndo, canRedo)
    this._restoreSessionBackup();
  }

  _newId(prefix) {
    this._idCounter += 1;
    return `${prefix}-${Date.now().toString(36)}-${this._idCounter}`;
  }

  // Session survives refresh (sessionStorage dies only with the browser tab).
  // Thumbnails (~96px jpeg) keep the backup far under the ~5MB quota.
  _persistSessionBackup() {
    try {
      const snapshots = this._getSnapshotEntries();
      makeSessionThumbs(snapshots, 96).then((entries) => {
        try {
          sessionStorage.setItem(SESSION_BACKUP_KEY, JSON.stringify(entries.slice(0, MAX_HISTORY)));
        } catch { /* quota/blocked — session simply won't survive refresh */ }
      }).catch(() => {});
    } catch {}
  }

  _restoreSessionBackup() {
    try {
      const raw = sessionStorage.getItem(SESSION_BACKUP_KEY);
      if (!raw) return;
      const entries = JSON.parse(raw);
      if (!Array.isArray(entries)) return;
      this._sessionBackup = entries.filter((entry) => entry && entry.dataUrl
			&& entry.kind !== 'current' && entry.label !== 'Current').map((entry, index) => ({
        ...entry,
        id: entry.id || `session-backup-${index}`,
        kind: 'session',
      }));
    } catch { this._sessionBackup = null; }
  }

  /**
   * Call BEFORE an action mutates the canvas. Skips no-change snapshots.
   * `force` records the entry even when pixels are unchanged, for actions whose
   * effect is not on the canvas yet (for example a lifted floating shape).
   */
  snapshot({ force = false } = {}) {
    if (this._suppressed) return false;
    const width = Number(this.canvasManager.width) || Number(this.canvasManager.canvas.width);
    const height = Number(this.canvasManager.height) || Number(this.canvasManager.canvas.height);
    const sig = this.canvasManager._pixelsSignature?.();
    if (!force && sig && sig === this._lastSnapshotSig) return false;
    const dataUrl = canvasDataUrl(this.canvasManager);
    this._lastSnapshotSig = sig || null;
    this.undoStack.push({ dataUrl, width, height, id: this._newId('session'), kind: 'session' });
    if (this.undoStack.length > MAX_HISTORY) this.undoStack.shift();
    this._trimToByteBudget();
    this.redoStack = [];
    this._showCurrent = true;
    this._notify();
    this._persistSessionBackup();
    return true;
  }

  async undo() {
    if (this.undoStack.length === 0) return;
    const current = {
      dataUrl: canvasDataUrl(this.canvasManager),
      width: this.canvasManager.width,
      height: this.canvasManager.height,
    };
    const prev = this.undoStack.pop();
    this.redoStack.push({ ...current, id: this._newId('redo'), kind: 'session' });
    this._trimToByteBudget();
    await this.restore(prev);
    this._notify();
  }

  async redo() {
    if (this.redoStack.length === 0) return;
    const current = {
      dataUrl: canvasDataUrl(this.canvasManager),
      width: this.canvasManager.width,
      height: this.canvasManager.height,
    };
    const next = this.redoStack.pop();
    this.undoStack.push({ ...current, id: this._newId('session'), kind: 'session' });
    this._trimToByteBudget();
    await this.restore(next);
    this._notify();
  }

  async restore(entry) {
    this._suppressed = true;
    try {
      await this.canvasManager.loadImageDataUrl(entry.dataUrl, entry.width, entry.height);
      this._lastSnapshotSig = this.canvasManager._pixelsSignature?.() || null;
      this.canvasManager.persistToStorage();
      this._showCurrent = true;
    } finally {
      this._suppressed = false;
    }
  }

  // Compatibility alias for older callers; new UI code uses the public method.
  async _restore(entry) {
    return this.restore(entry);
  }

  clear() {
    this.undoStack = [];
    this.redoStack = [];
    this._lastSnapshotSig = null;
    this._sessionBackup = null;
    this._showCurrent = true;
    try { sessionStorage.removeItem(SESSION_BACKUP_KEY); } catch {}
    this._notify();
  }

  clearSession() { this.clear(); }

  persistSession() { this._persistSessionBackup(); }

  getMemoryReport() {
    return summarizeHistoryMemory([...this.undoStack, ...this.redoStack]);
  }

  _trimToByteBudget() {
    while (this.getMemoryReport().undoBytes > MAX_HISTORY_BYTES && this.undoStack.length > 1) {
      this.undoStack.shift();
    }
    while (this.getMemoryReport().undoBytes > MAX_HISTORY_BYTES && this.redoStack.length > 1) {
      this.redoStack.shift();
    }
  }

  _getSnapshotEntries() {
    if (this.undoStack.length > 0) {
      return this.undoStack.slice().reverse().map((entry, index) => {
        if (!entry.id) entry.id = this._newId('session');
        return {
          ...entry,
          kind: 'session',
          label: `Step ${index + 1}`,
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

  // Session tab data: current first, then newest snapshots, with stable IDs.
  getSessionEntries() {
    const entries = this._getSnapshotEntries();
    try {
      const live = {
        id: 'current',
        kind: 'current',
        dataUrl: canvasDataUrl(this.canvasManager),
        width: this.canvasManager.width,
        height: this.canvasManager.height,
        label: 'Current',
      };
      if (this._showCurrent) entries.unshift(live);
    } catch {}
    return entries;
  }

  removeSessionEntry(id) {
    if (!id) return false;
    if (id === 'current') {
      if (!this._showCurrent) return false;
      this._showCurrent = false;
      this._notify();
      return true;
    }
    const before = this.undoStack.length + (this._sessionBackup?.length || 0);
    this.undoStack = this.undoStack.filter((entry) => entry.id !== id);
    if (this._sessionBackup) this._sessionBackup = this._sessionBackup.filter((entry) => entry.id !== id);
    const changed = before !== this.undoStack.length + (this._sessionBackup?.length || 0);
    if (changed) {
      this._persistSessionBackup();
      this._notify();
    }
    return changed;
  }

  _notify() {
    if (this.onChange) this.onChange(this.undoStack.length > 0, this.redoStack.length > 0);
  }
}

// Async thumbnails (~96px jpeg) for the sessionStorage backup so a refresh
// restores previews without blowing the ~5MB sessionStorage quota.
const makeSessionThumbs = async (entries, maxSize = 96) => {
  return Promise.all(entries.map(async (entry) => {
    try {
      const thumb = await downscaleDataUrlAsync(entry.dataUrl, maxSize);
      return { ...entry, dataUrl: thumb || entry.dataUrl };
    } catch { return entry; }
  }));
}

const downscaleDataUrlAsync = (dataUrl, maxSize = 96) => {
  return new Promise((resolve) => {
    try {
      if (!dataUrl || typeof document === 'undefined') return resolve(null);
      if (dataUrl.length < 60 * 1024) return resolve(dataUrl);
      const img = new Image();
      img.onload = () => {
        try {
          const scale = Math.min(1, maxSize / Math.max(1, Math.max(img.width, img.height)));
          const c = document.createElement('canvas');
          c.width = Math.max(1, Math.round(img.width * scale));
          c.height = Math.max(1, Math.round(img.height * scale));
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          resolve(c.toDataURL('image/jpeg', 0.7));
        } catch { resolve(null); }
      };
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    } catch { resolve(null); }
  });
}
