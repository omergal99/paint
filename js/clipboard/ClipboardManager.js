// js/clipboard/ClipboardManager.js
// Real OS-clipboard image copy/cut/paste, targeting Chrome/Edge.
//   Copy:  canvas region -> blob -> ClipboardItem -> navigator.clipboard.write()
//   Paste: navigator.clipboard.read() -> find image/png -> createImageBitmap()
//          -> drawn at its NATIVE resolution (never downscaled to fit the view).

export class ClipboardManager {
  constructor({ canvasManager, historyManager, getSelection, setSelection, statusBar, setActiveTool, commitFloatingSelection }) {
    this.canvasManager = canvasManager;
    this.historyManager = historyManager;
    this.getSelection = getSelection; // () => {x,y,w,h} | null
    this.setSelection = setSelection; // (region) => void
    this.statusBar = statusBar;
    this.setActiveTool = setActiveTool;
    this.commitFloatingSelection = commitFloatingSelection;
  }

  async copy() {
    const region = this.getSelection();
    if (!region) return;
    let regionCanvas;
    if (this.canvasManager.floatingCanvas) {
      regionCanvas = this.canvasManager.floatingCanvas;
    } else {
      regionCanvas = this.canvasManager.extractRegion(region);
    }
    const blob = await new Promise((resolve) => regionCanvas.toBlob(resolve, 'image/png'));
    if (!blob) return;
    try {
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
      this.statusBar?.flash('Copied to clipboard');
    } catch (err) {
      console.error('Copy failed:', err);
      this.statusBar?.flash('Copy failed — clipboard permission denied');
    }
  }

  async cut() {
    const region = this.getSelection();
    if (!region) return;
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

  async paste() {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const type = item.types.find((t) => t.startsWith('image/'));
        if (!type) continue;
        const blob = await item.getType(type);
        const bitmap = await createImageBitmap(blob);

        // Commit any active floating selection first!
        this.commitFloatingSelection?.();

        this.historyManager.snapshot();
        
        // Anchor paste at the current selection's top-left if one exists, else 0,0.
        const sel = this.getSelection();
        const x = sel ? sel.x : 0;
        const y = sel ? sel.y : 0;
        const w = bitmap.width;
        const h = bitmap.height;

        // Resize canvas if the pasted image exceeds current canvas dimensions
        const neededWidth = Math.max(this.canvasManager.width, x + w);
        const neededHeight = Math.max(this.canvasManager.height, y + h);
        if (neededWidth !== this.canvasManager.width || neededHeight !== this.canvasManager.height) {
          this.canvasManager.resize(neededWidth, neededHeight);
        }

        // Draw onto the offscreen floatingCanvas instead of the main canvas
        const fCanvas = document.createElement('canvas');
        fCanvas.width = w;
        fCanvas.height = h;
        fCanvas.getContext('2d').drawImage(bitmap, 0, 0);
        this.canvasManager.floatingCanvas = fCanvas;

        // Switch tool to select so user can move it
        this.setActiveTool?.('select');

        this.setSelection({ x, y, w, h });
        this.canvasManager.persistToStorage();
        this.statusBar?.flash(`Pasted ${w}\u00d7${h}px image as floating selection`);
        return;
      }
      this.statusBar?.flash('Clipboard has no image to paste');
    } catch (err) {
      console.error('Paste failed:', err);
      this.statusBar?.flash('Paste failed — clipboard permission denied');
    }
  }
}
