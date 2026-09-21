// js/canvas/ViewportManager.js
// Handles zoom. Unlike real Windows Paint, the percentage field is directly
// editable (per the brief) in addition to +/- buttons and Ctrl+Scroll.
// The last zoom is persisted so a page refresh returns to the same size
// (instead of resetting to 100%).
//
// Layout model (two nested boxes, so scrollbars always match the canvas):
//   .canvas-stage  - OUTER box. Sized by syncStageSize() to the *scaled*
//                    canvas size (canvasSize × zoom). It defines the scrollable
//                    extent of the viewport, so there is no dead gray space
//                    when zoomed out and full panning room when zoomed in.
//   #canvas-scale  - INNER box. Keeps image-pixel dimensions (set by
//                    CanvasResizer) and carries the CSS `scale()` transform.
//                    All drawing/handle math stays in true image coordinates.

const MIN_ZOOM = 10;
const MAX_ZOOM = 800;
const STEP = 10;
const ZOOM_STORAGE_KEY = 'paint:zoom';
const INITIAL_ZOOM_STORAGE_KEY = 'paint:initial-zoom';

export class ViewportManager {
  constructor({ stage, scaleEl, canvasManager, zoomInBtn, zoomOutBtn, zoomInput, zoomSlider }) {
    this.stage = stage; // outer box - sized to the scaled canvas (scroll extent)
    this.scaleEl = scaleEl; // inner box - image-pixel size + zoom transform
    this.viewportEl = stage.parentElement; // the scrollable viewport wrapper
    this.canvasManager = canvasManager;
    this.zoomInBtn = zoomInBtn;
    this.zoomOutBtn = zoomOutBtn;
    this.zoomInput = zoomInput;
    this.zoomSlider = zoomSlider;
    this.zoom = this._restoreZoom(); // percent
    this._canvasRect = null;
    this._geometryDirty = true;

    this.onZoomChange = null; // callback(zoomPercent)

    this._onZoomIn = () => this.setZoom(this.zoom + STEP);
    this._onZoomOut = () => this.setZoom(this.zoom - STEP);
    this._onZoomInputChange = () => {
      const val = parseInt(this.zoomInput.value, 10);
      if (!Number.isNaN(val)) this.setZoom(val);
      else this.zoomInput.value = this.zoom;
    };
    this._onZoomInputKeydown = (event) => {
      if (event.key === 'Enter') this.zoomInput.blur();
    };
    this._onZoomSliderInput = () => this.setZoom(parseInt(this.zoomSlider.value, 10));
    this._onWheel = (event) => {
      if (document.body.dataset.resizing === 'true') return;
      if (!event.ctrlKey && !event.metaKey) return; // let native scroll happen
      event.preventDefault();
      this.setZoom(this.zoom + (event.deltaY < 0 ? STEP : -STEP));
    };
    this._onGeometryChange = () => this.invalidateGeometry();

    this.zoomInBtn.addEventListener('click', this._onZoomIn);
    this.zoomOutBtn.addEventListener('click', this._onZoomOut);

    this.zoomInput.addEventListener('change', this._onZoomInputChange);
    this.zoomInput.addEventListener('keydown', this._onZoomInputKeydown);
    this.zoomSlider.addEventListener('input', this._onZoomSliderInput);

    // Plain wheel scrolls the viewport natively - it must NEVER change the
    // zoom, otherwise trying to pan while selecting/resizing moves the view
    // instead of the scroll position. Ctrl/Cmd+wheel zooms (the standard
    // convention, and what Windows Paint itself uses). While a canvas resize
    // drag is active the resize handles own the wheel instead, so we skip
    // zooming then to avoid fighting with the drag.
    this.viewportEl.addEventListener('wheel', this._onWheel, { passive: false });
    this.viewportEl.addEventListener('scroll', this._onGeometryChange, { passive: true });
    globalThis.window?.addEventListener?.('resize', this._onGeometryChange);
    if (typeof globalThis.ResizeObserver === 'function') {
      this._geometryObserver = new globalThis.ResizeObserver(this._onGeometryChange);
      this._geometryObserver.observe(this.canvasManager.canvas);
      this._geometryObserver.observe(this.viewportEl);
    }

    this._applyZoom();
  }

