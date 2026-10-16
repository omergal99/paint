// js/app/canvasViewportSettings.js
// Settings ▸ Canvas viewport padding: the gap between the viewport edge and the
// drawing surface, 0–30px. It drives the `--canvas-viewport-padding` custom
// property consumed by `.canvas-viewport`, so a change only re-lays-out the
// viewport — no canvas pixels are touched. Kept out of `main.js` (the
// composition root) so that file stays a wiring script. Phase 3 modularisation.
import { DEFAULT_SETTINGS } from '../core/constants.js';

const MIN_PADDING = 0;
const MAX_PADDING = 30;

const byId = (id) => document.getElementById(id);

/** Clamp an arbitrary value into the persisted 0–30px range. */
const clampPadding = (value) => {
  const padding = Number(value);
  if (!Number.isFinite(padding)) return DEFAULT_SETTINGS.canvasViewportPadding;
  return Math.min(MAX_PADDING, Math.max(MIN_PADDING, padding));
};

/**
 * The current padding as persisted, read straight from the slider so there is
 * one source of truth. `saveSettings` uses this instead of reaching for a DOM
 * node inside `main.js`.
 *
 * @returns {number} padding in pixels (0–30)
 */
export const getCanvasViewportPadding = () => clampPadding(
  byId('setting-canvas-viewport-padding')?.value ?? DEFAULT_SETTINGS.canvasViewportPadding,
);

/**
 * Apply a padding value to the live CSS custom property, the slider position
 * and the read-out label. Pure DOM writes — safe to call from hydration, the
 * slider, or a test.
 *
 * @param {number} value padding in pixels (clamped to 0–30)
 * @returns {number} the clamped value that was applied
 */
export const applyCanvasViewportPadding = (value) => {
  const padding = clampPadding(value);
  document.documentElement.style.setProperty('--canvas-viewport-padding', `${padding}px`);
  const slider = byId('setting-canvas-viewport-padding');
  if (slider && slider.value !== String(padding)) slider.value = String(padding);
  const readout = byId('setting-canvas-viewport-padding-value');
  if (readout) readout.textContent = `${padding}px`;
  return padding;
};

/**
 * Wire the settings slider. `input` only updates the CSS variable (cheap, gives
 * live feedback while dragging); persisting happens on `change` (once, on
 * release) via a targeted one-key store write, so a drag does not repeatedly
 * serialise the whole settings object to localStorage.
 *
 * @param {object} deps collaborators owned by main.js
 * @param {object} deps.settingsStore persisted settings (validators gate the range)
 */
export const initCanvasViewportSettings = ({ settingsStore }) => {
  const slider = byId('setting-canvas-viewport-padding');
  const persisted = clampPadding(settingsStore.get().canvasViewportPadding);

  if (slider) {
    slider.min = String(MIN_PADDING);
    slider.max = String(MAX_PADDING);
    slider.addEventListener('input', () => applyCanvasViewportPadding(slider.value));
    slider.addEventListener('change', () => {
      settingsStore.set({ canvasViewportPadding: clampPadding(slider.value) });
    });
  }
  applyCanvasViewportPadding(persisted);
};
