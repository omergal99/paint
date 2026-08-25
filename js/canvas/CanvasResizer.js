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
      // Extra pixels accumulated from the scroll wheel while dragging, so the
      // drag can keep going even when the cursor runs out of screen room.
      let wheelAdjust = 0;
      let dx = 0;
      let dy = 0;

      this.ghost.style.display = 'block';
      this._drawGhost(startW, startH);
      document.body.dataset.resizing = 'true';

      const recompute = () => {
        let newW = startW;
        let newH = startH;
        if (axis === 'x' || axis === 'xy') newW = Math.max(1, Math.round(startW + dx + wheelAdjust));
        if (axis === 'y' || axis === 'xy') newH = Math.max(1, Math.round(startH + dy + wheelAdjust));
        this._drawGhost(newW, newH);
      };

      const onMove = (ev) => {
        if (ev.pointerId !== pointerId) return;
        dx = (ev.clientX - startX) / scale;
        dy = (ev.clientY - startY) / scale;
        recompute();
      };

      // Scroll up while dragging shrinks, scroll down grows — so you can keep
      // resizing even after the pointer reaches the edge of the screen.
      const onWheel = (ev) => {
        ev.preventDefault();
        wheelAdjust += ev.deltaY < 0 ? -8 : 8;
        recompute();
      };

      const cleanup = () => {
        handle.removeEventListener('pointermove', onMove);
        handle.removeEventListener('pointerup', onUp);
        handle.removeEventListener('pointercancel', onCancel);
        handle.removeEventListener('lostpointercapture', onCancel);
        document.removeEventListener('wheel', onWheel);
        delete document.body.dataset.resizing;
        this.ghost.style.display = 'none';
      };

      const onCancel = (ev) => {
        if (ev?.pointerId != null && ev.pointerId !== pointerId) return;
        cleanup();
      };

      const onUp = (ev) => {
        if (ev.pointerId !== pointerId) return;
        cleanup();

        const ddx = (ev.clientX - startX) / scale;
        const ddy = (ev.clientY - startY) / scale;
        let newW = startW;
        let newH = startH;
        if (axis === 'x' || axis === 'xy') newW = Math.max(1, Math.round(startW + ddx + wheelAdjust));
        if (axis === 'y' || axis === 'xy') newH = Math.max(1, Math.round(startH + ddy + wheelAdjust));

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
      document.addEventListener('wheel', onWheel, { passive: false });
      handle.setPointerCapture(pointerId);
    });
  }

  _drawGhost(w, h) {
    this.ghost.style.width = `${w}px`;
    this.ghost.style.height = `${h}px`;
  }
}
