// js/canvas/CanvasResizer.js
// Adds three draggable handles around the canvas (right edge, bottom edge,
// bottom-right corner). Dragging shows a live ghost outline; releasing commits
// the resize via CanvasManager.resize(), which preserves existing pixels.

export class CanvasResizer {
  constructor({ stage, canvasManager, viewportManager, historyManager, handleRight, handleBottom, handleCorner, ghost }) {
    this.stage = stage;
    this.canvasManager = canvasManager;
    this.viewportManager = viewportManager;
    this.historyManager = historyManager;
    this.ghost = ghost;

    this._bindHandle(handleRight, 'x');
    this._bindHandle(handleBottom, 'y');
    this._bindHandle(handleCorner, 'xy');

    this.reposition();
  }

  /** Call after zoom or canvas size changes so handles stay glued to the corner. */
  reposition() {
    const w = this.canvasManager.width;
    const h = this.canvasManager.height;
    this.stage.style.width = `${w}px`;
    this.stage.style.height = `${h}px`;
  }

  _bindHandle(handle, axis) {
    handle.style.touchAction = 'none';
    handle.addEventListener('pointerdown', (e) => {
      if (e.button != null && e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startY = e.clientY;
      const startW = this.canvasManager.width;
      const startH = this.canvasManager.height;
      const scale = this.viewportManager.zoom / 100;
      const pointerId = e.pointerId;

      this.ghost.style.display = 'block';
      this._drawGhost(startW, startH);

      const onMove = (ev) => {
        if (ev.pointerId !== pointerId) return;
        const dx = (ev.clientX - startX) / scale;
        const dy = (ev.clientY - startY) / scale;
        let newW = startW;
        let newH = startH;
        if (axis === 'x' || axis === 'xy') newW = Math.max(1, Math.round(startW + dx));
        if (axis === 'y' || axis === 'xy') newH = Math.max(1, Math.round(startH + dy));
        this._drawGhost(newW, newH);
      };

      const cleanup = () => {
        handle.removeEventListener('pointermove', onMove);
        handle.removeEventListener('pointerup', onUp);
        handle.removeEventListener('pointercancel', onCancel);
        handle.removeEventListener('lostpointercapture', onCancel);
        this.ghost.style.display = 'none';
      };

      const onCancel = (ev) => {
        if (ev?.pointerId != null && ev.pointerId !== pointerId) return;
        cleanup();
      };

      const onUp = (ev) => {
        if (ev.pointerId !== pointerId) return;
        cleanup();

        const dx = (ev.clientX - startX) / scale;
        const dy = (ev.clientY - startY) / scale;
        let newW = startW;
        let newH = startH;
        if (axis === 'x' || axis === 'xy') newW = Math.max(1, Math.round(startW + dx));
        if (axis === 'y' || axis === 'xy') newH = Math.max(1, Math.round(startH + dy));

        if (newW !== startW || newH !== startH) {
          this.historyManager.snapshot();
          this.canvasManager.resize(newW, newH);
          this.reposition();
        }
      };

      handle.addEventListener('pointermove', onMove);
      handle.addEventListener('pointerup', onUp);
      handle.addEventListener('pointercancel', onCancel);
      handle.addEventListener('lostpointercapture', onCancel);
      handle.setPointerCapture(pointerId);
    });
  }

  _drawGhost(w, h) {
    this.ghost.style.width = `${w}px`;
    this.ghost.style.height = `${h}px`;
  }
}
