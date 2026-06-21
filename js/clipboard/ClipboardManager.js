// js/clipboard/ClipboardManager.js
// Real OS-clipboard image copy/cut/paste, targeting Chrome/Edge.
//   Copy:  canvas region -> blob -> ClipboardItem -> navigator.clipboard.write()
//   Paste: navigator.clipboard.read() -> find image/png -> createImageBitmap()
//          -> drawn at its NATIVE resolution (never downscaled to fit the view).

export class ClipboardManager {
  constructor({ canvasManager, historyManager, getSelection, setSelection, statusBar }) {
    this.canvasManager = canvasManager;
    this.historyManager = historyManager;
    this.getSelection = getSelection; // () => {x,y,w,h} | null
    this.setSelection = setSelection; // (region) => void
    this.statusBar = statusBar;
  }

  async copy() {
    const region = this.getSelection();
    const regionCanvas = this.canvasManager.extractRegion(region);
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
    this.historyManager.snapshot();
    this.canvasManager.fillRegion(region, this.canvasManager.backgroundColor);
    this.setSelection(null);
  }

  async paste() {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const type = item.types.find((t) => t.startsWith('image/'));
        if (!type) continue;
        const blob = await item.getType(type);
        const bitmap = await createImageBitmap(blob);

        this.historyManager.snapshot();
        // Anchor paste at the current selection's top-left if one exists, else 0,0.
        const sel = this.getSelection();
        const region = this.canvasManager.drawImageAtFullSize(bitmap, sel ? sel.x : 0, sel ? sel.y : 0);
        this.setSelection(region);
        this.statusBar?.flash(`Pasted ${bitmap.width}\u00d7${bitmap.height}px image at full size`);
        return;
      }
      this.statusBar?.flash('Clipboard has no image to paste');
    } catch (err) {
      console.error('Paste failed:', err);
      this.statusBar?.flash('Paste failed — clipboard permission denied');
    }
  }
}
