// js/canvas/CanvasManager.js
// Owns the two stacked canvases:
//   - `canvas`  : the real image pixels (what gets saved/copied)
//   - `overlay` : selection marquees, shape previews, text caret — never touches real pixels
// Zoom is applied as a CSS transform by ViewportManager; CanvasManager always works
// in true image-pixel coordinates so drawing stays crisp at any zoom level.

const STORAGE_KEY = 'omerpaint:last-canvas';

export class CanvasManager {
  constructor({ canvas, overlay, width = 800, height = 600, backgroundColor = '#ffffff' }) {
    this.canvas = canvas;
    this.overlay = overlay;
    this.ctx = canvas.getContext('2d', { willReadFrequently: true });
    this.octx = overlay.getContext('2d');

    this.width = width;
    this.height = height;
    this.backgroundColor = backgroundColor;

    this.primaryColor = '#000000';
    this.secondaryColor = '#ffffff';
    this.lineWidth = 3;

    this.selection = null; // {x,y,w,h} in image pixels, or null
    this.floatingCanvas = null; // offscreen canvas for active floating selection

    this._setSize(width, height);
    this.clear(backgroundColor);

    this.onSizeChange = null; // callback(width, height)
  }

  _setSize(w, h) {
    this.canvas.width = w;
    this.canvas.height = h;
    this.overlay.width = w;
    this.overlay.height = h;
    this.width = w;
    this.height = h;
  }

  persistToStorage() {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const dataUrl = this.canvas.toDataURL('image/png');
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ dataUrl, width: this.width, height: this.height }));
    } catch (err) {
      console.warn('Unable to persist canvas state:', err);
    }
  }

  clearStoredState() {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      console.warn('Unable to clear persisted canvas state:', err);
    }
  }

  async restoreFromStorage() {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const { dataUrl, width, height } = JSON.parse(raw);
      if (!dataUrl) return false;
      await this.loadImageDataUrl(dataUrl, width, height);
      return true;
    } catch (err) {
      console.warn('Unable to restore canvas state:', err);
      return false;
    }
  }

  clear(color = this.backgroundColor) {
    this.ctx.save();
    this.ctx.fillStyle = color;
    this.ctx.fillRect(0, 0, this.width, this.height);
    this.ctx.restore();
  }

  clearOverlay() {
    this.octx.clearRect(0, 0, this.overlay.width, this.overlay.height);
  }

  /** Resize the working canvas, anchored top-left, preserving existing pixels. */
  resize(newWidth, newHeight, fillColor = this.backgroundColor) {
    newWidth = Math.max(1, Math.round(newWidth));
    newHeight = Math.max(1, Math.round(newHeight));
    if (newWidth === this.width && newHeight === this.height) return;

    const snapshot = document.createElement('canvas');
    snapshot.width = this.width;
    snapshot.height = this.height;
    snapshot.getContext('2d').drawImage(this.canvas, 0, 0);

    this._setSize(newWidth, newHeight);
    this.ctx.save();
    this.ctx.fillStyle = fillColor;
    this.ctx.fillRect(0, 0, newWidth, newHeight);
    this.ctx.drawImage(snapshot, 0, 0);
    this.ctx.restore();

    this.clearOverlay();
    this.selection = null;
    if (this.onSizeChange) this.onSizeChange(newWidth, newHeight);
  }

  /** Used by HistoryManager to restore a previous state (image + dimensions). */
  loadImageDataUrl(dataUrl, width, height) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        this._setSize(width, height);
        this.ctx.clearRect(0, 0, width, height);
        this.ctx.drawImage(img, 0, 0);
        this.clearOverlay();
        this.selection = null;
        if (this.onSizeChange) this.onSizeChange(width, height);
        resolve();
      };
      img.src = dataUrl;
    });
  }

  /**
   * Draw a decoded image at full native resolution (never downsampled), positioned
   * at (x, y). If it doesn't fit, the canvas is expanded to fit it — matching
   * how Paste behaves in real Paint. Returns the {x,y,w,h} region it now occupies.
   */
  drawImageAtFullSize(imgBitmap, x = 0, y = 0) {
    const w = imgBitmap.width;
    const h = imgBitmap.height;
    const neededWidth = Math.max(this.width, x + w);
    const neededHeight = Math.max(this.height, y + h);
    if (neededWidth !== this.width || neededHeight !== this.height) {
      this.resize(neededWidth, neededHeight);
    }
    this.ctx.drawImage(imgBitmap, x, y, w, h);
    return { x, y, w, h };
  }

  /**
   * Replace the entire canvas with the given source (ImageBitmap or canvas),
   * resizing to match it exactly. Used by "Open" and "Crop to selection".
   */
  loadFromSource(source) {
    const w = source.width;
    const h = source.height;
    this._setSize(w, h);
    this.ctx.clearRect(0, 0, w, h);
    this.ctx.drawImage(source, 0, 0);
    this.clearOverlay();
    this.selection = null;
    if (this.onSizeChange) this.onSizeChange(w, h);
  }

  getPixelColor(x, y) {
    x = Math.min(Math.max(0, Math.floor(x)), this.width - 1);
    y = Math.min(Math.max(0, Math.floor(y)), this.height - 1);
    const [r, g, b, a] = this.ctx.getImageData(x, y, 1, 1).data;
    return { r, g, b, a };
  }

  /** Extract the selected region (or whole canvas) as a same-size canvas, for copy. */
  extractRegion(region) {
    const r = region || { x: 0, y: 0, w: this.width, h: this.height };
    const out = document.createElement('canvas');
    out.width = r.w;
    out.height = r.h;
    out.getContext('2d').drawImage(this.canvas, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
    return out;
  }

  /** Fill a region with a color (used when cutting/moving a selection). */
  fillRegion(region, color) {
    this.ctx.save();
    this.ctx.fillStyle = color;
    this.ctx.fillRect(region.x, region.y, region.w, region.h);
    this.ctx.restore();
  }

  toBlob(type = 'image/png') {
    return new Promise((resolve) => this.canvas.toBlob(resolve, type));
  }
}
