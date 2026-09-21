// js/canvas/CanvasManager.js
// Owns the two stacked canvases:
//   - `canvas`  : the real image pixels (what gets saved/copied)
//   - `overlay` : selection marquees, shape previews, text caret - never touches real pixels
// Zoom is applied as a CSS transform by ViewportManager; CanvasManager always works
// in true image-pixel coordinates so drawing stays crisp at any zoom level.

import { assessImageAdmission } from '../storage/ImageAdmission.js';
import { EVENTS } from '../core/constants.js';
import { LEGACY_WORKING_CANVAS_KEY } from '../storage.js';

// Memory guard for shape-layer measurement: reading more than this many pixels
// in one getImageData call (16M px ≈ 64 MB RGBA) risks a failed allocation on
// low-memory devices, so the re-measure loop stops growing instead.
const MAX_MEASURE_PIXELS = 16 * 1024 * 1024;

// Floating layers already contain their intended alpha. Always place them
// with an opaque source-over operation so a drawing tool's stale globalAlpha
// cannot compound the layer opacity during Select-after-draw placement.
export const commitLayerWithSourceOver = (context, layer, region) => {
	if (!context || !layer || !region) return false;
	context.save();
	context.globalAlpha = 1;
	context.globalCompositeOperation = 'source-over';
	context.drawImage(layer, region.x, region.y);
	context.restore();
	return true;
};

/** Clamp a {x,y,w,h} region so it stays fully inside a w×h canvas (min 1×1). */
const clampRegionToBounds = (region, maxW, maxH) => {
  const w = Math.min(Math.max(1, Math.round(region.w)), maxW);
  const h = Math.min(Math.max(1, Math.round(region.h)), maxH);
  return {
    x: Math.min(Math.max(0, Math.round(region.x)), maxW - w),
    y: Math.min(Math.max(0, Math.round(region.y)), maxH - h),
    w,
    h,
  };
}

export class CanvasManager {
  constructor({ canvas, overlay, width = 800, height = 600, backgroundColor = '#ffffff', backgroundMode = 'solid', eventBus = null }) {
    this.canvas = canvas;
    this.overlay = overlay;
    this.ctx = canvas.getContext('2d', { willReadFrequently: true });
    this.octx = overlay.getContext('2d');

    this.width = width;
    this.height = height;
    this.backgroundColor = backgroundColor;
    this.backgroundMode = backgroundMode === 'transparent' ? 'transparent' : 'solid';
    this.eventBus = eventBus;

    this.primaryColor = '#000000';
    this.primaryAlpha = 1;
    this.secondaryColor = '#ffffff';
    this.secondaryAlpha = 1;
    this.lineWidth = 3;

    this.selection = null; // {x,y,w,h} in image pixels, or null
    this.floatingCanvas = null; // offscreen canvas for active floating selection
    this.layerComposer = null;
    this.onRasterLoad = null;
    this.onAdmissionRejected = null;
    this.onImageLoadError = null;

    this._setSize(width, height);
    this.clear(backgroundColor);
    this._cleanSignature = this._pixelsSignature();

    this.onSizeChange = null; // callback(width, height)
  }

  // True while the canvas still holds exactly the blank background it was
  // created with (no paint, no image). Used so a first paste on a clean New
  // doc lands at 0,0 instead of a stale pointer, and so no-change saves can
  // be skipped. Sampling keeps this cheap on large canvases.
  _pixelsSignature() {
    try {
      const w = Math.min(48, this.width);
      const h = Math.min(48, this.height);
      const tmp = document.createElement('canvas');
      tmp.width = w; tmp.height = h;
      const g = tmp.getContext('2d', { willReadFrequently: true });
      g.drawImage(this.canvas, 0, 0, this.width, this.height, 0, 0, w, h);
      const d = g.getImageData(0, 0, w, h).data;
      let hash = (this.width * 31 + this.height) | 0;
      for (let i = 0; i < d.length; i += 16) {
        hash = (((hash * 33) ^ d[i]) | 0) >>> 0;
      }
      return `${this.width}x${this.height}:${hash}`;
    } catch { return `${this.width}x${this.height}:unavailable`; }
  }

