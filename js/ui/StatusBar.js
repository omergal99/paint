import { t } from '../i18n/messages.js';
import { STATUS_FLASH_DURATION, isValidStatusFlashDuration } from '../core/constants.js';

// js/ui/StatusBar.js
export const createStatusBar = ({
  pointerEl,
  selectionEl,
  canvasSizeEl,
  zoomSliderEl,
  flashEl,
  flashDurationMs = STATUS_FLASH_DURATION.defaultMs,
  showPointer = true,
  showSelection = true,
  showZoomSlider = true,
  onStatus = () => {},
  eventTarget = globalThis.document?.documentElement,
  schedule = globalThis.setTimeout,
  cancel = globalThis.clearTimeout,
}) => {
  let currentPointer = null;
  let flashTimer = null;
  let lastSelection = null;
  let destroyed = false;
  let pointerVisible = showPointer !== false;
  let selectionVisible = showSelection !== false;
  let zoomSliderVisible = showZoomSlider !== false;
  let flashDuration = isValidStatusFlashDuration(flashDurationMs)
    ? Number(flashDurationMs)
    : STATUS_FLASH_DURATION.defaultMs;

  const setConfig = ({
    durationMs = flashDuration,
    pointer = pointerVisible,
    selection = selectionVisible,
    zoomSlider = zoomSliderVisible,
  } = {}) => {
    flashDuration = isValidStatusFlashDuration(durationMs)
      ? Number(durationMs)
      : STATUS_FLASH_DURATION.defaultMs;
    pointerVisible = pointer === true;
    selectionVisible = selection === true;
    zoomSliderVisible = zoomSlider === true;
    if (pointerEl) pointerEl.hidden = !pointerVisible;
    if (selectionEl) selectionEl.hidden = !selectionVisible;
    if (zoomSliderEl) zoomSliderEl.hidden = !zoomSliderVisible;
  };
  setConfig({
    durationMs: flashDuration,
    pointer: pointerVisible,
    selection: selectionVisible,
    zoomSlider: zoomSliderVisible,
  });
  // The live coordinate string must not be re-translated from its initial "-".
  pointerEl?.setAttribute?.('data-i18n-ignore', '');
  pointerEl?.removeAttribute?.('data-i18n-runtime');
  pointerEl?.removeAttribute?.('data-i18n-runtime-source');
  selectionEl?.setAttribute?.('data-i18n-ignore', '');
  selectionEl?.removeAttribute?.('data-i18n-runtime');
  selectionEl?.removeAttribute?.('data-i18n-runtime-source');
  // Flash messages arrive pre-translated (`t('ui.loadedFromHistory')`) and are
  // owned by the timer below. LocaleController's observer auto-stamps any node
  // whose text matches a message key with `data-i18n-runtime`; once stamped,
  // clearing the text makes the controller re-apply the message on the next
  // microtask, so the flash never expires. `data-i18n-ignore` keeps the node
  // out of the controller's hands entirely.
  flashEl?.setAttribute?.('data-i18n-ignore', '');
  flashEl?.removeAttribute?.('data-i18n-runtime');
  flashEl?.removeAttribute?.('data-i18n-runtime-source');

  const setPointer = (pt) => {
    currentPointer = pt;
    pointerEl.textContent = t('status.pointer', {
      position: pt ? `${Math.round(pt.x)}, ${Math.round(pt.y)}px` : '-',
    });
  }

  // The label mixes a translated word with a live measurement ("Selection: 120 ×
  // 80px"). `data-i18n-runtime` cannot be used here: it makes LocaleController
  // replace the node with the key's text alone, silently dropping the
  // measurement. The status bar therefore owns this string, keeps its own copy of
  // the region, and re-renders itself on every locale change instead.
  const setSelection = (region) => {
    lastSelection = region && region.w && region.h ? region : null;
    selectionEl?.removeAttribute?.('data-i18n-runtime');
    selectionEl?.removeAttribute?.('data-i18n-runtime-source');
    if (selectionEl) selectionEl.textContent = lastSelection
      ? `${t('ui.selectionLabel')} ${lastSelection.w} × ${lastSelection.h}px`
      : '';
  }

  const refresh = () => {
    setPointer(currentPointer);
    setSelection(lastSelection);
  };
  eventTarget?.addEventListener?.('paint:locale-change', refresh);

  // Mid-drag the marquee is only an area, not a movable selection. Saying so
  // stops the thin frame reading as "the click did nothing". Releasing hands the
  // slot back to the caller, which restores the real selection label.
  const setMarqueeSelecting = (active) => {
    if (!selectionEl) return;
    if (!active) {
      selectionEl.textContent = '';
      selectionEl?.removeAttribute?.('data-i18n-runtime');
      selectionEl?.removeAttribute?.('data-i18n-runtime-source');
      return;
    }
    selectionEl.textContent = t('ui.selectingArea');
    selectionEl?.removeAttribute?.('data-i18n-runtime');
    selectionEl?.removeAttribute?.('data-i18n-runtime-source');
  }

  const setCanvasSize = (w, h) => {
    const label = `${w} × ${h}px`;
    // The HTML shell already declares the default 800 × 600 label. Avoid
    // replacing its text node with identical content at startup: it causes an
    // unnecessary paint and can become the late LCP candidate on slow devices.
    if (canvasSizeEl.textContent !== label) canvasSizeEl.textContent = label;
  }

  const clearFlash = () => {
    if (flashTimer !== null) cancel(flashTimer);
    flashTimer = null;
    if (flashEl) flashEl.textContent = '';
  };

  const flash = (message, ms) => {
    if (destroyed || !flashEl) return;
    clearFlash();
    flashEl.textContent = message;
    onStatus({ message: String(message), timestamp: new Date().toISOString() });
    if (ms === undefined) ms = flashDuration;
    if (Number(ms) === 0) return;
    flashTimer = schedule(() => {
      flashTimer = null;
      if (!destroyed) flashEl.textContent = '';
    }, ms);
  }

  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    eventTarget?.removeEventListener?.('paint:locale-change', refresh);
    clearFlash();
  };

  return Object.freeze({
    setPointer,
    setSelection,
    setMarqueeSelecting,
    refresh,
    setCanvasSize,
    flash,
    clearFlash,
    destroy,
    setConfig,
    get currentPointer() { return currentPointer; },
  });
}
