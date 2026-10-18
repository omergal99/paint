// js/core/initAppLoadingService.js
// Single source of truth for all initial-load masking: canvas overlay + ribbon.
// Both js/app.js (ribbon) and js/main.js (canvas) import from here so there is
// one shared state machine and no duplicated debug-delay logic.
//
// Production: masks are released by their readiness events (paint:image-loaded
// for canvas, paint:ready for ribbon) with zero artificial delay.
// Local debug: append ?debugLoading=1&loadingMs=N to hold both masks open for
// inspection. The delay is capped at 10 seconds.
//
// Dev-only loading hold: set DEV_LOADING_HOLD = true to keep the canvas loading
// mask on screen indefinitely for manual inspection. This bypasses both the
// auto-release fallback timer and releaseCanvasLoading()/releaseRibbonLoading()
// so the UI stays masked until you flip the flag back to false and reload.
// Change this constant directly in the source (not an env var). CI fails if it
// is true when committed.
export const DEV_LOADING_HOLD = false;

/** True when the dev loading hold is active (loading masks stay open). */
export const isDevLoadingHold = () => DEV_LOADING_HOLD;

export const getDebugLoadingDelay = () => {
  const params = new URLSearchParams(globalThis.location?.search || '');
  if (params.get('debugLoading') !== '1') return 0;
  const value = Number(params.get('loadingMs'));
  return Number.isFinite(value) ? Math.min(10000, Math.max(0, Math.round(value))) : 0;
};

let canvasReleased = false;
let ribbonReleased = false;

// Safety net: if the readiness events never fire, the canvas loading mask
// would stay on screen forever. Release it automatically after a bounded
// window so users are never blocked by a stuck overlay.
const CANVAS_RELEASE_FALLBACK_MS = 10000;
/** @type {ReturnType<typeof setTimeout> | null} */
let canvasReleaseFallbackTimer = null;

const startCanvasReleaseFallback = () => {
  if (DEV_LOADING_HOLD) return; // Hold loading open for dev inspection
  if (canvasReleaseFallbackTimer) return;
  canvasReleaseFallbackTimer = setTimeout(() => {
    releaseCanvasLoading();
  }, CANVAS_RELEASE_FALLBACK_MS);
};

/** Hide the canvas loading overlay once zoom geometry is final. Idempotent. */
export const releaseCanvasLoading = () => {
  if (DEV_LOADING_HOLD) return; // Hold loading open for dev inspection
  if (canvasReleased) return;
  canvasReleased = true;
  if (canvasReleaseFallbackTimer) {
    clearTimeout(canvasReleaseFallbackTimer);
    canvasReleaseFallbackTimer = null;
  }
  const mask = document.querySelector('.canvas-loading-mask');
  if (mask && 'hidden' in mask && 'style' in mask) {
    if (!mask.hidden) mask.hidden = true;
    // `style.display = 'none'` is the reliable way to actually remove the
    // mask from layout because `.canvas-loading-mask` sets `display: flex`
    // in the app stylesheet, which beats the UA `[hidden] { display: none }`
    // rule (author stylesheets beat UA). The cast keeps checkJs happy with the
    // duck-typed `in` guard above (plain-object mocks only carry `style`).
    const style = /** @type {CSSStyleDeclaration} */ (mask.style);
    style.display = 'none';
  }
};

/** Hide the ribbon startup mask once paint:ready fires. Idempotent. */
export const releaseRibbonLoading = (/** @type {HTMLElement | null} */ ribbonEl) => {
  if (DEV_LOADING_HOLD) return; // Hold loading open for dev inspection
  if (ribbonReleased) return;
  ribbonReleased = true;
  ribbonEl?.classList.remove('ribbon-loading');
};

/** True if the canvas loading overlay has been released. */
export const isCanvasReleased = () => canvasReleased;

/** True if the ribbon startup mask has been released. */
export const isRibbonReleased = () => ribbonReleased;

/** Reset internal release flags. Test-only seam. */
export const __resetLoadingStateForTesting = () => {
  canvasReleased = false;
  ribbonReleased = false;
  if (canvasReleaseFallbackTimer) {
    clearTimeout(canvasReleaseFallbackTimer);
    canvasReleaseFallbackTimer = null;
  }
};

// Start the safety net immediately when the module loads. If readiness
// events fire first, releaseCanvasLoading() clears this timer.
startCanvasReleaseFallback();
