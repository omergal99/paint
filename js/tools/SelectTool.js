// js/tools/SelectTool.js
// Default tool. Drag on empty canvas to draw a marquee. Drag inside an existing
// selection to move it (lifting the pixels and leaving a background-color hole,
// same as classic Paint's "move selection" behavior).

export const createSelectTool = () => {
  const state = { start: null, moving: false, liftedOrigin: null };

  const onActivate = (ctx) => {
    // Keep selection if it's already floating (e.g. on paste). Also drop any
    // gesture state a mid-gesture tool switch may have left behind - otherwise
    // the next plain mouse move would ghost-draw a marquee from a stale
    // pointerdown point.
    state.start = null;
    state.moving = false;
    ctx.setMarqueeStatus?.(false);
  }

  const onDeactivate = (ctx) => {
    ctx.setMarqueeStatus?.(false);
    ctx.commitFloatingSelection();
  }

  const onDown = (pt, ctx) => {
    // A normal pixel selection must own any committed text pixels first.
    // Text focus targets do not reach this surface, so moving text itself never
    // takes this path.
    ctx.flattenLayers?.();
    const sel = ctx.getSelection();
    if (sel && inside(pt, sel)) {
      // Begin moving the existing selection.
      state.moving = true;
      state.start = pt;
      state.liftedOrigin = { x: sel.x, y: sel.y };

      // If it's not floating yet, lift the pixels now. The whole move is one
      // atomic history entry: `beginTransaction` captures the "before" pixels
      // and the entry is recorded when the selection is committed, so a single
      // Ctrl+Z steps back over the entire move instead of half of it.
      if (!ctx.canvasManager.floatingCanvas) {
        ctx.historyManager.beginTransaction();
        ctx.canvasManager.floatingCanvas = ctx.canvasManager.extractRegion(sel);
        ctx.canvasManager.fillRegion(sel, ctx.canvasManager.backgroundColor);
        // Re-composite the lifted pixels onto the overlay straight away.
        // Without this the region showed the background fill (usually white)
        // from pointerdown until the first pointermove, which is the "white
        // flash" when clicking inside an active selection.
        ctx.setSelection({ ...sel });
      }
      return;
    }

    // Clicked outside: commit the existing floating selection first!
    ctx.commitFloatingSelection();

    // Start drawing a new marquee box. Tell the user a gesture is in progress:
    // until the pointer is released this region only defines an area and its
    // pixels cannot be moved yet.
    state.moving = false;
    state.start = pt;
    ctx.setMarqueeStatus?.(true);
    ctx.setSelection({ x: Math.round(pt.x), y: Math.round(pt.y), w: 0, h: 0 });
  }

  const onMove = (pt, ctx) => {
    if (!state.start) return;
    // A *new* marquee may only define an area inside the canvas: dragging past
    // the edge must not create a selection that hangs over the border. Moving an
    // existing float is deliberately NOT clamped here, so a drag can push it
    // off-canvas exactly like the arrow-key nudge does.
    const bound = (value, limit) => Math.max(0, Math.min(limit, value));
    if (state.moving) {
      const dx = Math.round(pt.x - state.start.x);
      const dy = Math.round(pt.y - state.start.y);
      const x = state.liftedOrigin.x + dx;
      const y = state.liftedOrigin.y + dy;
      ctx.historyManager.setTransactionChanged?.(Boolean(dx || dy));
      // Update coordinates of the selection. Since setSelection draws floatingCanvas at new coordinates on the overlay, this is all we need!
      ctx.setSelection({ x, y, w: ctx.canvasManager.floatingCanvas.width, h: ctx.canvasManager.floatingCanvas.height });
      return;
    }
    const x = Math.min(state.start.x, pt.x);
    const y = Math.min(state.start.y, pt.y);
    const w = Math.abs(pt.x - state.start.x);
    const h = Math.abs(pt.y - state.start.y);
    // Clamp the marquee rectangle itself to the canvas, so neither edge can be
    // dragged past the border.
    const limitW = ctx.canvasManager.width;
    const limitH = ctx.canvasManager.height;
    const rx = bound(x, limitW);
    const ry = bound(y, limitH);
    const rw = Math.min(w, limitW - rx);
    const rh = Math.min(h, limitH - ry);
    ctx.setSelection({ x: Math.round(rx), y: Math.round(ry), w: Math.round(rw), h: Math.round(rh) });
  }

  const onUp = (pt, ctx) => {
    // Clear the marquee indicator before any early return: a gesture that ends
    // without a start (tool switched mid-drag, cancelled pointer) would otherwise
    // leave "Selecting..." stuck in the status bar forever.
    ctx.setMarqueeStatus?.(false);
        // Lifting the pixels switches the selection into the "active float" mode,
        // which changes the frame colour and stroke. `setSelection` below already
        // repaints, and the early return here would skip it, so ask for a repaint.
        ctx.repaintSelectionFrame?.();
        if (!state.start) return;
    if (state.moving) {
      state.moving = false;
      ctx.canvasManager.persistToStorage();
    } else {
      // If we were drawing a marquee, check if it has 0 area.
      const sel = ctx.getSelection();
      if (sel && (sel.w === 0 || sel.h === 0)) {
        ctx.setSelection(null);
      }
    }
    state.start = null;
  }

  const onCancel = (_pt, ctx) => {
    if (!state.moving) ctx.setSelection(null);
    ctx.setMarqueeStatus?.(false);
    state.start = null;
    state.moving = false;
    state.liftedOrigin = null;
  }

  const inside = (pt, sel) => {
    return pt.x >= sel.x && pt.x <= sel.x + sel.w && pt.y >= sel.y && pt.y <= sel.y + sel.h;
  }

  return { name: 'select', cursor: 'crosshair', onActivate, onDeactivate, onDown, onMove, onUp, onCancel, _inside: inside };
}
