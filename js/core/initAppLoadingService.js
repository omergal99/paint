// js/core/initAppLoadingService.js
// Single source of truth for all initial-load masking: canvas overlay + ribbon.
// Both js/app.js (ribbon) and js/main.js (canvas) import from here so there is
// one shared state machine and no duplicated debug-delay logic.
//
// Production: masks are released by their readiness events (paint:image-loaded
// for canvas, paint:ready for ribbon) with zero artificial delay.
// Local debug: append ?debugLoading=1&loadingMs=N to hold both masks open for
// inspection. The delay is capped at 10 seconds.

export const getDebugLoadingDelay = () => {
  const params = new URLSearchParams(globalThis.location?.search || '');
  if (params.get('debugLoading') !== '1') return 0;
  const value = Number(params.get('loadingMs'));
  return Number.isFinite(value) ? Math.min(10000, Math.max(0, Math.round(value))) : 0;
};

let canvasReleased = false;
let ribbonReleased = false;

/** Hide the canvas loading overlay once zoom geometry is final. Idempotent. */
export const releaseCanvasLoading = () => {
  if (canvasReleased) return;
  canvasReleased = true;
  const mask = document.querySelector('.canvas-loading-mask');
  if (mask && !mask.hidden) mask.hidden = true;
};

/** Hide the ribbon startup mask once paint:ready fires. Idempotent. */
export const releaseRibbonLoading = (ribbonEl) => {
  if (ribbonReleased) return;
  ribbonReleased = true;
  ribbonEl?.classList.remove('ribbon-loading');
};

/** True if the canvas loading overlay has been released. */
export const isCanvasReleased = () => canvasReleased;

/** True if the ribbon startup mask has been released. */
export const isRibbonReleased = () => ribbonReleased;
