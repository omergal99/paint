// js/canvas/ViewportManager.js
// Handles zoom. Unlike real Windows Paint, the percentage field is directly
// editable (per the brief) in addition to +/- buttons and Ctrl+Scroll.
// The last zoom is persisted so a page refresh returns to the same size
// (instead of resetting to 100%).
//
// Layout model (two nested boxes, so scrollbars always match the canvas):
//   .canvas-stage  — OUTER box. Sized by syncStageSize() to the *scaled*
//                    canvas size (canvasSize × zoom). It defines the scrollable
//                    extent of the viewport, so there is no dead gray space
//                    when zoomed out and full panning room when zoomed in.
//   #canvas-scale  — INNER box. Keeps image-pixel dimensions (set by
//                    CanvasResizer) and carries the CSS `scale()` transform.
//                    All drawing/handle math stays in true image coordinates.

const MIN_ZOOM = 10;
const MAX_ZOOM = 800;
const STEP = 10;
const ZOOM_STORAGE_KEY = 'paint:zoom';

export class ViewportManager {
  constructor({ stage, scaleEl, canvasManager, zoomInBtn, zoomOutBtn, zoomInput, zoomSlider }) {
    this.stage = stage; // outer box — sized to the scaled canvas (scroll extent)
    this.scaleEl = scaleEl; // inner box — image-pixel size + zoom transform
    this.viewportEl = stage.parentElement; // the scrollable viewport wrapper
    this.canvasManager = canvasManager;
    this.zoomInBtn = zoomInBtn;
    this.zoomOutBtn = zoomOutBtn;
    this.zoomInput = zoomInput;
    this.zoomSlider = zoomSlider;
    this.zoom = this._restoreZoom(); // percent

    this.onZoomChange = null; // callback(zoomPercent)

    this.zoomInBtn.addEventListener('click', () => this.setZoom(this.zoom + STEP));
    this.zoomOutBtn.addEventListener('click', () => this.setZoom(this.zoom - STEP));

    this.zoomInput.addEventListener('change', () => {
      const val = parseInt(this.zoomInput.value, 10);
      if (!Number.isNaN(val)) this.setZoom(val);
      else this.zoomInput.value = this.zoom;
    });
    this.zoomInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.zoomInput.blur();
    });

    this.zoomSlider.addEventListener('input', () => this.setZoom(parseInt(this.zoomSlider.value, 10)));

    // Plain wheel scrolls the viewport natively — it must NEVER change the
    // zoom, otherwise trying to pan while selecting/resizing moves the view
    // instead of the scroll position. Ctrl/Cmd+wheel zooms (the standard
    // convention, and what Windows Paint itself uses). While a canvas resize
    // drag is active the resize handles own the wheel instead, so we skip
    // zooming then to avoid fighting with the drag.
    this.viewportEl.addEventListener(
      'wheel',
      (e) => {
        if (document.body.dataset.resizing === 'true') return;
        if (!e.ctrlKey && !e.metaKey) return; // let native scroll happen
        e.preventDefault();
        this.setZoom(this.zoom + (e.deltaY < 0 ? STEP : -STEP));
      },
      { passive: false }
    );

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
  }

  _restoreZoom() {
    try {
      const saved = localStorage.getItem(ZOOM_STORAGE_KEY);
      const parsed = parseInt(saved, 10);
      if (Number.isNaN(parsed)) return 100;
      return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, parsed));
    } catch {
      return 100;
    }
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
    this.zoomInput.value = this.zoom;
    this.zoomSlider.value = this.zoom;
    this.syncStageSize();
  }

  /** Convert a client (mouse) coordinate to true image-pixel coordinates. */
  clientToImage(clientX, clientY) {
    const rect = this.canvasManager.canvas.getBoundingClientRect();
    const scale = this.zoom / 100;
    return {
      x: (clientX - rect.left) / scale,
      y: (clientY - rect.top) / scale,
    };
  }
}
