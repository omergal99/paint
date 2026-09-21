// js/tools/ToolManager.js
// Each tool implements: { name, cursor, onDown(pt, ctx), onMove(pt, ctx), onUp(pt, ctx) }
// `pt` is {x, y, button} in true image-pixel coordinates (zoom already divided out).
// `ctx` is a small bag of shared collaborators (canvasManager, historyManager, etc).

export class ToolManager {
  constructor({
    surface,
    viewportManager,
    toolContext,
    statusBar,
    eventTarget = globalThis.window,
    requestFrame = globalThis.requestAnimationFrame?.bind(globalThis),
    cancelFrame = globalThis.cancelAnimationFrame?.bind(globalThis),
  }) {
    this.surface = surface; // the element that receives pointer events (overlay canvas)
    this.viewportManager = viewportManager;
    this.toolContext = toolContext;
    this.statusBar = statusBar;
    this.tools = new Map();
    this.active = null;
    this._dragging = false;
    this._activePointerId = null;
    this._queuedMove = null;
    this._frameHandle = null;
    this._eventTarget = eventTarget;
    this._windowFallbackAttached = false;
    this._destroyed = false;
    this._requestFrame = typeof requestFrame === 'function'
      ? requestFrame
      : (callback) => globalThis.setTimeout(() => callback(Date.now()), 16);
    this._cancelFrame = typeof cancelFrame === 'function'
      ? cancelFrame
      : globalThis.clearTimeout.bind(globalThis);

    this.onToolChange = null; // callback(toolName)

    // One named, rAF-coalesced pointer path keeps drawing and status updates in
    // sync. Pointer capture normally keeps end/cancel events on the surface;
    // the window fallback exists only for browsers where capture is unavailable.
    this._onContextMenu = (event) => event.preventDefault();
    this._onPointerDown = (event) => this._startPointer(event);
    this._onPointerMove = (event) => this._queuePointerMove(event);
    this._onPointerUp = (event) => this._finishPointer(event);
    this._onPointerCancel = (event) => this._finishPointer(event, { cancelled: true });
    this._onLostPointerCapture = (event) => this._finishPointer(event, { cancelled: true });
    this._onPointerLeave = () => {
      if (!this._dragging) this._cancelQueuedMove();
      this.statusBar?.setPointer(null);
    };

    surface.addEventListener('contextmenu', this._onContextMenu);
    surface.addEventListener('pointerdown', this._onPointerDown);
    surface.addEventListener('pointermove', this._onPointerMove);
    surface.addEventListener('pointerup', this._onPointerUp);
    surface.addEventListener('pointercancel', this._onPointerCancel);
    surface.addEventListener('lostpointercapture', this._onLostPointerCapture);
    surface.addEventListener('pointerleave', this._onPointerLeave);
  }

  register(tool) {
    this.tools.set(tool.name, tool);
  }

  setActive(name) {
    if (this._destroyed) return;
    if (this.active?.onDeactivate) this.active.onDeactivate(this.toolContext);
    this.active = this.tools.get(name) || null;
    if (this.active) {
      this.surface.style.cursor = this.active.cursor || 'default';
      if (this.active.onActivate) this.active.onActivate(this.toolContext);
    }
    if (this.onToolChange) this.onToolChange(name);
  }

  _point(e) {
    const { x, y } = this.viewportManager.clientToImage(e.clientX, e.clientY);
    return { x, y, button: e.button };
  }

  _handle(method, e, point = this._point(e)) {
    if (!this.active || !this.active[method]) return;
    if (method === 'onDown') this._dragging = true;
    this.active[method](point, this.toolContext, e);
    if (method === 'onUp') this.toolContext?.canvasManager?.persistToStorage?.();
  }

  _startPointer(event) {
    if (this._destroyed) return;
    if (this._activePointerId !== null && event.pointerId !== this._activePointerId) return;
    // A hover packet from another pointer may still be waiting for a frame.
    // It must not be delivered after this pointer takes ownership of a drag.
    this._cancelQueuedMove();
    event.preventDefault?.();
    this._activePointerId = event.pointerId;
    let captured = false;
    try {
      if (typeof this.surface.setPointerCapture !== 'function') throw new Error('Pointer capture unavailable');
      this.surface.setPointerCapture(event.pointerId);
      captured = true;
    } catch {}
    if (!captured) this._attachWindowPointerFallback();
    this._handle('onDown', event);
  }

