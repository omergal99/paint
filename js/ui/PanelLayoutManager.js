// Reusable layout controller for dockable application panels.
// The panel itself stays present in the DOM; this class only manages its
// placement, visibility and the always-available restore affordance.

const DEFAULT_LAYOUT = Object.freeze({
  visible: true,
  position: 'top',
  floatX: null,
  floatY: null,
  floatWidth: null,
});
const VALID_POSITIONS = new Set(['top', 'left', 'right', 'bottom', 'float']);

export class PanelLayoutManager {
  constructor({ app, panel, restoreBar, restoreButton, settingsButton, storageKey = 'paint:panel-layout', onChange } = {}) {
    this.app = app;
    this.panel = panel;
    this.restoreBar = restoreBar;
    this.restoreButton = restoreButton;
    this.settingsButton = settingsButton;
    this.storageKey = storageKey;
    this.onChange = onChange;
    this.state = this._read();
    this._destroyed = false;
    this._dragHandle = null;
    this._activeFloatDrag = null;
    this._floatResizeFrame = 0;
    this._onRestoreClick = () => this.setVisible(true);
    this._onSettingsClick = () => this.onChange?.({ ...this.state, action: 'settings' });

    this.restoreButton?.addEventListener('click', this._onRestoreClick);
    this.settingsButton?.addEventListener('click', this._onSettingsClick);
    this._bindFloatDrag();
    this._bindFloatResize();
    this.apply();
  }

  _read() {
    try {
      const value = JSON.parse(localStorage.getItem(this.storageKey) || '{}');
      return {
        visible: value.visible !== false,
        position: VALID_POSITIONS.has(value.position) ? value.position : DEFAULT_LAYOUT.position,
        floatX: Number.isFinite(value.floatX) ? value.floatX : null,
        floatY: Number.isFinite(value.floatY) ? value.floatY : null,
        floatWidth: Number.isFinite(value.floatWidth) && value.floatWidth >= 320 ? value.floatWidth : null,
      };
    } catch {
      return { ...DEFAULT_LAYOUT };
    }
  }

  _write() {
    try { localStorage.setItem(this.storageKey, JSON.stringify(this.state)); } catch {}
  }

  setVisible(visible) {
    this.state.visible = Boolean(visible);
    this.apply();
  }

  setPosition(position) {
    if (!VALID_POSITIONS.has(position)) return;
    this.state.position = position;
    this.apply();
  }

  reset() {
    this.state = { ...DEFAULT_LAYOUT };
    this.apply();
  }

  _bindFloatDrag() {
    const handle = this.panel?.querySelector('#ribbon-drag-handle');
    if (!handle) return;
    this._dragHandle = handle;
    this._onFloatPointerDown = (event) => {
      if (this._destroyed) return;
      if (this.state.position !== 'float' || event.button != null && event.button !== 0) return;
      event.preventDefault();
      const rect = this.panel.getBoundingClientRect();
      const startX = event.clientX;
      const startY = event.clientY;
      const originX = rect.left;
      const originY = rect.top;
      const pointerId = event.pointerId;
      handle.setPointerCapture?.(pointerId);
      this._activeFloatDrag?.stop();
      const onMove = (moveEvent) => {
        if (moveEvent.pointerId !== pointerId) return;
        const x = Math.max(4, Math.min(window.innerWidth - this.panel.offsetWidth - 4, originX + moveEvent.clientX - startX));
        const y = Math.max(4, Math.min(window.innerHeight - this.panel.offsetHeight - 4, originY + moveEvent.clientY - startY));
        this.state.floatX = Math.round(x);
        this.state.floatY = Math.round(y);
        this._applyFloatPosition();
      };
      const stop = () => {
        if (this._activeFloatDrag?.stop !== stop) return;
        handle.removeEventListener('pointermove', onMove);
        handle.removeEventListener('pointerup', stop);
        handle.removeEventListener('pointercancel', stop);
        this._activeFloatDrag = null;
        this._write();
        this.onChange?.({ ...this.state });
      };
      this._activeFloatDrag = { stop };
      handle.addEventListener('pointermove', onMove);
      handle.addEventListener('pointerup', stop, { once: true });
      handle.addEventListener('pointercancel', stop, { once: true });
    };
    handle.addEventListener('pointerdown', this._onFloatPointerDown);
  }

  _applyFloatPosition() {
    if (this.state.position !== 'float') {
      this.panel?.style.removeProperty('left');
      this.panel?.style.removeProperty('top');
      this.panel?.style.removeProperty('transform');
      this.panel?.style.removeProperty('width');
      return;
    }
    if (this.state.floatX != null && this.state.floatY != null) {
      this.panel.style.left = `${this.state.floatX}px`;
      this.panel.style.top = `${this.state.floatY}px`;
      this.panel.style.transform = 'none';
    } else {
      this.panel.style.removeProperty('left');
      this.panel.style.removeProperty('top');
      this.panel.style.removeProperty('transform');
    }
    if (this.state.floatWidth != null) this.panel.style.width = `${this.state.floatWidth}px`;
  }

  _bindFloatResize() {
    if (!this.panel || typeof ResizeObserver === 'undefined') return;
    this._floatResizeObserver = new ResizeObserver(() => {
      if (this._destroyed || this.state.position !== 'float' || this._floatResizeFrame) return;
      this._floatResizeFrame = requestAnimationFrame(() => {
        this._floatResizeFrame = 0;
        if (this._destroyed) return;
        const rect = this.panel.getBoundingClientRect();
        if (rect.width < 320) return;
        this.state.floatWidth = Math.round(rect.width);
        this._write();
        this.onChange?.({ ...this.state });
      });
    });
    this._floatResizeObserver.observe(this.panel);
  }

  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    this.restoreButton?.removeEventListener('click', this._onRestoreClick);
    this.settingsButton?.removeEventListener('click', this._onSettingsClick);
    this._dragHandle?.removeEventListener('pointerdown', this._onFloatPointerDown);
    this._activeFloatDrag?.stop();
    if (this._floatResizeFrame) cancelAnimationFrame(this._floatResizeFrame);
    this._floatResizeFrame = 0;
    this._floatResizeObserver?.disconnect();
    this._floatResizeObserver = null;
  }

  apply() {
    if (!this.app || !this.panel) return;
    ['ribbon-top', 'ribbon-left', 'ribbon-right', 'ribbon-bottom', 'ribbon-float']
      .forEach((className) => this.app.classList.remove(className));
    this.app.classList.add(`ribbon-${this.state.position}`);
    this.app.dataset.ribbonPosition = this.state.position;
    this.panel.hidden = !this.state.visible;
    this.panel.setAttribute('aria-hidden', String(!this.state.visible));
    this._applyFloatPosition();
    if (this.restoreBar) this.restoreBar.hidden = this.state.visible;
    this._write();
    this.onChange?.({ ...this.state });
  }
}

export { DEFAULT_LAYOUT, VALID_POSITIONS };
