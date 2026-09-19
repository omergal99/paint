// js/ui/StatusBar.js
export function createStatusBar({ pointerEl, selectionEl, canvasSizeEl, flashEl }) {
  let currentPointer = null;
  let flashTimer = null;

  function setPointer(pt) {
    currentPointer = pt;
    pointerEl.textContent = pt ? `Pointer: ${Math.round(pt.x)}, ${Math.round(pt.y)}px` : 'Pointer: —';
  }

  function setSelection(region) {
    selectionEl.textContent = region && region.w && region.h ? `Selection: ${region.w} × ${region.h}px` : '';
  }

  function setCanvasSize(w, h) {
    canvasSizeEl.textContent = `${w} × ${h}px`;
  }

  function flash(message, ms = 2200) {
    flashEl.textContent = message;
    if (flashTimer) clearTimeout(flashTimer);
    flashTimer = setTimeout(() => {
      flashEl.textContent = '';
    }, ms);
  }

  return Object.freeze({
    setPointer,
    setSelection,
    setCanvasSize,
    flash,
    get currentPointer() { return currentPointer; },
  });
}
