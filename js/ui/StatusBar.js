import { t } from '../i18n/messages.js';

// js/ui/StatusBar.js
export const createStatusBar = ({ pointerEl, selectionEl, canvasSizeEl, flashEl }) => {
  let currentPointer = null;
  let flashTimer = null;

  const setPointer = (pt) => {
    currentPointer = pt;
    pointerEl.textContent = pt ? `Pointer: ${Math.round(pt.x)}, ${Math.round(pt.y)}px` : 'Pointer: -';
  }

  // The selection label is written here, so it must be tagged as a runtime key
  // or LocaleController would revert the text on the next locale change.
  const setSelection = (region) => {
    if (region && region.w && region.h) {
      selectionEl.textContent = `${t('ui.selectionLabel')} ${region.w} × ${region.h}px`;
      selectionEl.setAttribute('data-i18n-runtime', 'ui.selectionLabel');
    } else {
      selectionEl.textContent = '';
      selectionEl.removeAttribute('data-i18n-runtime');
    }
  }

  // Mid-drag the marquee is only an area, not a movable selection. Saying so
  // stops the thin frame reading as "the click did nothing".
  const setMarqueeSelecting = (active) => {
    selectionEl.textContent = active ? t('ui.selectingArea') : '';
    if (active) selectionEl.setAttribute('data-i18n-runtime', 'ui.selectingArea');
    else selectionEl.removeAttribute('data-i18n-runtime');
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
    setMarqueeSelecting,
    setCanvasSize,
    flash,
    get currentPointer() { return currentPointer; },
  });
}