  isCleanDocument() {
    // A floating shape has not been composited yet, so pixel-wise the canvas can
    // still look blank - treat it as dirty so a paste does not land at 0,0.
    if (this.floatingCanvas) return false;
    if (this.layerComposer?.hasContent?.()) return false;
    return this._pixelsSignature() === this._cleanSignature;
  }

  markDocumentDirty() { this._cleanSignature = null; }

  setLayerComposer(layerComposer = null) {
    this.layerComposer = layerComposer;
  }

  createCompositeCanvas() {
    if (typeof document === 'undefined' || !this.layerComposer?.hasContent?.()) return this.canvas;
    const composite = document.createElement('canvas');
    composite.width = this.width;
    composite.height = this.height;
    const context = composite.getContext('2d');
    context.drawImage(this.canvas, 0, 0);
    this.layerComposer.composite?.(context);
    return composite;
  }

  toDataURL(type = 'image/png', quality) {
    const source = this.createCompositeCanvas();
    return source.toDataURL(type, quality);
  }

  // Flatten auxiliary layers only when a pixel operation needs to own them.
  // Text focus/move never calls this method, so it cannot erase or duplicate
  // unrelated pixels behind a text object.
  flattenLayers() {
    if (!this.layerComposer?.hasContent?.() || typeof document === 'undefined') return false;
    const composite = this.createCompositeCanvas();
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.ctx.drawImage(composite, 0, 0);
    this.layerComposer.clear?.();
    this.markDocumentDirty();
    this.onRasterLoad?.({ reason: 'flatten' });
    return true;
  }

  _setSize(w, h) {
    this.canvas.width = w;
    this.canvas.height = h;
    this.overlay.width = w;
    this.overlay.height = h;
    this.width = w;
    this.height = h;
  }

  _admitImage({ width, height, targetWidth, targetHeight }) {
    const admission = assessImageAdmission({ width, height, targetWidth, targetHeight });
    if (!admission.ok) this.onAdmissionRejected?.(admission);
    return admission;
  }

  persistToStorage() {
    // IndexedDB owns working-document persistence. This method deliberately
    // remains the synchronous mutation boundary for old tools: it emits one
    // change signal and lets the serial Blob autosaver encode outside the
    // pointer/input hot path.
    const detail = { width: this.width, height: this.height };
    this.eventBus?.emit(EVENTS.documentChanged, detail);
    const target = globalThis.window;
    if (target?.dispatchEvent && typeof CustomEvent !== 'undefined') {
      target.dispatchEvent(new CustomEvent('paint:changed', { detail }));
    }
  }

