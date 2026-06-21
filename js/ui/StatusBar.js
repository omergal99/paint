// js/ui/StatusBar.js
export class StatusBar {
  constructor({ pointerEl, selectionEl, canvasSizeEl, flashEl }) {
    this.pointerEl = pointerEl;
    this.selectionEl = selectionEl;
    this.canvasSizeEl = canvasSizeEl;
    this.flashEl = flashEl;
    this._flashTimer = null;
  }

  setPointer(pt) {
    this.pointerEl.textContent = pt ? `Pointer: ${Math.round(pt.x)}, ${Math.round(pt.y)}px` : 'Pointer: —';
  }

  setSelection(region) {
    this.selectionEl.textContent = region && region.w && region.h ? `Selection: ${region.w} × ${region.h}px` : '';
  }

  setCanvasSize(w, h) {
    this.canvasSizeEl.textContent = `${w} × ${h}px`;
  }

  flash(message, ms = 2200) {
    this.flashEl.textContent = message;
    if (this._flashTimer) clearTimeout(this._flashTimer);
    this._flashTimer = setTimeout(() => {
      this.flashEl.textContent = '';
    }, ms);
  }
}
