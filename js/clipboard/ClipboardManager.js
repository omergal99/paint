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
//          the OS clipboard API is denied. Text-only clipboard content routes
//          into the text tool through the injected routeText callback.

import { assessImageAdmission } from '../storage/ImageAdmission.js';

export class ClipboardManager {
  constructor({ canvasManager, historyManager, getSelection, setSelection, statusBar, setActiveTool, commitFloatingSelection, routeText }) {
    this.canvasManager = canvasManager;
    this.historyManager = historyManager;
    this.getSelection = getSelection; // () => {x,y,w,h} | null
    this.setSelection = setSelection; // (region) => void
    this.statusBar = statusBar;
    this.setActiveTool = setActiveTool;
    this.commitFloatingSelection = commitFloatingSelection;
    // Text-only paste opens the text tool; wired by the app shell (main.js).
    this.routeText = routeText;
    // Last PNG we produced ourselves - fallback when the OS clipboard is blocked.
    this.lastCopiedBlob = null;
    this.pendingInternalPaste = false;
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
    // A clean New canvas (no paint, no image yet) always pastes at 0,0 so a
    // cold-start paste is visible and predictable. Otherwise anchor at cursor.
    const isClean = this.canvasManager.isCleanDocument?.() === true;
    const pt = isClean ? null : this.statusBar?.currentPointer;
    const x = pt ? Math.floor(pt.x) : 0;
    const y = pt ? Math.floor(pt.y) : 0;
    const w = bitmap.width;
    const h = bitmap.height;

    const neededWidth = isClean ? w : Math.max(this.canvasManager.width, x + w);
    const neededHeight = isClean ? h : Math.max(this.canvasManager.height, y + h);
    const admission = assessImageAdmission({
      width: w,
      height: h,
      targetWidth: neededWidth,
      targetHeight: neededHeight,
    });
    if (!admission.ok) {
      bitmap.close?.();
      this.statusBar?.flash(admission.message);
      return null;
    }

    try {
      // Commit any active floating selection only after this new image is known
      // safe, so a rejected import never mutates the current work.
      this.commitFloatingSelection?.();
      // A static marquee is not committed by commitFloatingSelection(). Clear
      // it before establishing the pasted image as the new active selection.
      this.setSelection?.(null);
      this.historyManager.snapshot();
      if (neededWidth !== this.canvasManager.width || neededHeight !== this.canvasManager.height) {
        if (!this.canvasManager.resize(neededWidth, neededHeight)) return null;
        if (isClean) this.canvasManager.resetCleanBaseline?.();
      }

      const fCanvas = document.createElement('canvas');
      fCanvas.width = w;
      fCanvas.height = h;
      fCanvas.getContext('2d').drawImage(bitmap, 0, 0);
      this.canvasManager.floatingCanvas = fCanvas;

      this.setActiveTool?.('select');
      this.setSelection({ x, y, w, h });
      this.canvasManager.persistToStorage();
      this.statusBar?.flash(`${sourceLabel} ${w}×${h}px image as floating selection`);
      return { x, y, w, h };
    } finally {
      bitmap.close?.();
    }
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
      this.statusBar?.flash('Copy failed - could not encode image');
      return false;
    }
    this.lastCopiedBlob = blob;
    this.pendingInternalPaste = true;

    try {
      if (typeof ClipboardItem !== 'function') throw new Error('ClipboardItem unsupported');
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      this.pendingInternalPaste = false;
      this.statusBar?.flash('Copied to clipboard');
    } catch (err) {
      console.error('OS clipboard write failed:', err);
      // The image is kept in-app, so paste within this tab still works.
      this.statusBar?.flash('Copied internally - OS clipboard unavailable');
    }
    return true;
  }

  async pasteLastCopied() {
    if (!this.lastCopiedBlob) return false;
    return await this.insertImageBlob(this.lastCopiedBlob, { sourceLabel: 'Pasted (in-app)' }) !== null;
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
    try {
      const bitmap = await createImageBitmap(blob);
      return await this.insertBitmapAsFloatingSelection(bitmap, { sourceLabel });
    } catch (error) {
      console.error('Image import failed:', error);
      this.statusBar?.flash('Image could not be decoded');
      return null;
    }
  }

  async paste() {
    if (this.pendingInternalPaste && await this.pasteLastCopied()) return;
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const type = item.types.find((t) => t.startsWith('image/'));
        if (!type) continue;
        const blob = await item.getType(type);
        await this.insertImageBlob(blob, { sourceLabel: 'Pasted' });
        return;
      }
      // Text-only clipboard content opens the text tool prefilled instead of
      // doing nothing; image content always wins in the loop above.
      const textItem = items.find((entry) => entry.types.includes('text/plain'));
      if (textItem && this.routeText) {
        const text = await (await textItem.getType('text/plain')).text();
        if (text && text.trim()) {
          await this.routeText(text);
          return;
        }
      }
      if (this.lastCopiedBlob) {
        await this.pasteLastCopied();
        return;
      }
      this.statusBar?.flash('Clipboard has no image to paste');
    } catch (err) {
      console.error('Paste failed:', err);
      // OS clipboard read denied - fall back to the last image copied here.
      if (this.lastCopiedBlob) {
        try {
          await this.pasteLastCopied();
          return;
        } catch (fallbackErr) {
          console.error('In-app paste fallback failed:', fallbackErr);
        }
      }
      this.statusBar?.flash('Paste failed - clipboard permission denied');
    }
  }
}
