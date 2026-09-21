// js/canvas/CanvasResizer.js
// Adds three draggable handles around the canvas (right edge, bottom edge,
// bottom-right corner). Dragging shows a live ghost outline; releasing commits
// the resize via CanvasManager.resize(), which preserves existing pixels.

export class CanvasResizer {
  constructor({ stage, scaleEl, canvasManager, viewportManager, historyManager, handleRight, handleBottom, handleCorner, ghost }) {
    this.stage = stage; // outer scroll box (sized by ViewportManager.syncStageSize)
    this.scaleEl = scaleEl; // inner image-pixel box (carries the zoom transform)
    this.canvasManager = canvasManager;
    this.viewportManager = viewportManager;
    this.historyManager = historyManager;
    this.ghost = ghost;
    this._destroyed = false;
    this._handleBindings = [];
    this._activeDrag = null;

    this._bindHandle(handleRight, 'x');
    this._bindHandle(handleBottom, 'y');
    this._bindHandle(handleCorner, 'xy');

    this.reposition();
  }

  /** Call after zoom or canvas size changes so handles stay glued to the corner. */
  reposition() {
    if (this._destroyed) return;
    const w = this.canvasManager.width;
    const h = this.canvasManager.height;
    // The inner box keeps image-pixel dimensions so all absolute-positioned
    // handles/ghosts remain in true image coordinates before the zoom scale.
    this.scaleEl.style.width = `${w}px`;
    this.scaleEl.style.height = `${h}px`;
    // The outer stage (scroll extent) follows the scaled canvas size.
    this.viewportManager?.syncStageSize?.();
  }

  _bindHandle(handle, axis) {
    handle.style.touchAction = 'none';
    const onPointerDown = (e) => {
      if (this._destroyed) return;
      if (e.button != null && e.button !== 0) return;
      this._activeDrag?.cleanup();
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startY = e.clientY;
      const startW = this.canvasManager.width;
      const startH = this.canvasManager.height;
      const scale = this.viewportManager.zoom / 100;
      const pointerId = e.pointerId;
      const isRtl = document.documentElement?.dir === 'rtl';
      // In RTL the visual resize edge is the left edge. Keep the existing
      // image content anchored to the right by reversing the horizontal drag
      // sign and asking CanvasManager to prepend the new blank area.
      const horizontalSign = isRtl ? -1 : 1;
      const anchorX = isRtl ? 'right' : 'left';
      // Extra pixels accumulated from the scroll wheel while dragging, so the
      // drag can keep going even when the cursor runs out of screen room.
      let wheelAdjust = 0;
      let dx = 0;
      let dy = 0;

      this.ghost.style.display = 'block';
      this._drawGhost(startW, startH);
      document.body.dataset.resizing = 'true';
      // Prevent the viewport's native scroll from stealing wheel events
      // while dragging - especially at zoom levels below 100% where the
      // scaled canvas overflows its container.
      this.viewportManager?.viewportEl?.classList.add('prevent-scroll');

      const recompute = () => {
        let newW = startW;
        let newH = startH;
        if (axis === 'x' || axis === 'xy') newW = Math.max(1, Math.round(startW + (dx * horizontalSign) + wheelAdjust));
        if (axis === 'y' || axis === 'xy') newH = Math.max(1, Math.round(startH + dy + wheelAdjust));
        this._drawGhost(newW, newH);
      };

      const onMove = (ev) => {
        if (ev.pointerId !== pointerId) return;
        dx = (ev.clientX - startX) / scale;
        dy = (ev.clientY - startY) / scale;
        recompute();
      };

      // Scroll up while dragging shrinks, scroll down grows - so you can keep
      // resizing even after the pointer reaches the edge of the screen.
      const onWheel = (ev) => {
        ev.preventDefault();
        wheelAdjust += ev.deltaY < 0 ? -8 : 8;
        recompute();
      };

      let cleanedUp = false;
      const cleanup = () => {
        if (cleanedUp) return;
        cleanedUp = true;
        handle.removeEventListener('pointermove', onMove);
        handle.removeEventListener('pointerup', onUp);
        handle.removeEventListener('pointercancel', onCancel);
        handle.removeEventListener('lostpointercapture', onCancel);
        document.removeEventListener('wheel', onWheel);
        try {
          handle.releasePointerCapture?.(pointerId);
        } catch {
          // Capture may already have been released by the browser.
        }
        delete document.body.dataset.resizing;
        // Restore native scroll capability on the viewport now that the
        // resize drag is finished.  Without this the viewport would stay
        // un-scrollable if the drag was cancelled (e.g. by pressing Esc).
        this.viewportManager?.viewportEl?.classList.remove('prevent-scroll');
        this.ghost.style.display = 'none';
        if (this._activeDrag?.cleanup === cleanup) this._activeDrag = null;
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
        if (axis === 'x' || axis === 'xy') newW = Math.max(1, Math.round(startW + (ddx * horizontalSign) + wheelAdjust));
        if (axis === 'y' || axis === 'xy') newH = Math.max(1, Math.round(startH + ddy + wheelAdjust));

        if (newW !== startW || newH !== startH) {
          this.historyManager.snapshot();
          this.canvasManager.resize(newW, newH, undefined, { anchorX });
          this.reposition();
        }
      };

      handle.addEventListener('pointermove', onMove);
      handle.addEventListener('pointerup', onUp);
      handle.addEventListener('pointercancel', onCancel);
      handle.addEventListener('lostpointercapture', onCancel);
      document.addEventListener('wheel', onWheel, { passive: false });
      handle.setPointerCapture(pointerId);
      this._activeDrag = { cleanup };
    };
    handle.addEventListener('pointerdown', onPointerDown);
    this._handleBindings.push({ handle, onPointerDown });
  }

  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    this._activeDrag?.cleanup();
    for (const { handle, onPointerDown } of this._handleBindings) {
      handle.removeEventListener('pointerdown', onPointerDown);
    }
    this._handleBindings.length = 0;
  }

  _drawGhost(w, h) {
    this.ghost.style.width = `${w}px`;
    this.ghost.style.height = `${h}px`;
    const isRtl = document.documentElement?.dir === 'rtl';
    this.ghost.style.left = isRtl ? 'auto' : '0';
    this.ghost.style.right = isRtl ? '0' : 'auto';
  }
}
