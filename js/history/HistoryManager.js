// js/history/HistoryManager.js
// Snapshot-based undo/redo. Simple and robust: each entry stores a PNG data URL
// plus the canvas dimensions at that point, so resizing the canvas can also be undone.
// Snapshots are taken on stroke-end (not every mousemove), so this stays fast.

const MAX_HISTORY = 20;
const SESSION_BACKUP_KEY = 'paint:session-backup';

export class HistoryManager {
  constructor(canvasManager) {
    this.canvasManager = canvasManager;
    this.undoStack = [];
    this.redoStack = [];
    this._suppressed = false;
    this.onChange = null; // callback(canUndo, canRedo)
    this._restoreSessionBackup();
  }

  // Session survives refresh (sessionStorage dies only with the browser tab).
  // Thumbnails (~96px jpeg) keep the backup far under the ~5MB quota.
  _persistSessionBackup() {
    try {
      const live = this.getSessionEntries();
      // Fire-and-forget: thumbnails need async image decode.
      makeSessionThumbs(live, 96).then((entries) => {
        try {
          sessionStorage.setItem(SESSION_BACKUP_KEY, JSON.stringify(entries.slice(-MAX_HISTORY)));
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
      // Thumbs only: mark so restores know they are low-res placeholders until
      // the live canvas state is re-captured by new strokes.
      this._sessionBackup = entries.filter((e) => e && e.dataUrl);
    } catch { this._sessionBackup = null; }
  }

  /**
   * Call BEFORE an action mutates the canvas. Skips no-change snapshots.
   * `force` records the entry even when the pixels are unchanged, for actions
   * whose effect is not on the canvas yet (e.g. a shape lifted as a floating
   * layer) so undo can still revert them.
   */
  snapshot({ force = false } = {}) {
    if (this._suppressed) return false;
    const width = Number(this.canvasManager.width) || Number(this.canvasManager.canvas.width);
    const height = Number(this.canvasManager.height) || Number(this.canvasManager.canvas.height);
    const sig = this.canvasManager._pixelsSignature?.();
    if (!force && sig && sig === this._lastSnapshotSig) return false; // no real change
    const dataUrl = this.canvasManager.canvas.toDataURL('image/png');
    this._lastSnapshotSig = sig || null;
    this.undoStack.push({ dataUrl, width, height });
    if (this.undoStack.length > MAX_HISTORY) this.undoStack.shift();
    this.redoStack = [];
    this._notify();
    this._persistSessionBackup();
    return true;
  }

  async undo() {
    if (this.undoStack.length === 0) return;
    const current = {
      dataUrl: this.canvasManager.canvas.toDataURL('image/png'),
      width: this.canvasManager.width,
      height: this.canvasManager.height,
    };
    const prev = this.undoStack.pop();
    this.redoStack.push(current);
    await this._restore(prev);
    this._notify();
  }

  async redo() {
    if (this.redoStack.length === 0) return;
    const current = {
      dataUrl: this.canvasManager.canvas.toDataURL('image/png'),
      width: this.canvasManager.width,
      height: this.canvasManager.height,
    };
    const next = this.redoStack.pop();
    this.undoStack.push(current);
    await this._restore(next);
    this._notify();
  }

  async _restore(entry) {
    this._suppressed = true;
    await this.canvasManager.loadImageDataUrl(entry.dataUrl, entry.width, entry.height);
    this._lastSnapshotSig = this.canvasManager._pixelsSignature?.() || null;
    this.canvasManager.persistToStorage();
    this._suppressed = false;
  }

  clear() {
    this.undoStack = [];
    this.redoStack = [];
    this._lastSnapshotSig = null;
    this._sessionBackup = null;
    try { sessionStorage.removeItem(SESSION_BACKUP_KEY); } catch {}
    this._notify();
  }

  clearSession() { this.clear(); }

  // Session tab data: {dataUrl,width,height,label} (+thumb when asked).
  // Live undo stack first; after a refresh the sessionStorage thumbnail
  // backup fills in until new strokes re-capture full-res states.
  getSessionEntries() {
    let entries;
    if (this.undoStack.length > 0) {
      entries = this.undoStack.map((e, i) => ({ ...e, label: `Step ${i + 1}` }));
    } else if (this._sessionBackup?.length) {
      entries = this._sessionBackup.map((e, i) => ({ ...e, label: `Step ${i + 1} (last visit)` }));
    } else {
      entries = [];
    }
    try {
      const live = {
        dataUrl: this.canvasManager.canvas.toDataURL('image/png'),
        width: this.canvasManager.width,
        height: this.canvasManager.height,
        label: 'Current',
      };
      // Don't duplicate the backup's last thumb as "Current" on a fresh load.
      if (this.undoStack.length > 0 || !this._sessionBackup?.length) entries.push(live);
    } catch {}
    return entries;
  }

  _notify() {
    if (this.onChange) this.onChange(this.undoStack.length > 0, this.redoStack.length > 0);
  }
}

// Async thumbnails (~96px jpeg) for the sessionStorage backup so a refresh
// restores previews without blowing the ~5MB sessionStorage quota.
async function makeSessionThumbs(entries, maxSize = 96) {
  return Promise.all(entries.map(async (e) => {
    try {
      const thumb = await downscaleDataUrlAsync(e.dataUrl, maxSize);
      return { ...e, dataUrl: thumb || e.dataUrl };
    } catch { return e; }
  }));
}

function downscaleDataUrlAsync(dataUrl, maxSize = 96) {
  return new Promise((resolve) => {
    try {
      if (!dataUrl || typeof document === 'undefined') return resolve(null);
      if (dataUrl.length < 60 * 1024) return resolve(dataUrl); // already tiny
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
