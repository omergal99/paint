import { t } from '../i18n/messages.js';

// js/ui/StatusBar.js
export const createStatusBar = ({ pointerEl, selectionEl, canvasSizeEl, flashEl, eventTarget = globalThis }) => {
  let currentPointer = null;
  let flashTimer = null;
  let lastSelection = null;

  const setPointer = (pt) => {
    currentPointer = pt;
    pointerEl.textContent = pt ? `Pointer: ${Math.round(pt.x)}, ${Math.round(pt.y)}px` : 'Pointer: -';
  }

  // The label mixes a translated word with a live measurement ("Selection: 120 ×
  // 80px"). `data-i18n-runtime` cannot be used here: it makes LocaleController
  // replace the node with the key's text alone, silently dropping the
  // measurement. The status bar therefore owns this string, keeps its own copy of
  // the region, and re-renders itself on every locale change instead.
  const setSelection = (region) => {
    lastSelection = region && region.w && region.h ? region : null;
    selectionEl.textContent = lastSelection
      ? `${t('ui.selectionLabel')} ${lastSelection.w} × ${lastSelection.h}px`
      : '';
  }

  const refresh = () => setSelection(lastSelection);
  eventTarget?.documentElement?.addEventListener?.('paint:locale-change', refresh);

  // Mid-drag the marquee is only an area, not a movable selection. Saying so
  // stops the thin frame reading as "the click did nothing". Releasing hands the
  // slot back to the caller, which restores the real selection label.
  const setMarqueeSelecting = (active) => {
    if (!active) {
      selectionEl.textContent = '';
      selectionEl.removeAttribute('data-i18n-runtime');
      return;
    }
    selectionEl.textContent = t('ui.selectingArea');
    selectionEl.setAttribute('data-i18n-runtime', 'ui.selectingArea');
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
    refresh,
    setCanvasSize,
    flash,
    get currentPointer() { return currentPointer; },
  });
}
