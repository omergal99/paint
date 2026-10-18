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

// Zoom percent bounds for the editable input and every runtime clamp
// (matches `#zoom-input` min="2" max="2000"). The slider is a coarse control
// with fixed 0–1000 tracks, so it keeps its own tighter 5–800 mapping.
const MIN_ZOOM = 2;
const MAX_ZOOM = 2000;
const SLIDER_ZOOM_MIN = 5;
const SLIDER_ZOOM_MAX = 800;
const STEP_BELOW_200 = 5;
const STEP_ABOVE_200 = 10;
const SLIDER_MIN = 0;
const SLIDER_MID = 500;
const SLIDER_MAX = 1000;
const ZOOM_STORAGE_KEY = 'paint:zoom';
const INITIAL_ZOOM_STORAGE_KEY = 'paint:initial-zoom';

const zoomFromSliderPosition = (position) => {
  const clamped = Math.min(SLIDER_MAX, Math.max(SLIDER_MIN, Number(position)));
  const percent = clamped <= SLIDER_MID
    ? SLIDER_ZOOM_MIN + (clamped / SLIDER_MID) * (100 - SLIDER_ZOOM_MIN)
    : 100 + ((clamped - SLIDER_MID) / (SLIDER_MAX - SLIDER_MID)) * (SLIDER_ZOOM_MAX - 100);
  return Math.round(percent);
};

const sliderPositionFromZoom = (zoom) => {
  const position = zoom <= 100
    ? ((zoom - SLIDER_ZOOM_MIN) / (100 - SLIDER_ZOOM_MIN)) * SLIDER_MID
    : SLIDER_MID + ((zoom - 100) / (SLIDER_ZOOM_MAX - 100)) * (SLIDER_MAX - SLIDER_MID);
  // Outside the slider's 5–800 window (e.g. a typed 2000%) the handle parks at
  // the matching end stop instead of clamping to a bogus track value.
  return String(Math.round(Math.min(SLIDER_MAX, Math.max(SLIDER_MIN, position))));
};

export class ViewportManager {
  constructor({ stage, scaleEl, canvasManager, zoomInBtn, zoomOutBtn, zoomResetBtn = null, zoomInput, zoomSlider }) {
    this.stage = stage; // outer box - sized to the scaled canvas (scroll extent)
    this.scaleEl = scaleEl; // inner box - image-pixel size + zoom transform
    this.viewportEl = stage.parentElement; // the scrollable viewport wrapper
    this.canvasManager = canvasManager;
    this.zoomInBtn = zoomInBtn;
    this.zoomOutBtn = zoomOutBtn;
    this.zoomResetBtn = zoomResetBtn;
    this.zoomInput = zoomInput;
    this.zoomSlider = zoomSlider;
    this.zoom = this._restoreZoom(); // percent
    this._canvasRect = null;
    this._geometryDirty = true;
    this._zoomReady = false; // canvas content (e.g. restored image) not ready yet

    this.onZoomChange = null; // callback(zoomPercent)

    // Zoom buttons/wheel step 5% at or below 200%, 10% above 200%.
    this._zoomStep = () => (this.zoom > 200 ? STEP_ABOVE_200 : STEP_BELOW_200);
    this._onZoomIn = () => this.setZoom(this.zoom + this._zoomStep());
    this._onZoomOut = () => this.setZoom(this.zoom - this._zoomStep());
    this._onZoomReset = () => this.setZoom(100);
    this._onZoomInputChange = () => {
      const val = parseInt(this.zoomInput.value, 10);
      if (!Number.isNaN(val)) this.setZoom(val);
      else this.zoomInput.value = this.zoom;
    };
    this._onZoomInputKeydown = (event) => {
      if (event.key === 'Enter') this.zoomInput.blur();
    };
    // While typing, mirror the spinner increment to the value being entered so
    // the +/- arrows step by 5 up to 200% and 10 above it. The committed zoom
    // itself still lands via the `change` handler, so this stays a cheap
    // attribute write and never re-lays-out the canvas per keystroke.
    this._onZoomInputLiveInput = () => this._syncZoomInputStep(Number(this.zoomInput.value) || this.zoom);
    this._onZoomSliderInput = () => this.setZoom(zoomFromSliderPosition(this.zoomSlider.value));
    this._onWheel = (event) => {
      if (document.body.dataset.resizing === 'true') return;
      if (!event.ctrlKey && !event.metaKey) return; // let native scroll happen
      event.preventDefault();
      this.setZoom(this.zoom + (event.deltaY < 0 ? this._zoomStep() : -this._zoomStep()));
    };
    this._onGeometryChange = () => this.invalidateGeometry();

    this.zoomInBtn.addEventListener('click', this._onZoomIn);
    this.zoomOutBtn.addEventListener('click', this._onZoomOut);
    this.zoomResetBtn?.addEventListener('click', this._onZoomReset);

    this.zoomInput.addEventListener('change', this._onZoomInputChange);
    this.zoomInput.addEventListener('keydown', this._onZoomInputKeydown);
    this.zoomInput.addEventListener('input', this._onZoomInputLiveInput);
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

    // Apply the remembered zoom to the scale transform and input cues now, but
    // deliberately defer the scroll-stage resize (see `applyZoom`): the restored
    // image may still be decoding, and resizing the scroll box mid-load makes
    // the picture jump.
    this._updateZoomUI();
  }

