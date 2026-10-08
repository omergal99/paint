// js/app/settingsStore.js
// The persisted settings schema: defaults, per-key validators and the store
// factory. Phase 3 modularisation — `main.js` only calls `createSettingsStore()`,
// so the schema has exactly one owner and can grow new keys without touching the
// composition root.
import { createSettingsStore } from '../settings/SettingsStore.js';
import { DEFAULT_SETTINGS, HISTORY_LIMIT_OPTIONS, STORAGE_KEYS } from '../core/constants.js';
import { ADJUSTMENTS } from '../canvas/AdjustmentEngine.js';

const isAdjustmentParams = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.entries(value).every(([id, params]) => {
    const metadata = ADJUSTMENTS[id];
    if (!metadata || !params || typeof params !== 'object' || Array.isArray(params)) return false;
    if (metadata.kind === 'pattern') return Object.keys(params).length === 0;
    const amount = Number(params.value);
    if (!Number.isFinite(amount) || amount < metadata.min || amount > metadata.max) return false;
    if (id === 'noise' && params.seed !== undefined
      && (!Number.isInteger(params.seed) || params.seed < 0 || params.seed > 0xffffffff)) return false;
    return Object.keys(params).every((key) => key === 'value' || (id === 'noise' && key === 'seed'));
  });
};

/** Validators gate what may be persisted; anything else falls back to the default. */
const SETTINGS_VALIDATORS = Object.freeze({
  showZoomReset: (value) => typeof value === 'boolean',
  selectionResizeKeepAspect: (value) => typeof value === 'boolean',
  canvasBackground: (value) => ['none', 'solid', 'transparent', 'checkerboard', 'grid'].includes(value),
  solidBackgroundColor: (value) => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value),
  defaultZoom: (value) => Number.isFinite(Number(value)) && Number(value) > 0,
  interfaceDirection: (value) => ['auto', 'ltr', 'rtl'].includes(value),
  historyAutoSaveMode: (value) => ['all', 'close', 'lifecycle'].includes(value),
  historyLimit: (value) => HISTORY_LIMIT_OPTIONS.includes(Number(value)),
  favoriteShapes: (value) => Array.isArray(value) && value.every((item) => typeof item === 'string' && item),
  adjustParams: isAdjustmentParams,
});

/**
 * @param {object} [options]
 * @param {Storage} [options.storage] injectable for tests
 * @param {string} [options.key] storage key override
 */
export const createPaintSettingsStore = ({ storage = globalThis.localStorage, key = STORAGE_KEYS.settings } = {}) => createSettingsStore({
  storage,
  key,
  defaults: DEFAULT_SETTINGS,
  validators: SETTINGS_VALIDATORS,
});

export { SETTINGS_VALIDATORS };