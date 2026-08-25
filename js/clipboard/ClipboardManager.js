// js/clipboard/ClipboardManager.js
// Real OS-clipboard image copy/cut/paste, targeting Chrome/Edge/Safari/Firefox.
//   Copy:  canvas region -> PNG blob -> ClipboardItem -> navigator.clipboard.write()
//          The PNG is encoded SYNCHRONOUSLY (toDataURL) so the clipboard write
//          starts in the same task as the Cmd+C keystroke. Safari/macOS expires
//          its user-gesture window across awaits, which silently broke Cmd+C.
//   Paste: keyboard Cmd/Ctrl+V is served by the native 'paste' event (see
//          main.js), which carries the image with no permission prompt on any
//          platform; navigator.clipboard.read() remains the toolbar-button
//          fallback. A last-copied in-app blob keeps paste working even when
//          the OS clipboard API is denied.

export class ClipboardManager {
  constructor({ canvasManager, historyManager, getSelection, setSelection, statusBar, setActiveTool, commitFloatingSelection }) {
    this.canvasManager = canvasManager;
    this.historyManager = historyManager;
    this.getSelection = getSelection; // () => {x,y,w,h} | null
    this.setSelection = setSelection; // (region) => void
    this.statusBar = statusBar;
    this.setActiveTool = setActiveTool;
    this.commitFloatingSelection = commitFloatingSelection;
    // Last PNG we produced ourselves — fallback when the OS clipboard is blocked.
    this.lastCopiedBlob = null;
  }

  // Synchronous canvas -> PNG Blob (no awaits, keeps user activation alive).
  _pngBlobFromCanvas(canvas) {
    const dataUrl = canvas.toDataURL('image/png');
    const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: 'image/png' });
  }

  async insertBitmapAsFloatingSelection(bitmap, { sourceLabel = 'Pasted' } = {}) {
    // Commit any active floating selection first so the new image does not stack
    // on top of an uncommitted edit.
    this.commitFloatingSelection?.();

    this.historyManager.snapshot();

    // Anchor insertion at the cursor if one exists; otherwise use the top-left
    // corner so the image is immediately visible and draggable.
    const pt = this.statusBar?.currentPointer;
    const x = pt ? Math.floor(pt.x) : 0;
    const y = pt ? Math.floor(pt.y) : 0;
    const w = bitmap.width;
    const h = bitmap.height;

    const neededWidth = Math.max(this.canvasManager.width, x + w);
    const neededHeight = Math.max(this.canvasManager.height, y + h);
    if (neededWidth !== this.canvasManager.width || neededHeight !== this.canvasManager.height) {
      this.canvasManager.resize(neededWidth, neededHeight);
    }

    const fCanvas = document.createElement('canvas');
    fCanvas.width = w;
    fCanvas.height = h;
    fCanvas.getContext('2d').drawImage(bitmap, 0, 0);
    this.canvasManager.floatingCanvas = fCanvas;

    this.setActiveTool?.('select');
    this.setSelection({ x, y, w, h });
    this.canvasManager.persistToStorage();

    if (bitmap.close) bitmap.close();

    this.statusBar?.flash(`${sourceLabel} ${w}×${h}px image as floating selection`);
    return { x, y, w, h };
  }

  async copy() {
    const region = this.getSelection();
    if (!region) {
      this.statusBar?.flash('Select an area to copy');
      return false;
    }
    const regionCanvas = this.canvasManager.floatingCanvas || this.canvasManager.extractRegion(region);

    // Encode synchronously BEFORE any await so navigator.clipboard.write()
    // runs inside the user gesture (required on macOS/Safari).
    let blob;
    try {
      blob = this._pngBlobFromCanvas(regionCanvas);
    } catch (err) {
      console.error('Copy failed:', err);
      this.statusBar?.flash('Copy failed — could not encode image');
      return false;
    }
    this.lastCopiedBlob = blob;

    try {
      if (typeof ClipboardItem !== 'function') throw new Error('ClipboardItem unsupported');
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      this.statusBar?.flash('Copied to clipboard');
    } catch (err) {
      console.error('OS clipboard write failed:', err);
      // The image is kept in-app, so paste within this tab still works.
      this.statusBar?.flash('Copied internally — OS clipboard unavailable');
    }
    return true;
  }

  async cut() {
    const region = this.getSelection();
    if (!region) {
      this.statusBar?.flash('Select an area to cut');
      return;
    }
    await this.copy();
    if (this.canvasManager.floatingCanvas) {
      this.canvasManager.floatingCanvas = null;
      this.setSelection(null);
    } else {
      this.historyManager.snapshot();
      this.canvasManager.fillRegion(region, this.canvasManager.backgroundColor);
      this.setSelection(null);
    }
    this.canvasManager.persistToStorage();
  }

  async insertImageBlob(blob, { sourceLabel = 'Pasted' } = {}) {
    const bitmap = await createImageBitmap(blob);
    return this.insertBitmapAsFloatingSelection(bitmap, { sourceLabel });
  }

  async paste() {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const type = item.types.find((t) => t.startsWith('image/'));
        if (!type) continue;
        const blob = await item.getType(type);
        await this.insertImageBlob(blob, { sourceLabel: 'Pasted' });
        return;
      }
      this.statusBar?.flash('Clipboard has no image to paste');
    } catch (err) {
      console.error('Paste failed:', err);
      // OS clipboard read denied — fall back to the last image copied here.
      if (this.lastCopiedBlob) {
        try {
          await this.insertImageBlob(this.lastCopiedBlob, { sourceLabel: 'Pasted (in-app)' });
          return;
        } catch (fallbackErr) {
          console.error('In-app paste fallback failed:', fallbackErr);
        }
      }
      this.statusBar?.flash('Paste failed — clipboard permission denied');
    }
  }
}
