// js/canvas/ViewportManager.js
// Handles zoom. Unlike real Windows Paint, the percentage field is directly
// editable (per the brief) in addition to +/- buttons and Ctrl+Scroll.

const MIN_ZOOM = 10;
const MAX_ZOOM = 800;
const STEP = 10;

export class ViewportManager {
  constructor({ stage, canvasManager, zoomInBtn, zoomOutBtn, zoomInput, zoomSlider }) {
    this.stage = stage; // the element whose CSS transform we scale (wraps canvas+overlay)
    this.canvasManager = canvasManager;
    this.zoomInBtn = zoomInBtn;
    this.zoomOutBtn = zoomOutBtn;
    this.zoomInput = zoomInput;
    this.zoomSlider = zoomSlider;
    this.zoom = 100; // percent

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

    this.stage.parentElement.addEventListener(
      'wheel',
      (e) => {
        if (!e.ctrlKey) return;
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
    if (this.onZoomChange) this.onZoomChange(this.zoom);
  }

  _applyZoom() {
    const scale = this.zoom / 100;
    this.stage.style.transform = `scale(${scale})`;
    this.zoomInput.value = this.zoom;
    this.zoomSlider.value = this.zoom;
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
