// js/history/HistoryManager.js
// Snapshot-based undo/redo. Simple and robust: each entry stores a PNG data URL
// plus the canvas dimensions at that point, so resizing the canvas can also be undone.
// Snapshots are taken on stroke-end (not every mousemove), so this stays fast.

const MAX_HISTORY = 50;

export class HistoryManager {
  constructor(canvasManager) {
    this.canvasManager = canvasManager;
    this.undoStack = [];
    this.redoStack = [];
    this._suppressed = false;
    this.onChange = null; // callback(canUndo, canRedo)
  }

  /** Call BEFORE an action mutates the canvas. */
  snapshot() {
    if (this._suppressed) return;
    const { width, height } = this.canvasManager;
    const dataUrl = this.canvasManager.canvas.toDataURL('image/png');
    this.undoStack.push({ dataUrl, width, height });
    if (this.undoStack.length > MAX_HISTORY) this.undoStack.shift();
    this.redoStack = [];
    this._notify();
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
    this.canvasManager.persistToStorage();
    this._suppressed = false;
  }

  clear() {
    this.undoStack = [];
    this.redoStack = [];
    this._notify();
  }

  _notify() {
    if (this.onChange) this.onChange(this.undoStack.length > 0, this.redoStack.length > 0);
  }
}
