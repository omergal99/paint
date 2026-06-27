// js/tools/SelectTool.js
// Default tool. Drag on empty canvas to draw a marquee. Drag inside an existing
// selection to move it (lifting the pixels and leaving a background-color hole,
// same as classic Paint's "move selection" behavior).

export class SelectTool {
  constructor() {
    this.name = 'select';
    this.cursor = 'crosshair';
    this._start = null;
    this._moving = false;
    this._liftedOrigin = null;
  }

  onActivate(ctx) {
    // Keep selection if it's already floating (e.g. on paste), otherwise do nothing.
  }

  onDeactivate(ctx) {
    ctx.commitFloatingSelection();
  }

  onDown(pt, ctx) {
    const sel = ctx.getSelection();
    if (sel && this._inside(pt, sel)) {
      // Begin moving the existing selection.
      this._moving = true;
      this._start = pt;
      this._liftedOrigin = { x: sel.x, y: sel.y };

      // If it's not floating yet, lift the pixels now!
      if (!ctx.canvasManager.floatingCanvas) {
        ctx.historyManager.snapshot();
        ctx.canvasManager.floatingCanvas = ctx.canvasManager.extractRegion(sel);
        ctx.canvasManager.fillRegion(sel, ctx.canvasManager.backgroundColor);
      }
      return;
    }

    // Clicked outside: commit the existing floating selection first!
    ctx.commitFloatingSelection();

    // Start drawing a new marquee box.
    this._moving = false;
    this._start = pt;
    ctx.setSelection({ x: Math.round(pt.x), y: Math.round(pt.y), w: 0, h: 0 });
  }

  onMove(pt, ctx) {
    if (!this._start) return;
    if (this._moving) {
      const dx = Math.round(pt.x - this._start.x);
      const dy = Math.round(pt.y - this._start.y);
      const x = this._liftedOrigin.x + dx;
      const y = this._liftedOrigin.y + dy;
      
      // Update coordinates of the selection. Since setSelection draws floatingCanvas at new coordinates on the overlay, this is all we need!
      ctx.setSelection({ x, y, w: ctx.canvasManager.floatingCanvas.width, h: ctx.canvasManager.floatingCanvas.height });
      return;
    }
    const x = Math.min(this._start.x, pt.x);
    const y = Math.min(this._start.y, pt.y);
    const w = Math.abs(pt.x - this._start.x);
    const h = Math.abs(pt.y - this._start.y);
    ctx.setSelection({ x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) });
  }

  onUp(pt, ctx) {
    if (this._moving) {
      this._moving = false;
    } else {
      // If we were drawing a marquee, check if it has 0 area.
      const sel = ctx.getSelection();
      if (sel && (sel.w === 0 || sel.h === 0)) {
        ctx.setSelection(null);
      }
    }
    this._start = null;
  }

  _inside(pt, sel) {
    return pt.x >= sel.x && pt.x <= sel.x + sel.w && pt.y >= sel.y && pt.y <= sel.y + sel.h;
  }
}