  setZoom(percent) {
    percent = Number(percent);
    if (!Number.isFinite(percent)) return;
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
    if (!this._zoomReady) return;
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

  /**
   * Update the zoom input, slider and CSS transform to match `this.zoom`.
   * Cheap, pure style writes; no layout, so it can run while the canvas content
   * is still loading (e.g. right after a page reload, before the restored
   * image is composed). The scrolling stage is intentionally left untouched
   * here.
   */
  _updateZoomUI() {
    const scale = this.zoom / 100;
    this.scaleEl.style.transform = `scale(${scale})`;
    this.scaleEl.style.setProperty('--zoom-inverse', String(1 / scale));
    this.zoomInput.value = this.zoom;
    this._syncZoomInputStep(this.zoom);
    this.zoomSlider.value = sliderPositionFromZoom(this.zoom);
    this.zoomSlider.setAttribute('aria-valuetext', `${this.zoom}%`);
  }

  /**
   * Apply the zoom to viewport geometry: size the outer scroll stage to the
   * scaled canvas and sync the zoom cues. Call only once the canvas content is
   * fully loaded (e.g. after the restored last image has decoded), otherwise
   * the scroll box resizes mid-load and the picture jumps.
   */
  _applyZoom() {
    this._updateZoomUI();
    // Size the inner pixel box to the canvas dimensions so the canvas,
    // handles and selection overlays all match the restored image size in one
    // layout pass - no intermediate white-cube or wrong-size flash before the
    // scroll stage is resized to the scaled extent.
    this.scaleEl.style.width = `${this.canvasManager.width}px`;
    this.scaleEl.style.height = `${this.canvasManager.height}px`;
    this.syncStageSize();
  }

  /**
   * Mark the remembered zoom as ready and apply it. Used at startup after the
   * restored image finishes loading.
   */
  applyZoom() {
    if (this._zoomReady) return;
    this._zoomReady = true;
    this._applyZoom();
  }

  /**
   * Keep the number-input spinner increment in sync with the current zoom: the
   * native +/- arrows step by 5 up to 200% and by 10 above it, so coarse steps
   * stay usable near the 800% ceiling without flooding the canvas with redraws.
   */
  _syncZoomInputStep(percent) {
    this.zoomInput.step = Number(percent) > 200 ? '10' : '5';
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
    this.zoomResetBtn?.removeEventListener('click', this._onZoomReset);
    this.zoomInput.removeEventListener('change', this._onZoomInputChange);
    this.zoomInput.removeEventListener('keydown', this._onZoomInputKeydown);
    this.zoomInput.removeEventListener('input', this._onZoomInputLiveInput);
    this.zoomSlider.removeEventListener('input', this._onZoomSliderInput);
    this.viewportEl.removeEventListener('wheel', this._onWheel);
    this.viewportEl.removeEventListener('scroll', this._onGeometryChange);
    globalThis.window?.removeEventListener?.('resize', this._onGeometryChange);
    this._geometryObserver?.disconnect();
    this._geometryObserver = null;
  }
}