  clearStoredState() {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      // This only removes the read-once pre-v1 fallback. Canonical IndexedDB
      // data is reset explicitly through storage.js after user confirmation.
      window.localStorage.removeItem(LEGACY_WORKING_CANVAS_KEY);
    } catch (err) {
      console.warn('Unable to clear persisted canvas state:', err);
    }
  }

  async restoreLegacyFromStorage({ maxAgeMs = Infinity } = {}) {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    try {
      const raw = window.localStorage.getItem(LEGACY_WORKING_CANVAS_KEY);
      if (!raw) return false;
      const { dataUrl, width, height, updatedAt } = JSON.parse(raw);
      if (!dataUrl) return false;
      if (!Number.isFinite(updatedAt) || Date.now() - updatedAt > maxAgeMs) return false;
      return await this.loadImageDataUrl(dataUrl, width, height);
    } catch (err) {
      console.warn('Unable to restore canvas state:', err);
      return false;
    }
  }

  // Compatibility alias for integrations that predate the IndexedDB working
  // record. New startup code should call restoreLegacyFromStorage only after
  // it confirms that no canonical record is available.
  async restoreFromStorage(options = {}) { return this.restoreLegacyFromStorage(options); }

  clear(color = this.backgroundColor) {
    this.ctx.save();
    this._paintBackground(this.ctx, 0, 0, this.width, this.height, color);
    this.ctx.restore();
  }

  setBackgroundMode(mode) {
    this.backgroundMode = mode === 'transparent' ? 'transparent' : 'solid';
    return this.backgroundMode;
  }

  setBackgroundColor(color) {
    if (typeof color !== 'string' || !/^#[0-9a-f]{6}$/i.test(color)) return this.backgroundColor;
    this.backgroundColor = color.toLowerCase();
    return this.backgroundColor;
  }

  _paintBackground(context, x, y, width, height, color = this.backgroundColor) {
    if (this.backgroundMode === 'transparent' && color === this.backgroundColor) {
      context.clearRect(x, y, width, height);
      return;
    }
    context.fillStyle = color;
    context.fillRect(x, y, width, height);
  }

  clearOverlay() {
    this.octx.clearRect(0, 0, this.overlay.width, this.overlay.height);
  }

  /** Resize the working canvas, preserving pixels from the requested anchor. */
  resize(newWidth, newHeight, fillColor = this.backgroundColor, { anchorX = 'left', anchorY = 'top' } = {}) {
    newWidth = Math.max(1, Math.round(newWidth));
    newHeight = Math.max(1, Math.round(newHeight));
    const admission = this._admitImage({ width: newWidth, height: newHeight });
    if (!admission.ok) return false;
    if (newWidth === this.width && newHeight === this.height) return true;

    const snapshot = document.createElement('canvas');
    snapshot.width = this.width;
    snapshot.height = this.height;
    snapshot.getContext('2d').drawImage(this.canvas, 0, 0);

    // Preserve an active selection (and any floating image) across the resize,
    // clamped to the new canvas bounds, so resizing never silently drops it.
    const prevSelection = this.selection && this.selection.w > 0 && this.selection.h > 0
      ? { ...this.selection }
      : null;
    const prevFloating = this.floatingCanvas;
    const offsetX = anchorX === 'right' ? newWidth - this.width : 0;
    const offsetY = anchorY === 'bottom' ? newHeight - this.height : 0;

    this._setSize(newWidth, newHeight);
    this.ctx.save();
    this._paintBackground(this.ctx, 0, 0, newWidth, newHeight, fillColor);
    this.ctx.drawImage(snapshot, offsetX, offsetY);
    this.ctx.restore();

    this.clearOverlay();
    this.selection = prevSelection
      ? clampRegionToBounds({ ...prevSelection, x: prevSelection.x + offsetX, y: prevSelection.y + offsetY }, newWidth, newHeight)
      : null;
    this.floatingCanvas = this.selection ? prevFloating : null;
    if (this.onSizeChange) this.onSizeChange(newWidth, newHeight);
    return true;
  }

  /** Used by HistoryManager to restore a previous state (image + dimensions). */
  loadImageDataUrl(dataUrl, width, height) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const targetWidth = Number(width) > 0 ? Number(width) : img.width;
        const targetHeight = Number(height) > 0 ? Number(height) : img.height;
        const admission = this._admitImage({ width: img.width, height: img.height, targetWidth, targetHeight });
        if (!admission.ok) {
          resolve(false);
          return;
        }
        this._setSize(targetWidth, targetHeight);
        this.ctx.clearRect(0, 0, targetWidth, targetHeight);
        this.ctx.drawImage(img, 0, 0);
        this.clearOverlay();
        this.selection = null;
        this.markDocumentDirty();
        this.onRasterLoad?.({ reason: 'load-image-data' });
        if (this.onSizeChange) this.onSizeChange(targetWidth, targetHeight);
        resolve(true);
      };
      img.onerror = () => {
        this.onImageLoadError?.({ message: 'The saved image could not be decoded.' });
        resolve(false);
      };
      img.src = dataUrl;
    });
  }

  async loadImageBlob(blob, width, height, { urlApi = globalThis.URL } = {}) {
    if (typeof Blob === 'undefined' || !(blob instanceof Blob) || !urlApi?.createObjectURL) {
      this.onImageLoadError?.({ message: 'The saved image could not be decoded.' });
      return false;
    }
    const url = urlApi.createObjectURL(blob);
    try {
      return await this.loadImageDataUrl(url, width, height);
    } finally {
      urlApi.revokeObjectURL?.(url);
    }
  }

  /**
   * Draw a decoded image at full native resolution (never downsampled), positioned
   * at (x, y). If it doesn't fit, the canvas is expanded to fit it - matching
   * how Paste behaves in real Paint. Returns the {x,y,w,h} region it now occupies.
   */
  drawImageAtFullSize(imgBitmap, x = 0, y = 0) {
    const w = imgBitmap.width;
    const h = imgBitmap.height;
    const neededWidth = Math.max(this.width, x + w);
    const neededHeight = Math.max(this.height, y + h);
    const admission = this._admitImage({ width: w, height: h, targetWidth: neededWidth, targetHeight: neededHeight });
    if (!admission.ok) return null;
    if (neededWidth !== this.width || neededHeight !== this.height) {
      if (!this.resize(neededWidth, neededHeight)) return null;
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
    const admission = this._admitImage({ width: w, height: h });
    if (!admission.ok) return false;
    this._setSize(w, h);
    this.ctx.clearRect(0, 0, w, h);
    this.ctx.drawImage(source, 0, 0);
    this.clearOverlay();
    this.selection = null;
    this.onRasterLoad?.({ reason: 'load-source' });
    // A New blank source resets the clean baseline; real images mark dirty.
    this._cleanSignature = this._pixelsSignature();
    if (this.onSizeChange) this.onSizeChange(w, h);
    return true;
  }

  resetCleanBaseline() { this._cleanSignature = this._pixelsSignature(); }

  getPixelColor(x, y) {
    x = Math.min(Math.max(0, Math.floor(x)), this.width - 1);
    y = Math.min(Math.max(0, Math.floor(y)), this.height - 1);
    const source = this.createCompositeCanvas();
    const [r, g, b, a] = source.getContext('2d', { willReadFrequently: true }).getImageData(x, y, 1, 1).data;
    return { r, g, b, a };
  }

  /** Extract the selected region (or whole canvas) as a same-size canvas, for copy. */
  extractRegion(region) {
    const r = region || { x: 0, y: 0, w: this.width, h: this.height };
    const out = document.createElement('canvas');
    out.width = r.w;
    out.height = r.h;
    out.getContext('2d').drawImage(this.createCompositeCanvas(), r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
    return out;
  }

  /**
   * Draw a shape in isolation on a transparent scratch canvas and crop it to the
   * shape's exact ink bounds. Returns `{ layer, x, y, w, h }` - the shape alone on
   * transparency plus its real canvas coordinates - or null when nothing painted.
   *
   * Used by "select after draw" to lift a just-drawn shape as a floating layer.
   * Two things this fixes over copying the raw drag box:
   *   - the drag box is NOT the ink bounds. Emoji glyphs are wider than their
   *     font size and round line caps/joins spill past the box, so parts of the
   *     shape used to fall outside its own selection and get clipped on commit;
   *   - copying the box also copied the background and whatever artwork sat
   *     underneath, so moving the selection dragged a background rectangle over
   *     the painting. Measuring alpha means the layer carries the shape only.
   */
  renderShapeLayer(bounds, drawFn, pad = 0) {
    if (typeof document === 'undefined') return null;
    // Inflate so spilling ink is not cut off. 25% of the drag size is generous
    // for emoji/text (ink is wider than the font size) and for stroke joins.
    let inflate = Math.max(8, Math.ceil(Math.max(bounds.w, bounds.h) * 0.25), pad);
    let best = null;
    // If the measured ink touches an inflated edge that is NOT a canvas edge,
    // the scratch was too small and the shape would be clipped - grow and
    // re-measure (the doubling always converges: once the box reaches the
    // canvas edges nothing is "clipped" any more). This is what makes the
    // selection always cover every pixel that was painted.
    for (let attempt = 0; attempt < 4; attempt++) {
      const out = this._renderShapeLayerAt(bounds, drawFn, inflate);
      // Keep an earlier good measurement if a retry fails to allocate/read.
      if (!out) return best ? best.result : null;
      best = out;
      // Stop when nothing was cut off, or when growing further would mean
      // reading a huge RGBA buffer (memory guard: 16M px ≈ 64 MB per read).
      // A shape that big covers most of the canvas anyway, so the slightly
      // tighter box is not worth the allocation risk.
      if (!out.clipped || out.area > MAX_MEASURE_PIXELS) return out.result;
      inflate *= 2;
    }
    return best.result; // measured as far as the canvas allows
  }

  /** One measurement pass at a given inflation. See renderShapeLayer. */
  _renderShapeLayerAt(bounds, drawFn, inflate) {
    // Clamp to the canvas - pixels outside it were already clipped when the
    // shape would have been drawn.
    const x0 = Math.max(0, Math.floor(bounds.x - inflate));
    const y0 = Math.max(0, Math.floor(bounds.y - inflate));
    const x1 = Math.min(this.width, Math.ceil(bounds.x + bounds.w + inflate));
    const y1 = Math.min(this.height, Math.ceil(bounds.y + bounds.h + inflate));
    const w = x1 - x0;
    const h = y1 - y0;
    if (w <= 0 || h <= 0) return null;

    const scratch = document.createElement('canvas');
    scratch.width = w;
    scratch.height = h;
    const sctx = scratch.getContext('2d', { willReadFrequently: true });
    if (!sctx) return null;
    // Shift the origin so drawFn can keep working in plain canvas coordinates.
    sctx.translate(-x0, -y0);
    try { drawFn(sctx); } catch { return null; }

    const box = this._alphaBounds(sctx, w, h);
    if (!box) return null; // nothing visible (e.g. a click with no drag)
    const layer = document.createElement('canvas');
    layer.width = box.w;
    layer.height = box.h;
    const lctx = layer.getContext('2d');
    if (!lctx) return null;
    lctx.drawImage(scratch, box.x, box.y, box.w, box.h, 0, 0, box.w, box.h);
    // Touching an edge we created ourselves (rather than the canvas border)
    // means real ink was cut off.
    const clipped = (box.x === 0 && x0 > 0)
      || (box.y === 0 && y0 > 0)
      || (box.x + box.w === w && x1 < this.width)
      || (box.y + box.h === h && y1 < this.height);
    return { result: { layer, x: x0 + box.x, y: y0 + box.y, w: box.w, h: box.h }, clipped, area: w * h };
  }

  /** Tight bounding box of non-transparent pixels, or null when fully empty. */
  _alphaBounds(g, w, h) {
    let data;
    try {
      data = g.getImageData(0, 0, w, h).data;
    } catch {
      return null; // context unavailable / reading blocked
    }
    let minX = w;
    let minY = h;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < h; y++) {
      const row = y * w * 4;
      for (let x = 0; x < w; x++) {
        if (data[row + x * 4 + 3] !== 0) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) return null;
    return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
  }

  /** Fill a region with a color (used when cutting/moving a selection). */
  fillRegion(region, color) {
    this.ctx.save();
    this._paintBackground(this.ctx, region.x, region.y, region.w, region.h, color);
    this.ctx.restore();
  }

  toBlob(type = 'image/png') {
    const source = this.createCompositeCanvas();
    return new Promise((resolve) => source.toBlob(resolve, type));
  }
}