  setZoom(percent) {
    percent = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(percent)));
    this.zoom = percent;
    this._applyZoom();
    this._persistZoom();
    if (this.onZoomChange) this.onZoomChange(this.zoom);
  }

  /**
   * Make the outer stage the size of the visible (scaled) canvas. This keeps
   * the scrollable area in sync with the on-screen canvas at every zoom level:
   * below 100% the canvas shrinks (scrollbars disappear, no gray space to
   * scroll through), above 100% it grows (scrollbars appear to pan around).
   */
  syncStageSize() {
    const scale = this.zoom / 100;
    const w = Math.max(1, Math.round(this.canvasManager.width * scale));
    const h = Math.max(1, Math.round(this.canvasManager.height * scale));
    this.stage.style.width = `${w}px`;
    this.stage.style.height = `${h}px`;
    this.invalidateGeometry();
  }

  /**
   * RTL browsers expose the rightmost scroll position as scrollLeft=0. When
   * the resize edge is mirrored to the left, start at the opposite scroll
   * boundary so that handle is reachable immediately after switching direction.
   */
  alignRtlResizeEdge(direction = globalThis.document?.documentElement?.dir) {
    if (direction !== 'rtl') return;
    const maxScroll = Math.max(0, this.viewportEl.scrollWidth - this.viewportEl.clientWidth);
    this.viewportEl.scrollLeft = -maxScroll;
    this.invalidateGeometry();
  }

  _restoreZoom() {
    try {
      const saved = localStorage.getItem(ZOOM_STORAGE_KEY);
      const parsed = parseInt(saved, 10);
      if (Number.isNaN(parsed)) {
        const initial = parseInt(localStorage.getItem(INITIAL_ZOOM_STORAGE_KEY), 10);
        return Number.isNaN(initial) ? 100 : Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, initial));
      }
      return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, parsed));
    } catch {
      return 100;
    }
  }

  setInitialZoom(percent) {
    const value = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(Number(percent) || 100)));
    try { localStorage.setItem(INITIAL_ZOOM_STORAGE_KEY, String(value)); } catch {}
  }

  _persistZoom() {
    try {
      localStorage.setItem(ZOOM_STORAGE_KEY, String(this.zoom));
    } catch (err) {
      console.warn('Unable to save zoom:', err);
    }
  }

  _applyZoom() {
    const scale = this.zoom / 100;
    this.scaleEl.style.transform = `scale(${scale})`;
    this.scaleEl.style.setProperty('--zoom-inverse', String(1 / scale));
    this.zoomInput.value = this.zoom;
    this.zoomSlider.value = this.zoom;
    this.syncStageSize();
  }

  invalidateGeometry() {
    this._geometryDirty = true;
  }

  _getCanvasRect() {
    if (this._geometryDirty || !this._canvasRect) {
      const rect = this.canvasManager.canvas.getBoundingClientRect?.();
      this._canvasRect = {
        left: Number(rect?.left) || 0,
        top: Number(rect?.top) || 0,
      };
      this._geometryDirty = false;
    }
    return this._canvasRect;
  }

  /** Convert a client (mouse) coordinate to true image-pixel coordinates. */
  clientToImage(clientX, clientY) {
    const rect = this._getCanvasRect();
    const scale = this.zoom / 100;
    return {
      x: (clientX - rect.left) / scale,
      y: (clientY - rect.top) / scale,
    };
  }

  destroy() {
    this.zoomInBtn.removeEventListener('click', this._onZoomIn);
    this.zoomOutBtn.removeEventListener('click', this._onZoomOut);
    this.zoomInput.removeEventListener('change', this._onZoomInputChange);
    this.zoomInput.removeEventListener('keydown', this._onZoomInputKeydown);
    this.zoomSlider.removeEventListener('input', this._onZoomSliderInput);
    this.viewportEl.removeEventListener('wheel', this._onWheel);
    this.viewportEl.removeEventListener('scroll', this._onGeometryChange);
    globalThis.window?.removeEventListener?.('resize', this._onGeometryChange);
    this._geometryObserver?.disconnect();
    this._geometryObserver = null;
  }
}