  _queuePointerMove(event) {
    if (this._destroyed) return;
    // Once a drag owns the surface, only its packets may replace the pending
    // frame. Otherwise a second touch/stylus could be flushed after the owner
    // finishes, causing a late draw or status update.
    if (this._activePointerId !== null && event.pointerId !== this._activePointerId) return;
    // Keep only the newest browser packet until the next frame. The packet can
    // still expose its ordered getCoalescedEvents() samples for high-fidelity
    // pen/stylus strokes, without running duplicate status/geometry work.
    this._queuedMove = event;
    if (this._frameHandle !== null) return;
    this._frameHandle = this._requestFrame(() => {
      this._frameHandle = null;
      this._flushQueuedMove();
    });
  }

  _flushQueuedMove(pointerId) {
    const event = this._queuedMove;
    if (!event || (pointerId !== undefined && event.pointerId !== pointerId)) return false;
    this._queuedMove = null;
    if (this._frameHandle !== null) {
      this._cancelFrame(this._frameHandle);
      this._frameHandle = null;
    }
    let samples = [event];
    try {
      const coalesced = event.getCoalescedEvents?.();
      if (coalesced?.length) samples = [...coalesced];
    } catch {}
    let finalPoint = null;
    samples.forEach((sample) => {
      const point = this._point(sample);
      this._handle('onMove', sample, point);
      finalPoint = point;
    });
    if (finalPoint) this.statusBar?.setPointer(finalPoint);
    return true;
  }

  _cancelQueuedMove(pointerId) {
    if (this._queuedMove && (pointerId === undefined || this._queuedMove.pointerId === pointerId)) {
      this._queuedMove = null;
    }
    if (this._queuedMove || this._frameHandle === null) return;
    this._cancelFrame(this._frameHandle);
    this._frameHandle = null;
  }

  _finishPointer(event, { cancelled = false } = {}) {
    if (this._activePointerId === null || event.pointerId !== this._activePointerId) return false;
    this._flushQueuedMove(event.pointerId);
    const point = this._point(event);
    if (this._dragging) {
      if (cancelled) this.active?.onCancel?.(point, this.toolContext, event);
      else this._handle('onUp', event, point);
    }
    this._dragging = false;
    this._activePointerId = null;
    this._releasePointer(event.pointerId);
    this._detachWindowPointerFallback();

    // A tool restore deferred by a mid-gesture commit (select-after-draw
    // click-outside) is applied only after the owning tool finished its own
    // onUp, so gesture state is always cleaned up before the switch.
    const pending = this.toolContext?._pendingToolRestore;
    if (cancelled) {
      if (this.toolContext) this.toolContext._pendingToolRestore = null;
    } else if (pending) {
      this.toolContext._pendingToolRestore = null;
      this.setActive(pending);
    }
    return true;
  }

  _attachWindowPointerFallback() {
    if (this._windowFallbackAttached || !this._eventTarget?.addEventListener) return;
    this._eventTarget.addEventListener('pointerup', this._onPointerUp);
    this._eventTarget.addEventListener('pointercancel', this._onPointerCancel);
    this._windowFallbackAttached = true;
  }

  _detachWindowPointerFallback() {
    if (!this._windowFallbackAttached || !this._eventTarget?.removeEventListener) return;
    this._eventTarget.removeEventListener('pointerup', this._onPointerUp);
    this._eventTarget.removeEventListener('pointercancel', this._onPointerCancel);
    this._windowFallbackAttached = false;
  }

  _releasePointer(pointerId) {
    try {
      this.surface.releasePointerCapture?.(pointerId);
    } catch {}
  }

  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    this._cancelQueuedMove();
    this._detachWindowPointerFallback();
    this.surface.removeEventListener('contextmenu', this._onContextMenu);
    this.surface.removeEventListener('pointerdown', this._onPointerDown);
    this.surface.removeEventListener('pointermove', this._onPointerMove);
    this.surface.removeEventListener('pointerup', this._onPointerUp);
    this.surface.removeEventListener('pointercancel', this._onPointerCancel);
    this.surface.removeEventListener('lostpointercapture', this._onLostPointerCapture);
    this.surface.removeEventListener('pointerleave', this._onPointerLeave);
    this._dragging = false;
    this._activePointerId = null;
    this._queuedMove = null;
    this.statusBar?.setPointer(null);
  }
}
