// js/ui/StatusBar.js
export const createStatusBar = ({ pointerEl, selectionEl, canvasSizeEl, flashEl }) => {
  let currentPointer = null;
  let flashTimer = null;

  const setPointer = (pt) => {
    currentPointer = pt;
    pointerEl.textContent = pt ? `Pointer: ${Math.round(pt.x)}, ${Math.round(pt.y)}px` : 'Pointer: -';
  }

  const setSelection = (region) => {
    selectionEl.textContent = region && region.w && region.h ? `Selection: ${region.w} × ${region.h}px` : '';
  }

  const setCanvasSize = (w, h) => {
    const label = `${w} × ${h}px`;
    // The HTML shell already declares the default 800 × 600 label. Avoid
    // replacing its text node with identical content at startup: it causes an
    // unnecessary paint and can become the late LCP candidate on slow devices.
    if (canvasSizeEl.textContent !== label) canvasSizeEl.textContent = label;
  }

  const flash = (message, ms = 2200) => {
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
